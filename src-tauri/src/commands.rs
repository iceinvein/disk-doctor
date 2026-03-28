use crate::db;
use crate::scanner;
use crate::types::{DiskUsage, ScanMeta, ViewUpdate};
use rusqlite::Connection;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::{AppHandle, State};

pub struct ScanState {
    pub cancelled: Arc<AtomicBool>,
    pub scanning: Arc<AtomicBool>,
    pub db: Arc<Mutex<Connection>>,         // Write connection (walkers)
    pub read_db: Arc<Mutex<Connection>>,    // Read connection (queries — no lock contention in WAL)
    pub current_scan_id: Arc<Mutex<Option<i64>>>,
    pub view_path: Arc<Mutex<String>>,
}

impl ScanState {
    pub fn new() -> Self {
        let db_path = db::db_path();
        let conn = Connection::open(&db_path).expect("Failed to open database");
        db::init_db(&conn).expect("Failed to initialize database");
        let read_conn = db::open_read_connection().expect("Failed to open read connection");
        log!(Db, "opened database at {:?}", db_path);

        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
            scanning: Arc::new(AtomicBool::new(false)),
            db: Arc::new(Mutex::new(conn)),
            read_db: Arc::new(Mutex::new(read_conn)),
            current_scan_id: Arc::new(Mutex::new(None)),
            view_path: Arc::new(Mutex::new(String::new())),
        }
    }
}

#[tauri::command]
pub async fn pick_folder(app: AppHandle) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;

    let folder = app.dialog().file().blocking_pick_folder();

    Ok(folder.map(|f| f.to_string()))
}

#[tauri::command]
pub async fn scan_directory(
    path: String,
    app: AppHandle,
    scan_state: State<'_, Mutex<ScanState>>,
) -> Result<(), String> {
    let (cancelled, _scanning, db, scan_id, view_path) = {
        let state = scan_state
            .lock()
            .map_err(|e| format!("Failed to lock scan state: {}", e))?;
        state.cancelled.store(false, Ordering::Relaxed);
        state.scanning.store(true, Ordering::Relaxed);
        // Set initial view path to scan root
        *state.view_path.lock().unwrap() = path.clone();

        // Create a new scan record in the DB
        let name = std::path::Path::new(&path)
            .file_name()
            .unwrap_or(std::ffi::OsStr::new(&path))
            .to_string_lossy()
            .to_string();
        let conn = state.db.lock().unwrap();
        let scan_id = db::create_scan(&conn, &path, &name)
            .map_err(|e| format!("Failed to create scan: {}", e))?;
        drop(conn);

        *state.current_scan_id.lock().unwrap() = Some(scan_id);

        log!(Cmd, "scan_directory: created scan_id={} for path={}", scan_id, path);

        (
            Arc::clone(&state.cancelled),
            Arc::clone(&state.scanning),
            Arc::clone(&state.db),
            scan_id,
            Arc::clone(&state.view_path),
        )
    };

    let handle = app.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {
        scanner::scan_directory(&path, &handle, cancelled, db, scan_id, view_path)
    })
    .await
    .map_err(|e| format!("Scan task failed: {}", e))?;

    // Clear scanning flag regardless of success/failure
    if let Ok(state) = scan_state.lock() {
        state.scanning.store(false, Ordering::Relaxed);
    }

    result
}

#[tauri::command]
pub fn cancel_scan(scan_state: State<'_, Mutex<ScanState>>) {
    if let Ok(state) = scan_state.lock() {
        state.cancelled.store(true, Ordering::Relaxed);
        state.scanning.store(false, Ordering::Relaxed);
    }
}

#[tauri::command]
pub fn set_view_path(path: String, scan_state: State<'_, Mutex<ScanState>>) {
    if let Ok(state) = scan_state.lock() {
        log!(Cmd, "set_view_path -> {}", path);
        *state.view_path.lock().unwrap() = path;
    }
}

#[tauri::command]
pub async fn get_children(
    path: String,
    scan_state: State<'_, Mutex<ScanState>>,
) -> Result<ViewUpdate, String> {
    let (read_db, scan_id, is_scanning) = {
        let state = scan_state.lock().map_err(|e| e.to_string())?;
        let scan_id = state
            .current_scan_id
            .lock()
            .unwrap()
            .ok_or("No active scan")?;
        (
            Arc::clone(&state.read_db),
            scan_id,
            state.scanning.load(Ordering::Relaxed),
        )
    };

    tauri::async_runtime::spawn_blocking(move || {
        let conn = read_db.lock().map_err(|e| e.to_string())?;

        let (entries, parent_size) = if is_scanning {
            // During scan: compute live sizes (directories may not have final sizes yet)
            db::get_children_with_live_sizes(&conn, scan_id, &path)
                .map_err(|e| format!("DB error: {}", e))?
        } else {
            // After scan: stored sizes are accurate (compute_folder_sizes already ran)
            let entries = db::get_children(&conn, scan_id, &path)
                .map_err(|e| format!("DB error: {}", e))?;
            let total: u64 = entries.iter().map(|e| e.size).sum();
            (entries, total)
        };

        let parent = db::get_entry(&conn, scan_id, &path)
            .map_err(|e| format!("DB error: {}", e))?;

        let (parent_path, parent_size, parent_name) = match &parent {
            Some(p) => (p.path.clone(), parent_size, p.name.clone()),
            None => (path.clone(), parent_size, String::new()),
        };

        log!(Cmd, "get_children({}) → {} entries, parent_size={}, live={}", path, entries.len(), parent_size, is_scanning);

        Ok(ViewUpdate {
            entries,
            parent_path,
            parent_size,
            parent_name,
            total_scanned: 0,
        })
    })
    .await
    .map_err(|e| format!("Task failed: {}", e))?
}

#[tauri::command]
pub async fn trash_items(
    paths: Vec<String>,
    scan_state: State<'_, Mutex<ScanState>>,
) -> Result<Vec<String>, String> {
    let mut failures: Vec<String> = Vec::new();

    // Clone the Arcs we need before the async work
    let (db, current_scan_id) = {
        let state = scan_state.lock().map_err(|e| e.to_string())?;
        (
            Arc::clone(&state.db),
            Arc::clone(&state.current_scan_id),
        )
    };

    for path in &paths {
        if let Err(e) = trash::delete(path) {
            failures.push(format!("{}: {}", path, e));
        } else {
            // Successfully trashed — also delete from DB
            let conn = db.lock().unwrap();
            if let Some(scan_id) = *current_scan_id.lock().unwrap() {
                db::delete_entry(&conn, scan_id, path).ok();
            }
        }
    }

    Ok(failures)
}

#[tauri::command]
pub fn open_in_finder(path: String) -> Result<(), String> {
    use std::process::Command;

    Command::new("open")
        .arg("-R")
        .arg(&path)
        .spawn()
        .map_err(|e| format!("Failed to open Finder: {}", e))?;

    Ok(())
}

#[tauri::command]
pub fn get_disk_usage(path: String) -> Result<DiskUsage, String> {
    scanner::get_disk_usage(&path)
}

#[tauri::command]
pub fn check_full_disk_access() -> bool {
    scanner::check_full_disk_access()
}

#[tauri::command]
pub fn get_latest_scan(
    scan_state: State<'_, Mutex<ScanState>>,
) -> Result<Option<ScanMeta>, String> {
    let state = scan_state.lock().map_err(|e| e.to_string())?;
    let conn = state.read_db.lock().map_err(|e| e.to_string())?;
    db::get_latest_scan(&conn).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn list_scans(scan_state: State<'_, Mutex<ScanState>>) -> Result<Vec<ScanMeta>, String> {
    let state = scan_state.lock().map_err(|e| e.to_string())?;
    let conn = state.read_db.lock().map_err(|e| e.to_string())?;
    db::list_scans(&conn).map_err(|e| format!("DB error: {}", e))
}

#[tauri::command]
pub fn load_scan(
    scan_id: i64,
    scan_state: State<'_, Mutex<ScanState>>,
) -> Result<ScanMeta, String> {
    let state = scan_state.lock().map_err(|e| e.to_string())?;
    let conn = state.read_db.lock().map_err(|e| e.to_string())?;

    // Verify the scan exists by checking the scans table
    let meta: ScanMeta = conn
        .query_row(
            "SELECT id, root_path, root_name, scanned_at, scan_time, total_size, total_items FROM scans WHERE id = ?1",
            rusqlite::params![scan_id],
            |row| {
                Ok(ScanMeta {
                    id: row.get(0)?,
                    root_path: row.get(1)?,
                    root_name: row.get(2)?,
                    scanned_at: row.get(3)?,
                    scan_time: row.get::<_, Option<f64>>(4)?.unwrap_or(0.0),
                    total_size: row.get::<_, i64>(5)? as u64,
                    total_items: row.get::<_, i64>(6)? as u32,
                })
            },
        )
        .map_err(|e| format!("Scan not found: {}", e))?;

    // Set as current scan
    *state.current_scan_id.lock().unwrap() = Some(scan_id);
    *state.view_path.lock().unwrap() = meta.root_path.clone();

    log!(Cmd, "load_scan: loaded scan_id={}, root={}", scan_id, meta.root_path);

    Ok(meta)
}

#[tauri::command]
pub fn open_full_disk_access_settings() -> Result<(), String> {
    use std::process::Command;

    // Try the modern macOS Ventura+ URL first
    let result = Command::new("open")
        .arg("x-apple.systempreferences:com.apple.settings.PrivacySecurity.extension?Privacy_AllFiles")
        .spawn();

    if result.is_err() {
        // Fallback for older macOS
        Command::new("open")
            .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles")
            .spawn()
            .map_err(|e| format!("Failed to open System Settings: {}", e))?;
    }

    Ok(())
}
