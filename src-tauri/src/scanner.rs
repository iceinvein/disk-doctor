use crate::types::{DirEntry, DiskUsage, ScanProgress};
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, UNIX_EPOCH};
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

/// Parallel scan with continuous tree streaming.
///
/// All parallel walkers push flat entries into a shared Vec. A dedicated
/// emitter thread periodically builds a tree snapshot from ALL entries
/// collected so far and emits it. This gives deep streaming at every
/// level, even within large directories.
pub fn scan_directory(
    root: &str,
    app_handle: &AppHandle,
    cancelled: Arc<AtomicBool>,
) -> Result<DirEntry, String> {
    let root_path = std::path::Path::new(root);
    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", root));
    }

    eprintln!("[scan] starting parallel scan of: {}", root);
    let scan_start = Instant::now();

    // Shared flat entry storage — all threads push here
    let entries: Arc<Mutex<Vec<FlatEntry>>> = Arc::new(Mutex::new(Vec::new()));
    let scanned_count = Arc::new(AtomicU32::new(0));
    let done = Arc::new(AtomicBool::new(false));

    // Add root entry first (build_tree needs it)
    let root_modified = std::fs::metadata(root_path)
        .ok()
        .and_then(|m| m.modified().ok())
        .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
        .unwrap_or(0);
    let root_name = root_path
        .file_name()
        .unwrap_or(root_path.as_os_str())
        .to_string_lossy()
        .to_string();

    {
        let mut e = entries.lock().unwrap();
        e.push(FlatEntry {
            path: root.to_string(),
            name: root_name,
            size: 0,
            is_dir: true,
            modified: root_modified,
            is_symlink: false,
            is_restricted: false,
        });
    }

    // Discover immediate children for parallel dispatch
    let mut child_dirs: Vec<String> = Vec::new();
    if let Ok(read_dir) = std::fs::read_dir(root_path) {
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
                0
            } else {
                meta.as_ref().map(|m| m.len()).unwrap_or(0)
            };
            let modified = meta
                .as_ref()
                .and_then(|m| m.modified().ok())
                .map(|t| t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64)
                .unwrap_or(0);

            // Add to shared entries immediately
            {
                let mut e = entries.lock().unwrap();
                e.push(FlatEntry {
                    path: child_path_str.clone(),
                    name: child_name,
                    size,
                    is_dir,
                    modified,
                    is_symlink,
                    is_restricted: !is_symlink && meta.is_none(),
                });
            }
            scanned_count.fetch_add(1, Ordering::Relaxed);

            if is_dir && !is_symlink {
                child_dirs.push(child_path_str);
            }
        }
    }

    eprintln!(
        "[scan] discovered {} dirs + {} other entries at top level",
        child_dirs.len(),
        scanned_count.load(Ordering::Relaxed)
    );

    // --- Emitter thread: periodically builds + emits tree snapshots ---
    let emitter_handle = {
        let entries = entries.clone();
        let done = done.clone();
        let cancelled = cancelled.clone();
        let scanned_count = scanned_count.clone();
        let app_handle = app_handle.clone();
        let root_str = root.to_string();

        std::thread::spawn(move || {
            let mut emit_count: u32 = 0;

            loop {
                let count = scanned_count.load(Ordering::Relaxed);
                let interval = adaptive_interval(count);
                std::thread::sleep(Duration::from_millis(interval));

                if done.load(Ordering::Relaxed) || cancelled.load(Ordering::Relaxed) {
                    break;
                }

                // Build tree from current entries (holds lock during build)
                let tree = {
                    let e = entries.lock().unwrap();
                    build_tree(&root_str, &e)
                };

                if let Ok(tree) = tree {
                    emit_count += 1;
                    let count = scanned_count.load(Ordering::Relaxed);
                    eprintln!(
                        "[scan] emit tree-update #{}: {} top children, {} total items, interval={}ms",
                        emit_count, tree.child_count, count, interval
                    );
                    let _ = app_handle.emit("scan-tree-update", &tree);
                }

                // Also emit progress
                let count = scanned_count.load(Ordering::Relaxed);
                let _ = app_handle.emit(
                    "scan-progress",
                    ScanProgress {
                        scanned_count: count,
                        current_path: String::new(),
                    },
                );
            }
        })
    };

    // --- Parallel walkers: scan each child dir, flush to shared entries ---
    child_dirs.par_iter().for_each(|dir_path| {
        if cancelled.load(Ordering::Relaxed) {
            return;
        }

        let mut local_buf: Vec<FlatEntry> = Vec::new();
        let mut local_count: u32 = 0;
        let flush_every = 500;

        // Walk this subtree — skip the root dir itself (already added above)
        for entry in WalkDir::new(dir_path).follow_links(false).min_depth(1) {
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
                        .map(|t| {
                            t.duration_since(UNIX_EPOCH).unwrap_or_default().as_secs() as i64
                        })
                        .unwrap_or(0);
                    (size, modified, false)
                }
                Err(_) => (0, 0, true),
            };

            local_buf.push(FlatEntry {
                path: path_str,
                name,
                size,
                is_dir,
                modified,
                is_symlink,
                is_restricted,
            });
            local_count += 1;

            // Flush local buffer to shared entries periodically
            if local_count >= flush_every {
                {
                    let mut shared = entries.lock().unwrap();
                    shared.append(&mut local_buf);
                }
                scanned_count.fetch_add(local_count, Ordering::Relaxed);
                local_count = 0;
            }
        }

        // Flush remaining
        if !local_buf.is_empty() {
            let mut shared = entries.lock().unwrap();
            shared.append(&mut local_buf);
        }
        if local_count > 0 {
            scanned_count.fetch_add(local_count, Ordering::Relaxed);
        }
    });

    // Signal emitter to stop
    done.store(true, Ordering::Relaxed);
    let _ = emitter_handle.join();

    let count = scanned_count.load(Ordering::Relaxed);
    eprintln!(
        "[scan] complete: {} items in {:.1}s, {} child dirs",
        count,
        scan_start.elapsed().as_secs_f64(),
        child_dirs.len()
    );

    // Final progress
    let _ = app_handle.emit(
        "scan-progress",
        ScanProgress {
            scanned_count: count,
            current_path: root.to_string(),
        },
    );

    // Build final tree
    let e = entries.lock().unwrap();
    build_tree(root, &e)
}

/// Adaptive snapshot interval based on entry count.
fn adaptive_interval(entry_count: u32) -> u64 {
    if entry_count < 10_000 {
        500
    } else if entry_count < 100_000 {
        1000
    } else {
        2000
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
