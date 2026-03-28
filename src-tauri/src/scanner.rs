use crate::types::{DirEntry, DiskUsage, ScanProgress};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Instant, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

/// Intermediate flat entry collected during the walk phase.
struct FlatEntry {
    path: String,
    name: String,
    size: u64,
    is_dir: bool,
    modified: i64,
    is_symlink: bool,
    is_restricted: bool,
}

/// Two-phase streaming scan:
///
/// Phase 1 (instant): Read all immediate children of root. Files get their
/// real size, directories start at size 0. Emit `scan-entries-discovered`
/// so the UI populates immediately.
///
/// Phase 2 (progressive): For each directory child, scan its full subtree.
/// After each directory completes, emit `scan-entry-updated` with the real
/// size and full subtree. The UI updates that entry's bar in real-time.
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

    // ── Phase 1: discover immediate children (fast) ──────────────────
    let read_dir = std::fs::read_dir(root_path).map_err(|e| e.to_string())?;

    let mut children: Vec<DirEntry> = Vec::new();

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

        let meta = dir_entry.metadata().ok();
        let size = if is_dir || is_symlink {
            0 // Directory sizes computed in phase 2
        } else {
            meta.as_ref().map(|m| m.len()).unwrap_or(0)
        };
        let modified = meta
            .as_ref()
            .and_then(|m| m.modified().ok())
            .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
            .unwrap_or(0);
        let is_restricted = !is_symlink && meta.is_none();

        children.push(DirEntry {
            path: child_path_str,
            name: child_name,
            size,
            is_dir,
            child_count: 0,
            modified,
            is_symlink,
            is_restricted,
            children: vec![],
        });
    }

    // Sort files by size desc, dirs by name (since dir sizes are 0 still)
    children.sort_by(|a, b| {
        if a.is_dir == b.is_dir {
            b.size.cmp(&a.size).then_with(|| a.name.cmp(&b.name))
        } else if a.is_dir {
            std::cmp::Ordering::Less // dirs first
        } else {
            std::cmp::Ordering::Greater
        }
    });

    // Emit all discovered entries immediately — UI populates the list
    let _ = app_handle.emit("scan-entries-discovered", &children);

    // ── Phase 2: scan each directory child fully (progressive) ───────
    let mut scanned_count: u32 = children.iter().filter(|c| !c.is_dir).count() as u32;
    let mut last_emit = Instant::now();

    for child in &mut children {
        if cancelled.load(Ordering::Relaxed) {
            break;
        }

        if !child.is_dir || child.is_symlink {
            continue;
        }

        // Scan this directory's full subtree
        let scanned = scan_subtree(
            &child.path,
            &cancelled,
            &mut scanned_count,
            app_handle,
            &mut last_emit,
        );

        // Update the child in place
        *child = scanned;

        // Emit the completed entry so the UI updates this row's bar
        let _ = app_handle.emit("scan-entry-updated", &*child);
    }

    // Final progress event
    let _ = app_handle.emit(
        "scan-progress",
        ScanProgress {
            scanned_count,
            current_path: root.to_string(),
        },
    );

    // Final sort by size descending
    children.sort_by(|a, b| b.size.cmp(&a.size));

    let total_size: u64 = children.iter().map(|c| c.size).sum();

    Ok(DirEntry {
        path: root.to_string(),
        name: root_name,
        size: total_size,
        is_dir: true,
        child_count: children.len() as u32,
        modified: root_modified,
        is_symlink: false,
        is_restricted: false,
        children,
    })
}

/// Scan a subtree using walkdir — collects all entries flat, then builds
/// the nested tree structure. Emits progress events but not scan-entry events
/// (those are only for top-level children).
fn scan_subtree(
    root: &str,
    cancelled: &Arc<AtomicBool>,
    scanned_count: &mut u32,
    app_handle: &AppHandle,
    last_emit: &mut Instant,
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

        let (size, modified, is_symlink, is_restricted) = match entry.metadata() {
            Ok(meta) => {
                let size = if meta.is_file() { meta.len() } else { 0 };
                let modified = meta
                    .modified()
                    .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
                    .unwrap_or(0);
                let is_symlink = entry.path_is_symlink();
                (size, modified, is_symlink, false)
            }
            Err(_) => (0, 0, entry.path_is_symlink(), true),
        };

        let name = entry.file_name().to_string_lossy().to_string();
        let is_dir = entry.file_type().is_dir();

        entries.push(FlatEntry {
            path: path_str,
            name,
            size,
            is_dir,
            modified,
            is_symlink,
            is_restricted,
        });

        *scanned_count += 1;

        // Throttle progress events to ~every 100ms
        if last_emit.elapsed().as_millis() >= 100 {
            let progress_path = entry.path().to_string_lossy().to_string();
            let _ = app_handle.emit(
                "scan-progress",
                ScanProgress {
                    scanned_count: *scanned_count,
                    current_path: progress_path,
                },
            );
            *last_emit = Instant::now();
        }
    }

    // Build tree from flat entries
    match build_tree(root, entries) {
        Ok(tree) => tree,
        Err(_) => {
            // Fallback: return an empty directory entry
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
fn build_tree(root: &str, entries: Vec<FlatEntry>) -> Result<DirEntry, String> {
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

        let child_count = children.len() as u32;

        DirEntry {
            path: entry.path.clone(),
            name: entry.name.clone(),
            size,
            is_dir: entry.is_dir,
            child_count,
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

    Ok(build_node(root_idx, &entries, &children_map))
}

/// Check whether the app has Full Disk Access by probing ~/Library/Mail.
pub fn check_full_disk_access() -> bool {
    let home = match std::env::var("HOME") {
        Ok(h) => h,
        Err(_) => return false,
    };
    let test_path = format!("{}/Library/Mail", home);
    std::fs::read_dir(test_path).is_ok()
}

/// Get disk usage statistics for the volume containing `path`.
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
