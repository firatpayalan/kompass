# Encrypted backup export / import (v0.2.0)

## Goal

Let the user move Kompass data between machines (e.g. company laptop swap) via a password-protected backup file that includes the SQLite database and LLM settings/API keys.

## Scope

**Included in the backup**
- `leadership.db` (notes, images, people, initiatives, reminders, archive, tags, etc.)
- `llm_settings.json`
- `claude_api_key` and `openai_api_key` (if present)

**Out of scope**
- Plaintext / unencrypted export
- Merge import (only full replace)
- Cloud / automatic backup
- Selective export of subsets
- Cross-version schema migration beyond “same or newer app opens the restored DB” (document if older app may fail)

## UI (Ayarlar → Yedek)

- Section **Yedek** on Ayarlar
- **Dışa aktar**
  - Prompt for password + confirm password (must match, non-empty)
  - Native save dialog; default name `kompass-yedek-YYYY-MM-DD.kompass`
  - Toast on success / Turkish error on failure
- **İçe aktar**
  - Native open dialog (`.kompass`)
  - Password prompt
  - Confirm dialog: current data and settings on this machine will be replaced by the backup
  - On success: replace files, reconnect DB / reload app state (restart window if reconnect is unsafe); toast
  - Wrong password or corrupt file → clear Turkish error; no partial replace

## Format

- Extension: `.kompass`
- Encrypted package (Argon2id + AES-GCM or equivalent AEAD) containing the files above
- Only Kompass decrypts/opens it; not a standard zip
- Magic / version header so future format bumps can be detected

## Behavior details

- Export: flush/checkpoint SQLite before copying so the file is consistent
- Import: full replace of the listed files; missing optional key files in the backup clear local keys if the backup intentionally omitted them (or only overwrite keys that exist in the archive — prefer: restore exactly what the archive contains for settings/keys, and remove local key files not present in the archive so the target matches the backup)
- After import, the running app must not keep using the old in-memory DB connection

## Version

- Ship as **minor** version **0.2.0** (bump `package.json`, `tauri.conf.json`, `Cargo.toml` / lock)

## Dependencies

- May add Tauri dialog plugin and Rust crypto/archive crates; ask before adding npm/Cargo dependencies during implementation
