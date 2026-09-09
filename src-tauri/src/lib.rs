mod backup;
mod llm;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            llm::has_claude_api_key,
            llm::save_claude_api_key,
            llm::clear_claude_api_key,
            llm::has_openai_api_key,
            llm::save_openai_api_key,
            llm::clear_openai_api_key,
            llm::get_llm_settings,
            llm::set_llm_settings,
            llm::summarize_week,
            backup::commands::export_backup,
            backup::commands::import_backup,
            backup::commands::verify_backup_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
