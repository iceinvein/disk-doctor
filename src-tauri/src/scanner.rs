use crate::db;
use crate::types::{DiskUsage, ScanProgress, ViewUpdate};
use rayon::prelude::*;
use rusqlite::Connection;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, UNIX_EPOCH};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

/// Parallel scan that writes entries to SQLite in batches.
///
/// All parallel walkers flush entries to the DB periodically. A dedicated
/// emitter thread queries the DB for the current view_path and emits
/// lightweight `view-update` events. After all walkers complete,
/// folder sizes are computed bottom-up and the scan is finalized.
pub fn scan_directory(
    root: &str,
    app_handle: &AppHandle,
    cancelled: Arc<AtomicBool>,
    db: Arc<Mutex<Connection>>,
    scan_id: i64,
    view_path: Arc<Mutex<String>>,
) -> Result<(), String> {
    let root_path = std::path::Path::new(root);
    if !root_path.exists() {
        return Err(format!("Path does not exist: {}", root));
    }

    eprintln!("[scan] starting parallel scan of: {}", root);
    let scan_start = Instant::now();

    let scanned_count = Arc::new(AtomicU32::new(0));
    let done = Arc::new(AtomicBool::new(false));

    // Add root entry first
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

    // Root entry has empty parent_path
    {
        let conn = db.lock().unwrap();
        db::insert_entries(
            &conn,
            scan_id,
            &[(
                root.to_string(),
                String::new(), // parent_path = "" for root
                root_name,
                0,
                true,
                0,
                root_modified,
                false,
                false,
            )],
        )
        .map_err(|e| format!("Failed to insert root entry: {}", e))?;
    }

    // Discover immediate children for parallel dispatch
    let mut child_dirs: Vec<String> = Vec::new();
    if let Ok(read_dir) = std::fs::read_dir(root_path) {
        let mut batch: Vec<(String, String, String, u64, bool, u32, i64, bool, bool)> = Vec::new();

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

            batch.push((
                child_path_str.clone(),
                root.to_string(), // parent is the root
                child_name,
                size,
                is_dir,
                0,
                modified,
                is_symlink,
                !is_symlink && meta.is_none(),
            ));
            scanned_count.fetch_add(1, Ordering::Relaxed);

            if is_dir && !is_symlink {
                child_dirs.push(child_path_str);
            }
        }

        // Flush top-level children to DB
        if !batch.is_empty() {
            let conn = db.lock().unwrap();
            db::insert_entries(&conn, scan_id, &batch)
                .map_err(|e| format!("Failed to insert top-level entries: {}", e))?;
        }
    }

    eprintln!(
        "[scan] discovered {} dirs + {} other entries at top level",
        child_dirs.len(),
        scanned_count.load(Ordering::Relaxed)
    );

    // --- Emitter thread: uses its own read connection (WAL = no lock contention) ---
    let emitter_handle = {
        let done = done.clone();
        let cancelled = cancelled.clone();
        let scanned_count = scanned_count.clone();
        let app_handle = app_handle.clone();
        let view_path = view_path.clone();

        std::thread::spawn(move || {
            // Open a dedicated read-only connection — doesn't block writers
            let read_conn = match db::open_read_connection() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("[scan] failed to open read connection: {}", e);
                    return;
                }
            };

            let mut emit_count: u32 = 0;

            loop {
                let count = scanned_count.load(Ordering::Relaxed);
                let interval = adaptive_interval(count);
                std::thread::sleep(Duration::from_millis(interval));

                if done.load(Ordering::Relaxed) || cancelled.load(Ordering::Relaxed) {
                    break;
                }

                let vp = view_path.lock().unwrap().clone();

                // Use live-computed sizes — reads don't block writes in WAL mode
                let (entries, parent_live_size) = match db::get_children_with_live_sizes(&read_conn, scan_id, &vp) {
                    Ok(result) => result,
                    Err(_) => continue,
                };
                let parent = db::get_entry(&read_conn, scan_id, &vp).ok().flatten();

                let (parent_path, parent_size, parent_name) = match &parent {
                    Some(p) => (p.path.clone(), parent_live_size, p.name.clone()),
                    None => (vp.clone(), parent_live_size, String::new()),
                };

                emit_count += 1;
                let count = scanned_count.load(Ordering::Relaxed);
                eprintln!(
                    "[scan] emit view-update #{}: {} entries at '{}', {} total items, interval={}ms",
                    emit_count,
                    entries.len(),
                    parent_name,
                    count,
                    interval
                );

                let update = ViewUpdate {
                    entries,
                    parent_path,
                    parent_size,
                    parent_name,
                    total_scanned: count,
                };

                let _ = app_handle.emit("view-update", &update);

                // Also emit progress
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

    // --- Parallel walkers: scan each child dir, flush to DB in batches ---
    child_dirs.par_iter().for_each(|dir_path| {
        if cancelled.load(Ordering::Relaxed) {
            return;
        }

        let mut local_buf: Vec<(String, String, String, u64, bool, u32, i64, bool, bool)> =
            Vec::new();
        let mut local_count: u32 = 0;
        let flush_every = 2000;

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

            let parent = entry
                .path()
                .parent()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

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

            local_buf.push((
                path_str,
                parent,
                name,
                size,
                is_dir,
                0,
                modified,
                is_symlink,
                is_restricted,
            ));
            local_count += 1;

            // Flush local buffer to DB periodically
            if local_count >= flush_every {
                {
                    let conn = db.lock().unwrap();
                    db::insert_entries(&conn, scan_id, &local_buf).ok();
                }
                scanned_count.fetch_add(local_count, Ordering::Relaxed);
                local_buf.clear();
                local_count = 0;
            }
        }

        // Flush remaining
        if !local_buf.is_empty() {
            let conn = db.lock().unwrap();
            db::insert_entries(&conn, scan_id, &local_buf).ok();
        }
        if local_count > 0 {
            scanned_count.fetch_add(local_count, Ordering::Relaxed);
        }
    });

    // Signal emitter to stop
    done.store(true, Ordering::Relaxed);
    let _ = emitter_handle.join();

    let count = scanned_count.load(Ordering::Relaxed);
    let scan_time = scan_start.elapsed().as_secs_f64();
    eprintln!(
        "[scan] complete: {} items in {:.1}s, {} child dirs",
        count, scan_time, child_dirs.len()
    );

    // Final progress
    let _ = app_handle.emit(
        "scan-progress",
        ScanProgress {
            scanned_count: count,
            current_path: root.to_string(),
        },
    );

    // Compute folder sizes bottom-up BEFORE emitting final view-update
    {
        eprintln!("[scan] computing folder sizes...");
        let size_start = Instant::now();
        let conn = db.lock().unwrap();
        db::compute_folder_sizes(&conn, scan_id)
            .map_err(|e| format!("Failed to compute folder sizes: {}", e))?;
        db::complete_scan(&conn, scan_id, scan_time)
            .map_err(|e| format!("Failed to complete scan: {}", e))?;
        eprintln!(
            "[scan] folder sizes computed in {:.1}s",
            size_start.elapsed().as_secs_f64()
        );
    }

    // Emit final view-update so frontend gets the complete picture with accurate sizes
    {
        let vp = view_path.lock().unwrap().clone();
        let conn = db.lock().unwrap();
        let entries =
            db::get_children(&conn, scan_id, &vp).map_err(|e| format!("DB error: {}", e))?;
        let parent = db::get_entry(&conn, scan_id, &vp)
            .map_err(|e| format!("DB error: {}", e))?;

        let (parent_path, parent_size, parent_name) = match &parent {
            Some(p) => (p.path.clone(), p.size, p.name.clone()),
            None => (vp.clone(), 0, String::new()),
        };

        let update = ViewUpdate {
            entries,
            parent_path: parent_path.clone(),
            parent_size,
            parent_name: parent_name.clone(),
            total_scanned: count,
        };

        eprintln!(
            "[scan] emit final view-update: {} entries at '{}'",
            update.entries.len(),
            parent_name
        );
        let _ = app_handle.emit("view-update", &update);
    }

    Ok(())
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
