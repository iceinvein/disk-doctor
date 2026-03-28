use crate::types::{DirEntry, DiskUsage, ScanProgress};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Instant, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

struct FlatEntry {
    path: String,
    name: String,
    size: u64,
    is_dir: bool,
    modified: i64,
    is_symlink: bool,
    is_restricted: bool,
}

/// Scan a directory tree with periodic tree snapshot emissions.
///
/// Every ~500ms, the current partial tree is built from entries collected
/// so far and emitted via `scan-tree-update`. This means the UI updates
/// at every depth level — not just top-level children.
pub fn scan_directory(
    root: &str,
    app_handle: &AppHandle,
    cancelled: Arc<AtomicBool>,
) -> Result<DirEntry, String> {
    let root_path = std::path::Path::new(root);
    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", root));
    }

    let mut entries: Vec<FlatEntry> = Vec::new();
    let mut scanned_count: u32 = 0;
    let mut last_progress_emit = Instant::now();
    let mut last_tree_emit = Instant::now();

    for entry in WalkDir::new(root).follow_links(false) {
        if cancelled.load(Ordering::Relaxed) {
            break;
        }

        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        let path_str = entry.path().to_string_lossy().to_string();
        let name = entry.file_name().to_string_lossy().to_string();
        let is_symlink = entry.path_is_symlink();
        let is_dir = entry.file_type().is_dir();

        let (size, modified, is_restricted) = match entry.metadata() {
            Ok(meta) => {
                let size = if meta.is_file() { meta.len() } else { 0 };
                let modified = meta
                    .modified()
                    .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
                    .unwrap_or(0);
                (size, modified, false)
            }
            Err(_) => (0, 0, true),
        };

        entries.push(FlatEntry {
            path: path_str,
            name,
            size,
            is_dir,
            modified,
            is_symlink,
            is_restricted,
        });

        scanned_count += 1;

        // Progress event every ~100ms
        if last_progress_emit.elapsed().as_millis() >= 100 {
            let progress_path = entry.path().to_string_lossy().to_string();
            let _ = app_handle.emit(
                "scan-progress",
                ScanProgress {
                    scanned_count,
                    current_path: progress_path,
                },
            );
            last_progress_emit = Instant::now();
        }

        // Tree snapshot every ~500ms — updates UI at all depth levels
        if last_tree_emit.elapsed().as_millis() >= 500 {
            if let Ok(partial) = build_tree(root, &entries) {
                let _ = app_handle.emit("scan-tree-update", &partial);
            }
            last_tree_emit = Instant::now();
        }
    }

    // Final progress
    let _ = app_handle.emit(
        "scan-progress",
        ScanProgress {
            scanned_count,
            current_path: root.to_string(),
        },
    );

    build_tree(root, &entries)
}

/// Build a nested `DirEntry` tree from a flat list of entries.
/// Takes entries by reference so it can be called periodically during the scan.
fn build_tree(root: &str, entries: &[FlatEntry]) -> Result<DirEntry, String> {
    if entries.is_empty() {
        return Err("No entries found".into());
    }

    let path_to_idx: HashMap<&str, usize> = entries
        .iter()
        .enumerate()
        .map(|(i, e)| (e.path.as_str(), i))
        .collect();

    let mut children_map: HashMap<usize, Vec<usize>> = HashMap::new();

    for (i, entry) in entries.iter().enumerate() {
        if let Some(parent) = std::path::Path::new(&entry.path).parent() {
            let parent_str = parent.to_string_lossy();
            if let Some(&parent_idx) = path_to_idx.get(parent_str.as_ref()) {
                if parent_idx != i {
                    children_map.entry(parent_idx).or_default().push(i);
                }
            }
        }
    }

    fn build_node(
        idx: usize,
        entries: &[FlatEntry],
        children_map: &HashMap<usize, Vec<usize>>,
    ) -> DirEntry {
        let entry = &entries[idx];
        let mut children: Vec<DirEntry> = Vec::new();
        let mut size = entry.size;

        if let Some(child_indices) = children_map.get(&idx) {
            for &child_idx in child_indices {
                let child = build_node(child_idx, entries, children_map);
                size += child.size;
                children.push(child);
            }
            children.sort_by(|a, b| b.size.cmp(&a.size));
        }

        DirEntry {
            path: entry.path.clone(),
            name: entry.name.clone(),
            size,
            is_dir: entry.is_dir,
            child_count: children.len() as u32,
            modified: entry.modified,
            is_symlink: entry.is_symlink,
            is_restricted: entry.is_restricted,
            children,
        }
    }

    let root_idx = path_to_idx
        .get(root)
        .copied()
        .ok_or_else(|| format!("Root path '{}' not found in entries", root))?;

    Ok(build_node(root_idx, entries, &children_map))
}

pub fn check_full_disk_access() -> bool {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return false,
    };
    let test_path = format!("{}/Library/Mail", home);
    std::fs::read_dir(test_path).is_ok()
}

pub fn get_disk_usage(path: &str) -> Result<DiskUsage, String> {
    use std::ffi::CString;
    use std::mem::MaybeUninit;

    let c_path = CString::new(path).map_err(|e| format!("Invalid path: {}", e))?;
    let mut stat = MaybeUninit::<libc::statvfs>::uninit();
    let result = unsafe { libc::statvfs(c_path.as_ptr(), stat.as_mut_ptr()) };

    if result != 0 {
        return Err(format!(
            "statvfs failed with errno: {}",
            std::io::Error::last_os_error()
        ));
    }

    let stat = unsafe { stat.assume_init() };
    let block_size = stat.f_frsize as u64;
    let total = stat.f_blocks as u64 * block_size;
    let free = stat.f_bavail as u64 * block_size;
    let used = total.saturating_sub(free);

    Ok(DiskUsage { total, free, used })
}
