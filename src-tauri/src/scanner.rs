use crate::types::{DirEntry, DiskUsage, ScanProgress};
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
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

/// Parallel scan with adaptive snapshot emissions.
///
/// Strategy:
/// 1. List immediate children of root (fast read_dir)
/// 2. Scan each child directory in parallel using rayon
/// 3. Emit periodic tree snapshots with adaptive intervals:
///    - <10K entries: every 500ms (fast feedback)
///    - 10K-100K: every 1s (reduce rebuild cost)
///    - >100K: every 2s (avoid spending more time building trees than scanning)
pub fn scan_directory(
    root: &str,
    app_handle: &AppHandle,
    cancelled: Arc<AtomicBool>,
) -> Result<DirEntry, String> {
    let root_path = std::path::Path::new(root);
    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", root));
    }

    let root_name = root_path
        .file_name()
        .unwrap_or(root_path.as_os_str())
        .to_string_lossy()
        .to_string();

    let root_modified = std::fs::metadata(root_path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
        .unwrap_or(0);

    // Collect immediate children
    let read_dir = std::fs::read_dir(root_path).map_err(|e| e.to_string())?;
    let mut child_dirs: Vec<String> = Vec::new();
    let mut file_entries: Vec<DirEntry> = Vec::new();

    for dir_entry_result in read_dir {
        if cancelled.load(Ordering::Relaxed) {
            break;
        }

        let dir_entry = match dir_entry_result {
            Ok(e) => e,
            Err(_) => continue,
        };

        let child_path = dir_entry.path();
        let child_path_str = child_path.to_string_lossy().to_string();
        let child_name = dir_entry.file_name().to_string_lossy().to_string();

        let ft = dir_entry.file_type().ok();
        let is_symlink = ft.map(|f| f.is_symlink()).unwrap_or(false);
        let is_dir = ft.map(|f| f.is_dir()).unwrap_or(false);

        if is_dir && !is_symlink {
            child_dirs.push(child_path_str);
        } else {
            let meta = dir_entry.metadata().ok();
            let size = if is_symlink {
                0
            } else {
                meta.as_ref().map(|m| m.len()).unwrap_or(0)
            };
            let modified = meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
                .unwrap_or(0);

            file_entries.push(DirEntry {
                path: child_path_str,
                name: child_name,
                size,
                is_dir: false,
                child_count: 0,
                modified,
                is_symlink,
                is_restricted: meta.is_none(),
                children: vec![],
            });
        }
    }

    // Shared state for parallel scanning
    let scanned_count = Arc::new(AtomicU32::new(file_entries.len() as u32));
    let completed_dirs: Arc<Mutex<Vec<DirEntry>>> = Arc::new(Mutex::new(Vec::new()));
    let last_tree_emit = Arc::new(Mutex::new(Instant::now()));
    let last_progress_emit = Arc::new(Mutex::new(Instant::now()));

    // Scan each child directory in parallel with rayon
    child_dirs.par_iter().for_each(|dir_path| {
        if cancelled.load(Ordering::Relaxed) {
            return;
        }

        let subtree = scan_subtree(
            dir_path,
            &cancelled,
            &scanned_count,
            app_handle,
            &last_progress_emit,
        );

        // Add completed subtree
        {
            let mut dirs = completed_dirs.lock().unwrap();
            dirs.push(subtree);
        }

        // Emit tree snapshot with adaptive interval
        let count = scanned_count.load(Ordering::Relaxed);
        let interval_ms = adaptive_interval(count);

        let should_emit = {
            let last = last_tree_emit.lock().unwrap();
            last.elapsed().as_millis() >= interval_ms as u128
        };

        if should_emit {
            let dirs = completed_dirs.lock().unwrap();
            let tree = assemble_root(
                root,
                &root_name,
                root_modified,
                &file_entries,
                &dirs,
            );
            let _ = app_handle.emit("scan-tree-update", &tree);
            *last_tree_emit.lock().unwrap() = Instant::now();
        }
    });

    // Final progress
    let count = scanned_count.load(Ordering::Relaxed);
    let _ = app_handle.emit(
        "scan-progress",
        ScanProgress {
            scanned_count: count,
            current_path: root.to_string(),
        },
    );

    // Build final tree
    let dirs = completed_dirs.lock().unwrap();
    Ok(assemble_root(root, &root_name, root_modified, &file_entries, &dirs))
}

/// Adaptive snapshot interval: faster updates for small scans, slower for large.
fn adaptive_interval(entry_count: u32) -> u64 {
    if entry_count < 10_000 {
        500
    } else if entry_count < 100_000 {
        1000
    } else {
        2000
    }
}

/// Assemble the root DirEntry from file entries + completed directory subtrees.
fn assemble_root(
    root_path: &str,
    root_name: &str,
    root_modified: i64,
    files: &[DirEntry],
    dirs: &[DirEntry],
) -> DirEntry {
    let mut children: Vec<DirEntry> = Vec::with_capacity(files.len() + dirs.len());
    children.extend_from_slice(files);
    children.extend_from_slice(dirs);
    children.sort_by(|a, b| b.size.cmp(&a.size));

    let total_size: u64 = children.iter().map(|c| c.size).sum();

    DirEntry {
        path: root_path.to_string(),
        name: root_name.to_string(),
        size: total_size,
        is_dir: true,
        child_count: children.len() as u32,
        modified: root_modified,
        is_symlink: false,
        is_restricted: false,
        children,
    }
}

/// Scan a single directory subtree using walkdir. Returns a complete DirEntry.
/// Updates shared scanned_count and emits progress events.
fn scan_subtree(
    root: &str,
    cancelled: &Arc<AtomicBool>,
    scanned_count: &Arc<AtomicU32>,
    app_handle: &AppHandle,
    last_progress_emit: &Arc<Mutex<Instant>>,
) -> DirEntry {
    let mut entries: Vec<FlatEntry> = Vec::new();

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

        let count = scanned_count.fetch_add(1, Ordering::Relaxed) + 1;

        // Progress event (throttled, shared across threads)
        let should_emit = {
            let last = last_progress_emit.lock().unwrap();
            last.elapsed().as_millis() >= 100
        };
        if should_emit {
            let progress_path = entry.path().to_string_lossy().to_string();
            let _ = app_handle.emit(
                "scan-progress",
                ScanProgress {
                    scanned_count: count,
                    current_path: progress_path,
                },
            );
            *last_progress_emit.lock().unwrap() = Instant::now();
        }
    }

    match build_tree(root, &entries) {
        Ok(tree) => tree,
        Err(_) => {
            let name = std::path::Path::new(root)
                .file_name()
                .unwrap_or(std::ffi::OsStr::new(root))
                .to_string_lossy()
                .to_string();
            DirEntry {
                path: root.to_string(),
                name,
                size: 0,
                is_dir: true,
                child_count: 0,
                modified: 0,
                is_symlink: false,
                is_restricted: true,
                children: vec![],
            }
        }
    }
}

/// Build a nested `DirEntry` tree from a flat list of entries.
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
