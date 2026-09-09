use super::{open_backup, seal_backup};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const DB_FILE: &str = "leadership.db";
const SETTINGS_FILE: &str = "llm_settings.json";
const CLAUDE_KEY_FILE: &str = "claude_api_key";
const OPENAI_KEY_FILE: &str = "openai_api_key";
const CONFIG_FILES: [&str; 3] = [SETTINGS_FILE, CLAUDE_KEY_FILE, OPENAI_KEY_FILE];

const ERR_EMPTY_PASSWORD: &str = "Parola boş olamaz";
const ERR_DB_NOT_FOUND: &str = "Veritabanı bulunamadı";
const ERR_DB_NOT_IN_BACKUP: &str = "Yedekte veritabanı bulunamadı";

/// Config/key files that exist locally but are absent from the archive and must be deleted.
pub fn config_files_to_remove(archive_names: &[String]) -> Vec<&'static str> {
    CONFIG_FILES
        .into_iter()
        .filter(|name| !archive_names.iter().any(|n| n == name))
        .collect()
}

fn bak_path(to: &Path) -> PathBuf {
    let mut raw = to.as_os_str().to_os_string();
    raw.push(".bak");
    PathBuf::from(raw)
}

fn io_write_err(err: impl std::fmt::Display) -> String {
    format!("Dosya yazılamadı: {err}")
}

/// Move `from` onto `to` without deleting the last copy first.
///
/// Windows cannot `rename` over an existing file, so dest is renamed aside to
/// `*.bak`, temp is installed, then the aside copy is removed. If install fails,
/// dest is restored from `.bak` when dest is missing. The source temp is never
/// deleted here — callers must keep it when dest is gone.
fn replace_file(from: &Path, to: &Path) -> Result<(), String> {
    let bak = bak_path(to);
    let dest_existed = to.exists();

    if dest_existed {
        if bak.exists() {
            fs::remove_file(&bak).map_err(io_write_err)?;
        }
        fs::rename(to, &bak).map_err(io_write_err)?;
    }

    match fs::rename(from, to) {
        Ok(()) => {
            let _ = fs::remove_file(&bak);
            Ok(())
        }
        Err(err) => {
            if !to.exists() && bak.exists() {
                let _ = fs::rename(&bak, to);
            }
            Err(io_write_err(err))
        }
    }
}

fn discard_temp_if_dest_present(tmp: &Path, dest: &Path) {
    if dest.exists() {
        let _ = fs::remove_file(tmp);
    }
}

fn write_atomic(path: &Path, data: &[u8]) -> Result<(), String> {
    let file_name = path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("kompass");
    let tmp_name = format!(".{file_name}.tmp");
    let tmp = match path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent.join(tmp_name),
        _ => PathBuf::from(tmp_name),
    };
    fs::write(&tmp, data).map_err(io_write_err)?;
    replace_file(&tmp, path).inspect_err(|_| {
        discard_temp_if_dest_present(&tmp, path);
    })
}

fn collect_export_files(
    db_path: &Path,
    config_dir: &Path,
) -> Result<Vec<(String, Vec<u8>)>, String> {
    if !db_path.exists() {
        return Err(ERR_DB_NOT_FOUND.to_string());
    }
    let mut files = Vec::new();
    let db_bytes = fs::read(db_path).map_err(|e| format!("Veritabanı okunamadı: {e}"))?;
    files.push((DB_FILE.to_string(), db_bytes));
    for name in CONFIG_FILES {
        let path = config_dir.join(name);
        if path.is_file() {
            let bytes = fs::read(&path).map_err(|e| format!("Dosya okunamadı: {e}"))?;
            files.push((name.to_string(), bytes));
        }
    }
    Ok(files)
}

fn sqlite_sidecar(db_path: &Path, suffix: &str) -> PathBuf {
    let mut raw = db_path.as_os_str().to_os_string();
    raw.push(suffix);
    PathBuf::from(raw)
}

fn remove_sqlite_sidecars(db_path: &Path) -> Result<(), String> {
    for suffix in ["-wal", "-shm"] {
        let path = sqlite_sidecar(db_path, suffix);
        if path.exists() {
            fs::remove_file(&path).map_err(|e| format!("Dosya silinemedi: {e}"))?;
        }
    }
    Ok(())
}

pub fn export_from_paths(
    password: &str,
    db_path: &Path,
    config_dir: &Path,
    dest_path: &Path,
) -> Result<(), String> {
    if password.is_empty() {
        return Err(ERR_EMPTY_PASSWORD.to_string());
    }
    let files = collect_export_files(db_path, config_dir)?;
    let blob = seal_backup(password, &files)?;
    if let Some(parent) = dest_path.parent() {
        if !parent.as_os_str().is_empty() {
            fs::create_dir_all(parent).map_err(|e| format!("Klasör oluşturulamadı: {e}"))?;
        }
    }
    write_atomic(dest_path, &blob)
}

pub fn import_from_paths(
    password: &str,
    source_path: &Path,
    db_path: &Path,
    config_dir: &Path,
) -> Result<(), String> {
    if password.is_empty() {
        return Err(ERR_EMPTY_PASSWORD.to_string());
    }

    let blob = fs::read(source_path).map_err(|e| format!("Yedek okunamadı: {e}"))?;
    let files = open_backup(password, &blob)?;
    let db_bytes = files
        .iter()
        .find(|(name, _)| name == DB_FILE)
        .map(|(_, data)| data.clone())
        .ok_or_else(|| ERR_DB_NOT_IN_BACKUP.to_string())?;

    let archive_names: Vec<String> = files.iter().map(|(name, _)| name.clone()).collect();
    let to_delete = config_files_to_remove(&archive_names);

    let db_parent = match db_path.parent() {
        Some(parent) if !parent.as_os_str().is_empty() => parent.to_path_buf(),
        _ => PathBuf::from("."),
    };
    fs::create_dir_all(&db_parent).map_err(|e| format!("Klasör oluşturulamadı: {e}"))?;
    fs::create_dir_all(config_dir).map_err(|e| format!("Klasör oluşturulamadı: {e}"))?;

    let db_tmp = db_parent.join(".leadership.db.import-tmp");
    let mut temps: Vec<(PathBuf, PathBuf)> = vec![(db_tmp.clone(), db_path.to_path_buf())];
    let write_result = (|| {
        fs::write(&db_tmp, &db_bytes).map_err(io_write_err)?;

        let mut config_swaps: Vec<(PathBuf, PathBuf)> = Vec::new();
        for (name, data) in &files {
            if name == DB_FILE || !CONFIG_FILES.contains(&name.as_str()) {
                continue;
            }
            let final_path = config_dir.join(name);
            let tmp = config_dir.join(format!(".{name}.import-tmp"));
            fs::write(&tmp, data).map_err(io_write_err)?;
            temps.push((tmp.clone(), final_path.clone()));
            config_swaps.push((tmp, final_path));
        }

        replace_file(&db_tmp, db_path)?;
        temps.retain(|(p, _)| p != &db_tmp);
        remove_sqlite_sidecars(db_path)?;

        for (tmp, final_path) in config_swaps {
            replace_file(&tmp, &final_path)?;
            temps.retain(|(p, _)| p != &tmp);
        }

        for name in to_delete {
            let path = config_dir.join(name);
            if path.exists() {
                fs::remove_file(&path).map_err(|e| format!("Dosya silinemedi: {e}"))?;
            }
        }
        Ok(())
    })();

    if write_result.is_err() {
        for (tmp, dest) in temps {
            discard_temp_if_dest_present(&tmp, &dest);
        }
    }
    write_result
}

/// plugin-sql maps `sqlite:leadership.db` onto `app_config_dir()`, not `app_data_dir()`.
/// On macOS both resolve to Application Support; on Linux they differ.
fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| format!("Uygulama klasörü açılamadı: {e}"))?;
    Ok(dir.join(DB_FILE))
}

fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| format!("Yapılandırma klasörü açılamadı: {e}"))
}

#[tauri::command]
pub async fn export_backup(
    app: AppHandle,
    password: String,
    dest_path: String,
) -> Result<(), String> {
    export_from_paths(&password, &db_path(&app)?, &config_dir(&app)?, Path::new(&dest_path))
}

#[tauri::command]
pub async fn import_backup(
    app: AppHandle,
    password: String,
    source_path: String,
) -> Result<(), String> {
    import_from_paths(
        &password,
        Path::new(&source_path),
        &db_path(&app)?,
        &config_dir(&app)?,
    )
}

pub fn verify_backup_from_path(password: &str, source_path: &Path) -> Result<(), String> {
    if password.is_empty() {
        return Err(ERR_EMPTY_PASSWORD.to_string());
    }
    let blob = fs::read(source_path).map_err(|e| format!("Yedek okunamadı: {e}"))?;
    let _ = open_backup(password, &blob)?;
    Ok(())
}

#[tauri::command]
pub async fn verify_backup_password(
    _app: AppHandle,
    password: String,
    source_path: String,
) -> Result<(), String> {
    verify_backup_from_path(&password, Path::new(&source_path))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn test_root() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!(
            "kompass-backup-t2-{}-{nanos}",
            std::process::id()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn restore_deletes_local_keys_missing_from_archive() {
        let archive = vec!["leadership.db".to_string(), "llm_settings.json".to_string()];
        let deletes = config_files_to_remove(&archive);
        assert!(deletes.contains(&"claude_api_key"));
        assert!(deletes.contains(&"openai_api_key"));
        assert!(!deletes.contains(&"llm_settings.json"));
    }

    #[test]
    fn restore_keeps_keys_present_in_archive() {
        let archive = vec![
            "leadership.db".to_string(),
            "claude_api_key".to_string(),
            "openai_api_key".to_string(),
            "llm_settings.json".to_string(),
        ];
        assert!(config_files_to_remove(&archive).is_empty());
    }

    #[test]
    fn export_rejects_empty_password() {
        let root = test_root();
        let db = root.join(DB_FILE);
        fs::write(&db, b"sqlite").unwrap();
        let dest = root.join("out.kompass");
        let err = export_from_paths("", &db, &root, &dest).unwrap_err();
        assert!(err.contains("Parola boş"));
        assert!(!dest.exists());
    }

    #[test]
    fn export_fails_when_db_missing() {
        let root = test_root();
        let db = root.join(DB_FILE);
        let dest = root.join("out.kompass");
        let err = export_from_paths("parola", &db, &root, &dest).unwrap_err();
        assert!(err.contains("Veritabanı bulunamadı"));
        assert!(!dest.exists());
    }

    fn bak_sibling(path: &Path) -> PathBuf {
        bak_path(path)
    }

    #[test]
    fn replace_file_overwrites_existing_destination() {
        let root = test_root();
        let from = root.join("from");
        let to = root.join("to");
        fs::write(&from, b"new").unwrap();
        fs::write(&to, b"old").unwrap();
        replace_file(&from, &to).unwrap();
        assert_eq!(fs::read(&to).unwrap(), b"new");
        assert!(!from.exists());
        assert!(!bak_sibling(&to).exists());
    }

    #[test]
    fn replace_file_restores_dest_when_source_rename_fails() {
        let root = test_root();
        let from = root.join("from");
        let to = root.join("to");
        fs::write(&to, b"precious").unwrap();
        let err = replace_file(&from, &to).unwrap_err();
        assert!(err.contains("yazılamadı"), "unexpected error: {err}");
        assert_eq!(fs::read(&to).unwrap(), b"precious");
        assert!(!bak_sibling(&to).exists());
    }

    #[test]
    fn replace_file_keeps_source_when_dest_missing_after_failed_swap() {
        let root = test_root();
        let from = root.join("from");
        let to = root.join("to");
        fs::write(&from, b"last-copy").unwrap();
        fs::write(&to, b"old").unwrap();
        // Dest is a directory named the same as the target file after we move
        // the original aside — rename(file → occupied-by-dir) fails on all OS.
        // We force that by replacing `to` with a non-empty directory via the
        // aside path: create a blocker at the dest path *as a directory* that
        // cannot be replaced by a file rename. Here: missing parent of dest.
        let nested = root.join("missing-parent").join("to");
        let err = replace_file(&from, &nested).unwrap_err();
        assert!(err.contains("yazılamadı"), "unexpected error: {err}");
        assert!(from.exists(), "temp must survive when dest was never written");
        assert_eq!(fs::read(&from).unwrap(), b"last-copy");
    }

    #[test]
    fn export_overwrites_existing_dest_file() {
        let root = test_root();
        fs::write(root.join(DB_FILE), b"db").unwrap();
        let dest = root.join("out.kompass");
        fs::write(&dest, b"stale").unwrap();
        export_from_paths("parola", &root.join(DB_FILE), &root, &dest).unwrap();
        let files = open_backup("parola", &fs::read(&dest).unwrap()).unwrap();
        assert_eq!(files, vec![(DB_FILE.to_string(), b"db".to_vec())]);
    }

    #[test]
    fn export_omits_missing_optional_keys() {
        let root = test_root();
        fs::write(root.join(DB_FILE), b"db").unwrap();
        fs::write(root.join(SETTINGS_FILE), b"{}").unwrap();
        let dest = root.join("out.kompass");
        export_from_paths("parola", &root.join(DB_FILE), &root, &dest).unwrap();
        let files = open_backup("parola", &fs::read(&dest).unwrap()).unwrap();
        let names: Vec<&str> = files.iter().map(|(n, _)| n.as_str()).collect();
        assert!(names.contains(&"leadership.db"));
        assert!(names.contains(&"llm_settings.json"));
        assert!(!names.contains(&"claude_api_key"));
        assert!(!names.contains(&"openai_api_key"));
    }

    #[test]
    fn import_rejects_archive_without_db_and_leaves_local_files() {
        let root = test_root();
        let dest_db = root.join(DB_FILE);
        fs::write(&dest_db, b"old-db").unwrap();
        let key_path = root.join(CLAUDE_KEY_FILE);
        fs::write(&key_path, b"old-key").unwrap();
        let blob = seal_backup("parola", &[("llm_settings.json".into(), b"{}".to_vec())]).unwrap();
        let src = root.join("x.kompass");
        fs::write(&src, blob).unwrap();

        let err = import_from_paths("parola", &src, &dest_db, &root).unwrap_err();
        assert!(
            err.contains("veritabanı") || err.contains("Veritabanı"),
            "unexpected error: {err}"
        );
        assert_eq!(fs::read(&dest_db).unwrap(), b"old-db");
        assert_eq!(fs::read(&key_path).unwrap(), b"old-key");
    }

    #[test]
    fn import_removes_local_keys_not_in_archive() {
        let root = test_root();
        let db_path = root.join(DB_FILE);
        fs::write(&db_path, b"old-db").unwrap();
        fs::write(root.join(CLAUDE_KEY_FILE), b"local-claude").unwrap();
        fs::write(root.join(OPENAI_KEY_FILE), b"local-openai").unwrap();
        fs::write(root.join(SETTINGS_FILE), b"{\"provider\":\"openai\"}").unwrap();

        let staging = root.join("staging");
        fs::create_dir_all(&staging).unwrap();
        fs::write(staging.join(DB_FILE), b"new-db").unwrap();
        fs::write(
            staging.join(SETTINGS_FILE),
            b"{\"provider\":\"claude\"}",
        )
        .unwrap();
        let backup = root.join("only-settings.kompass");
        export_from_paths("parola", &staging.join(DB_FILE), &staging, &backup).unwrap();

        import_from_paths("parola", &backup, &db_path, &root).unwrap();

        assert_eq!(fs::read(&db_path).unwrap(), b"new-db");
        assert_eq!(
            fs::read(root.join(SETTINGS_FILE)).unwrap(),
            b"{\"provider\":\"claude\"}"
        );
        assert!(!root.join(CLAUDE_KEY_FILE).exists());
        assert!(!root.join(OPENAI_KEY_FILE).exists());
    }

    #[test]
    fn verify_accepts_correct_password_without_replacing_files() {
        let root = test_root();
        fs::write(root.join(DB_FILE), b"live-db").unwrap();
        let dest = root.join("out.kompass");
        export_from_paths("parola", &root.join(DB_FILE), &root, &dest).unwrap();
        fs::write(root.join(DB_FILE), b"changed-after-export").unwrap();

        verify_backup_from_path("parola", &dest).unwrap();

        assert_eq!(fs::read(root.join(DB_FILE)).unwrap(), b"changed-after-export");
    }

    #[test]
    fn verify_rejects_wrong_password_without_replacing_files() {
        let root = test_root();
        fs::write(root.join(DB_FILE), b"live-db").unwrap();
        let dest = root.join("out.kompass");
        export_from_paths("parola", &root.join(DB_FILE), &root, &dest).unwrap();

        let err = verify_backup_from_path("yanlis", &dest).unwrap_err();
        assert!(err.contains("Parola hatalı") || err.contains("bozuk"));
        assert_eq!(fs::read(root.join(DB_FILE)).unwrap(), b"live-db");
    }
}
