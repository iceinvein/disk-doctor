mod commands;
mod scanner;
mod types;

use commands::ScanState;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(ScanState::default()))
        .invoke_handler(tauri::generate_handler![
            commands::pick_folder,
            commands::scan_directory,
            commands::cancel_scan,
            commands::trash_items,
            commands::open_in_finder,
            commands::get_disk_usage,
            commands::check_full_disk_access,
            commands::open_full_disk_access_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
