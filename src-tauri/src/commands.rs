use crate::scanner;
use crate::types::{DirEntry, DiskUsage, ViewUpdate};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use tauri::{AppHandle, State};

pub struct ScanState {
    pub cancelled: Arc<AtomicBool>,
    pub tree: Arc<Mutex<Option<DirEntry>>>,
    pub view_path: Arc<Mutex<String>>,
}

impl Default for ScanState {
    fn default() -> Self {
        Self {
            cancelled: Arc::new(AtomicBool::new(false)),
            tree: Arc::new(Mutex::new(None)),
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
) -> Result<DirEntry, String> {
    let (cancelled, tree_state, view_path) = {
        let state = scan_state
            .lock()
            .map_err(|e| format!("Failed to lock scan state: {}", e))?;
        state.cancelled.store(false, Ordering::Relaxed);
        // Set initial view path to scan root
        *state.view_path.lock().unwrap() = path.clone();
        (
            Arc::clone(&state.cancelled),
            Arc::clone(&state.tree),
            Arc::clone(&state.view_path),
        )
    };

    let handle = app.clone();

    tauri::async_runtime::spawn_blocking(move || {
        scanner::scan_directory(&path, &handle, cancelled, tree_state, view_path)
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
pub fn set_view_path(path: String, scan_state: State<'_, Mutex<ScanState>>) {
    if let Ok(state) = scan_state.lock() {
        eprintln!("[cmd] set_view_path → {}", path);
        *state.view_path.lock().unwrap() = path;
    }
}

#[tauri::command]
pub fn get_children(path: String, scan_state: State<'_, Mutex<ScanState>>) -> Result<ViewUpdate, String> {
    let state = scan_state.lock().map_err(|e| e.to_string())?;
    let tree_guard = state.tree.lock().map_err(|e| e.to_string())?;

    let tree = tree_guard.as_ref().ok_or("No scan data available")?;

    // Find the node at `path`
    let node = scanner::find_node(tree, &path)
        .ok_or_else(|| format!("Path not found: {}", path))?;

    // Return children with empty children (shallow)
    let entries: Vec<DirEntry> = node
        .children
        .iter()
        .map(|c| DirEntry {
            path: c.path.clone(),
            name: c.name.clone(),
            size: c.size,
            is_dir: c.is_dir,
            child_count: c.child_count,
            modified: c.modified,
            is_symlink: c.is_symlink,
            is_restricted: c.is_restricted,
            children: vec![], // Don't send nested children
        })
        .collect();

    eprintln!(
        "[cmd] get_children({}) → {} entries, parent_size={}",
        path,
        entries.len(),
        node.size
    );

    Ok(ViewUpdate {
        entries,
        parent_path: node.path.clone(),
        parent_size: node.size,
        parent_name: node.name.clone(),
        total_scanned: 0,
    })
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
