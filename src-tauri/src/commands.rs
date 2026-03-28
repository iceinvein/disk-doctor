use crate::scanner;
use crate::types::{DirEntry, DiskUsage};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::{AppHandle, State};

pub struct ScanState {
    pub cancelled: Arc<AtomicBool>,
}

impl Default for ScanState {
    fn default() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
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
) -> Result<DirEntry, String> {
    // Reset the cancelled flag before starting a new scan.
    let cancelled = {
        let state = scan_state
            .lock()
            .map_err(|e| format!("Failed to lock scan state: {}", e))?;
        state.cancelled.store(false, Ordering::Relaxed);
        Arc::clone(&state.cancelled)
    };

    let handle = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        scanner::scan_directory(&path, &handle, cancelled)
    })
    .await
    .map_err(|e| format!("Scan task failed: {}", e))?
}

#[tauri::command]
pub fn cancel_scan(scan_state: State<'_, Mutex<ScanState>>) {
    if let Ok(state) = scan_state.lock() {
        state.cancelled.store(true, Ordering::Relaxed);
    }
}

#[tauri::command]
pub async fn trash_items(paths: Vec<String>) -> Result<Vec<String>, String> {
    let mut failures: Vec<String> = Vec::new();

    for path in &paths {
        if let Err(e) = trash::delete(path) {
            failures.push(format!("{}: {}", path, e));
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
