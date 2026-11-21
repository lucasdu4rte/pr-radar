#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Apps opened from Finder get a bare PATH; load the login shell's so gh and git resolve.
    let _ = fix_path_env::fix();

    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .run(tauri::generate_context!())
        .expect("error while running Radar de PRs");
}
