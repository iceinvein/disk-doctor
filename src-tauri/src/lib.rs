mod commands;
mod db;
mod scanner;
mod types;

use commands::ScanState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(ScanState::new()))
        .invoke_handler(tauri::generate_handler![
            commands::pick_folder,
            commands::scan_directory,
            commands::cancel_scan,
            commands::set_view_path,
            commands::get_children,
            commands::trash_items,
            commands::open_in_finder,
            commands::get_disk_usage,
            commands::check_full_disk_access,
            commands::open_full_disk_access_settings,
            commands::get_latest_scan,
            commands::list_scans,
            commands::load_scan,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
