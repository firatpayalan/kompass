# Encrypted Backup Export/Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Password-protected `.kompass` backup of SQLite + LLM settings/keys, with full-replace import from Ayarlar (v0.2.0).

**Architecture:** Pure Rust packs named files into a binary payload, encrypts with Argon2id + AES-256-GCM, writes a `.kompass` file. Tauri commands export/import against app data/config paths (checkpoint + `Database.close` before swap). React Ayarlar **Yedek** section drives dialogs, password fields, and confirm; after import, reset the JS DB singleton and reload the window.

**Tech Stack:** Tauri 2 + React/TS, Vitest, Rust unit tests (`cargo test`), AES-GCM/Argon2, `tauri-plugin-dialog` for save/open.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-09-encrypted-backup-design.md`
- Turkish UI: section **Yedek**, **Dışa aktar**, **İçe aktar**; confirm that this machine’s data and settings will be replaced; wrong password / corrupt file → clear Turkish errors; no partial replace.
- Full replace only (no merge). Include `leadership.db`, `llm_settings.json`, `claude_api_key`, `openai_api_key` (optional keys).
- Extension `.kompass`; Argon2id + AES-GCM (or equivalent AEAD); magic + format version header.
- Restore archive contents exactly; remove local key files not present in the archive.
- After import, do not keep using the old in-memory DB connection.
- Ship version **0.2.0** (`package.json`, `tauri.conf.json`, `Cargo.toml` / lock).
- **No new dependencies without asking the user** (approve Cargo/npm lists before `cargo add` / `npm install`).
- Commit only when the user explicitly asks (skip commit steps unless requested).

## File map

| File | Responsibility |
|------|----------------|
| `src-tauri/src/backup/mod.rs` | Module exports |
| `src-tauri/src/backup/format.rs` | Pack/unpack named files + encrypt/decrypt `.kompass` bytes |
| `src-tauri/src/backup/commands.rs` | Tauri `export_backup` / `import_backup` (paths, checkpoint, file IO) |
| `src-tauri/src/lib.rs` | Register module + commands; init dialog plugin |
| `src-tauri/Cargo.toml` | Crypto (+ dialog) crates |
| `src-tauri/capabilities/default.json` | Dialog permissions |
| `src/lib/backupBridge.ts` | TS invoke wrappers |
| `src/db/appDb.ts` | `resetAppDb()` to clear singleton |
| `src/db/connection.ts` | Optional `close` helper / checkpoint via SQL |
| `src/views/AyarlarView.tsx` | Yedek UI |
| `src/styles.css` | Minimal Yedek form styles if needed |
| `tests/backup-ayarlar-ui.test.tsx` | UI flows with mocked bridge |
| `package.json` / lock | `@tauri-apps/plugin-dialog` when approved |
| Version files | Bump to 0.2.0 in Task 4 |

## Dependency gate (before Task 1 implementation)

Ask the user to approve this exact set (do not add others without asking again):

**Cargo (src-tauri):** `argon2`, `aes-gcm`, `rand`, `zeroize`

**Later Task 2:** `tauri-plugin-dialog` (Cargo) + `@tauri-apps/plugin-dialog` (npm, same major as other Tauri 2 plugins)

---

### Task 1: `.kompass` format (pack + encrypt) — pure Rust

**Files:**
- Create: `src-tauri/src/backup/mod.rs`
- Create: `src-tauri/src/backup/format.rs`
- Modify: `src-tauri/src/lib.rs` — `mod backup;`
- Modify: `src-tauri/Cargo.toml` — approved crypto crates only
- Tests: `cargo test` in `src-tauri` (tests live in `format.rs` with `#[cfg(test)]`)

**Interfaces:**
- Consumes: approved crates
- Produces:
  - `pub fn seal_backup(password: &str, files: &[(String, Vec<u8>)]) -> Result<Vec<u8>, String>`
  - `pub fn open_backup(password: &str, blob: &[u8]) -> Result<Vec<(String, Vec<u8>)>, String>`
  - File names used later: `"leadership.db"`, `"llm_settings.json"`, `"claude_api_key"`, `"openai_api_key"`
  - On-disk layout (version 1):
    - magic: `b"KMPS"` (4 bytes)
    - `format_version: u8` = `1`
    - `salt: [u8; 16]`
    - `nonce: [u8; 12]`
    - ciphertext: AES-256-GCM over plaintext payload
  - Plaintext payload (before encrypt):
    - `file_count: u32` big-endian
    - for each file: `name_len: u16` BE, `name` UTF-8, `data_len: u64` BE, `data` bytes
  - KDF: Argon2id (use `argon2` crate defaults suitable for interactive use; document params in a short comment). Derive 32-byte key.
  - Errors (Turkish strings): `"Parola hatalı veya dosya bozuk"`, `"Desteklenmeyen yedek biçimi"`, `"Parola boş olamaz"`

- [ ] **Step 0: Confirm crypto crates with the user**

If not already approved in-session, stop and ask. After approval, add to `src-tauri/Cargo.toml` / lock via `cargo add`.

- [ ] **Step 1: Write failing Rust tests**

In `src-tauri/src/backup/format.rs` (or `#[cfg(test)] mod tests`):

```rust
#[test]
fn roundtrip_preserves_files() {
    let files = vec![
        ("leadership.db".into(), b"SQLite...".to_vec()),
        ("llm_settings.json".into(), br#"{"provider":"claude"}"#.to_vec()),
        ("claude_api_key".into(), b"sk-test".to_vec()),
    ];
    let blob = seal_backup("gizli-parola", &files).expect("seal");
    assert_eq!(&blob[..4], b"KMPS");
    assert_eq!(blob[4], 1);
    let opened = open_backup("gizli-parola", &blob).expect("open");
    assert_eq!(opened, files);
}

#[test]
fn wrong_password_fails() {
    let blob = seal_backup("dogru", &[("a".into(), b"b".to_vec())]).unwrap();
    let err = open_backup("yanlis", &blob).unwrap_err();
    assert!(err.contains("Parola hatalı") || err.contains("bozuk"));
}

#[test]
fn empty_password_rejected() {
    let err = seal_backup("", &[]).unwrap_err();
    assert!(err.contains("Parola boş"));
}

#[test]
fn bad_magic_rejected() {
    let err = open_backup("x", b"XXXX........").unwrap_err();
    assert!(err.contains("Desteklenmeyen") || err.contains("biçimi"));
}
```

Wire `mod backup;` in `lib.rs` so tests compile (commands can be empty stubs later).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `cd src-tauri && cargo test --backup 2>&1` or `cargo test format::`

Expected: compile errors / missing `seal_backup`.

- [ ] **Step 3: Implement `format.rs`**

Implement pack → encrypt → prepend header; decrypt → unpack. Use `zeroize` on key material where practical. Reject empty password on seal and open.

Minimal `mod.rs`:

```rust
pub mod format;
pub use format::{open_backup, seal_backup};
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `cd src-tauri && cargo test`

Expected: new backup tests PASS.

- [ ] **Step 5: Commit** (only if user asked)

```bash
git add src-tauri/src/backup src-tauri/src/lib.rs src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "$(cat <<'EOF'
feat: add encrypted .kompass backup format

EOF
)"
```

---

### Task 2: Tauri export/import commands + dialog plugin

**Files:**
- Create: `src-tauri/src/backup/commands.rs`
- Modify: `src-tauri/src/backup/mod.rs`
- Modify: `src-tauri/src/lib.rs` — register commands + dialog plugin
- Modify: `src-tauri/capabilities/default.json` — dialog permissions
- Modify: `src-tauri/Cargo.toml` — `tauri-plugin-dialog`
- Modify: `package.json` / `package-lock.json` — `@tauri-apps/plugin-dialog`
- Create: `src/lib/backupBridge.ts`
- Modify: `src/db/connection.ts` — export `DATABASE_URL` or a checkpoint helper used from JS before export (optional); prefer checkpoint inside Rust via reopening or documenting that FE must call SQL checkpoint first
- Tests: Rust unit test for “restore removes missing keys” logic if extracted as pure fn; FE bridge can be thin

**Interfaces:**
- Consumes: `seal_backup` / `open_backup`; `AppHandle` paths like `llm.rs` (`app_config_dir`, `app_data_dir`)
- Produces (Rust):
  - `#[tauri::command] pub async fn export_backup(app: AppHandle, password: String, dest_path: String) -> Result<(), String>`
  - `#[tauri::command] pub async fn import_backup(app: AppHandle, password: String, source_path: String) -> Result<(), String>`
- Produces (TS `backupBridge.ts`):
  - `exportBackup(password: string, destPath: string): Promise<void>`
  - `importBackup(password: string, sourcePath: string): Promise<void>`
  - Dialog helpers wrapping `@tauri-apps/plugin-dialog` `save` / `open`

**Path conventions (match plugin-sql + llm.rs):**
- DB: `app.path().app_data_dir()? / "leadership.db"` (verify against Tauri SQL plugin default for `sqlite:leadership.db` on macOS; if the live file is elsewhere, locate the same path the running app uses — check plugin docs / existing data dir under `~/Library/Application Support/com.dailyleadership.tool/`)
- Config files: same dir as `llm.rs` `config_dir` — `app_config_dir()` + `llm_settings.json`, `claude_api_key`, `openai_api_key`

**Export algorithm:**
1. Reject empty password (Turkish).
2. Ensure DB file exists (or create empty error “Veritabanı bulunamadı”).
3. Consistency: from the frontend before invoke, run `PRAGMA wal_checkpoint(FULL);` via existing `db.execute` if WAL is used; also prefer copying via SQLite backup if available. Minimum: checkpoint from FE then Rust copies file bytes.
4. Read DB bytes + optional config files into `Vec<(String, Vec<u8>)>` (omit missing optional keys).
5. Always include `llm_settings.json` if present; if missing, include `{}` or skip — prefer include only if file exists (import must still clear keys not in archive).
6. `seal_backup` → write atomically to `dest_path` (write temp beside dest then rename).

**Import algorithm:**
1. Read file → `open_backup`.
2. Require `"leadership.db"` entry; else error.
3. Write DB to a temp path in app data dir, then rename over `leadership.db` (after FE has closed the SQL plugin connection — see Task 3).
4. For settings/keys: write each present entry; **delete** local `claude_api_key` / `openai_api_key` / `llm_settings.json` if not in the archive (exact match to backup).
5. Do not leave half-written state: if any step fails after open succeeds, prefer failing before renaming over the live DB (write temps first, then swap).

- [ ] **Step 0: Confirm dialog dependency with the user**

Approve `tauri-plugin-dialog` + `@tauri-apps/plugin-dialog`, then install.

- [ ] **Step 1: Add plugin wiring**

`lib.rs`:

```rust
.plugin(tauri_plugin_dialog::init())
.invoke_handler(tauri::generate_handler![
    // existing llm::...
    backup::commands::export_backup,
    backup::commands::import_backup,
])
```

`capabilities/default.json` — add dialog permissions per Tauri 2 dialog plugin docs (e.g. `dialog:default` or allow-save/allow-open).

- [ ] **Step 2: Implement commands + bridge**

Implement `commands.rs` as above. `backupBridge.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";

export async function pickExportPath(): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);
  return save({
    defaultPath: `kompass-yedek-${today}.kompass`,
    filters: [{ name: "Kompass yedek", extensions: ["kompass"] }],
  });
}

export async function pickImportPath(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    filters: [{ name: "Kompass yedek", extensions: ["kompass"] }],
  });
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected;
}

export function exportBackup(password: string, destPath: string) {
  return invoke<void>("export_backup", { password, destPath });
}

export function importBackup(password: string, sourcePath: string) {
  return invoke<void>("import_backup", { password, sourcePath });
}
```

(Match Rust arg names: camelCase from TS → serde; use `destPath` / `sourcePath` with `#[serde(rename_all = "camelCase")]` on a params struct **or** snake_case invoke keys consistent with existing `llmBridge` — **follow existing `invoke` style in `llmBridge.ts`**.)

- [ ] **Step 3: Manual / cargo check**

Run: `cd src-tauri && cargo check`

Expected: success.

- [ ] **Step 4: Commit** (only if user asked)

---

### Task 3: Ayarlar Yedek UI + DB reset after import

**Files:**
- Modify: `src/views/AyarlarView.tsx`
- Modify: `src/db/appDb.ts` — add `resetAppDb()`
- Modify: `src/db/connection.ts` / `appDb` — expose way to close plugin connection before import
- Modify: `src/styles.css` — only if needed for password fields in Yedek card
- Create: `tests/backup-ayarlar-ui.test.tsx`
- Modify: any App bootstrap if reload is insufficient

**Interfaces:**
- Consumes: `backupBridge` + existing `ConfirmDialog` + `formatError` + `getDb()` for checkpoint/close
- Produces: Yedek section UX per spec

**`resetAppDb`:**

```ts
export async function resetAppDb(): Promise<void> {
  appDb = null;
  pendingInit = null;
  await initAppDb();
}
```

Before import, close SQL: `Database` from plugin-sql — if `getDb` doesn’t expose close, add `closeAppDatabase()` that invokes plugin close on the loaded URL (`sql:allow-close` already in capabilities). Pattern: keep a module-level handle in `connection.ts` or call `invoke`/`Database.load` then `.close()`.

**UI flow (Ayarlar):**

New wide card **Yedek**:
- Short hint: yedek şifreli `.kompass`; API anahtarlarını da içerir.
- Export: password + confirm inputs; button **Dışa aktar** → validate match/non-empty → checkpoint → `pickExportPath` → `exportBackup` → toast **Yedek kaydedildi**
- Import: password input; button **İçe aktar** → `pickImportPath` → open `ConfirmDialog` title **Yedeği içe aktar**, message about full replace, confirmLabel **İçe aktar** → close DB → `importBackup` → `resetAppDb` → `window.location.reload()` (simplest safe refresh) → toast before reload if possible

Inject `backup?: BackupBridge` prop for tests (default real bridge), same pattern as `llm?: LlmBridge`.

- [ ] **Step 1: Write failing UI tests**

`tests/backup-ayarlar-ui.test.tsx`:

```tsx
// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AyarlarView from "../src/views/AyarlarView";

afterEach(cleanup);

const llm = {
  hasClaudeApiKey: vi.fn().mockResolvedValue(false),
  hasOpenaiApiKey: vi.fn().mockResolvedValue(false),
  saveClaudeApiKey: vi.fn(),
  clearClaudeApiKey: vi.fn(),
  saveOpenaiApiKey: vi.fn(),
  clearOpenaiApiKey: vi.fn(),
  getLlmSettings: vi.fn().mockResolvedValue({
    provider: "claude",
    model: "claude-sonnet-4-20250514",
    baseUrl: "",
  }),
  setLlmSettings: vi.fn(),
};

describe("Ayarlar Yedek", () => {
  it("exports after matching passwords", async () => {
    const backup = {
      pickExportPath: vi.fn().mockResolvedValue("/tmp/t.kompass"),
      pickImportPath: vi.fn(),
      exportBackup: vi.fn().mockResolvedValue(undefined),
      importBackup: vi.fn(),
      checkpointAndCloseDb: vi.fn().mockResolvedValue(undefined),
      resetAfterImport: vi.fn().mockResolvedValue(undefined),
    };
    render(<AyarlarView llm={llm as never} backup={backup as never} onToast={vi.fn()} />);
    // fill export password fields (aria-labels: "Yedek parolası", "Yedek parolası (tekrar)")
    fireEvent.change(screen.getByLabelText("Yedek parolası"), {
      target: { value: "sifre123" },
    });
    fireEvent.change(screen.getByLabelText("Yedek parolası (tekrar)"), {
      target: { value: "sifre123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Dışa aktar" }));
    await waitFor(() => {
      expect(backup.exportBackup).toHaveBeenCalledWith("sifre123", "/tmp/t.kompass");
    });
  });

  it("confirms before import", async () => {
    const backup = {
      pickExportPath: vi.fn(),
      pickImportPath: vi.fn().mockResolvedValue("/tmp/t.kompass"),
      exportBackup: vi.fn(),
      importBackup: vi.fn().mockResolvedValue(undefined),
      checkpointAndCloseDb: vi.fn().mockResolvedValue(undefined),
      resetAfterImport: vi.fn().mockResolvedValue(undefined),
    };
    const onToast = vi.fn();
    render(<AyarlarView llm={llm as never} backup={backup as never} onToast={onToast} />);
    fireEvent.change(screen.getByLabelText("İçe aktarım parolası"), {
      target: { value: "sifre123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "İçe aktar" }));
    expect(await screen.findByRole("heading", { name: "Yedeği içe aktar" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "İçe aktar" })); // confirm in dialog — if duplicate names, use within(dialog)
    await waitFor(() => {
      expect(backup.importBackup).toHaveBeenCalledWith("sifre123", "/tmp/t.kompass");
    });
  });
});
```

Adjust selectors to match implementation; keep Turkish copy from the spec.

- [ ] **Step 2: Run UI test — expect FAIL**

Run: `npm test -- tests/backup-ayarlar-ui.test.tsx`

- [ ] **Step 3: Implement UI + reset/close helpers**

Implement card + bridge methods used by the view. Prefer putting `checkpointAndCloseDb` / `resetAfterImport` on the injectable backup facade so tests don’t touch real SQL.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/backup-ayarlar-ui.test.tsx tests/hafta-ayarlar-ui.test.tsx`

- [ ] **Step 5: Commit** (only if user asked)

---

### Task 4: Bump to v0.2.0

**Files:**
- Modify: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`

- [ ] **Step 1: Bump versions to `0.2.0`**

Same procedure as prior releases (`cargo update -p daily-leadership-tool`).

- [ ] **Step 2: Smoke**

Run: `npm test` (or focused suites) and `cd src-tauri && cargo test`

Expected: PASS.

- [ ] **Step 3: Commit** (only if user asked)

```bash
git commit -m "$(cat <<'EOF'
Bump version to v0.2.0 for encrypted backup release.

EOF
)"
```

Do **not** create GitHub release / tag unless the user asks.

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| SQLite + settings + API keys in backup | Task 2 |
| Ayarlar → Yedek export/import UI | Task 3 |
| Password + confirm on export | Task 3 |
| Save/open dialogs; default filename | Task 2–3 |
| Import confirm full replace | Task 3 |
| Wrong password / corrupt → Turkish error, no partial replace | Task 1–2 |
| `.kompass` Argon2id + AES-GCM + magic/version | Task 1 |
| Checkpoint before export | Task 2–3 |
| Exact restore; remove missing keys | Task 2 |
| Reconnect / no stale DB | Task 3 |
| Version 0.2.0 | Task 4 |
| Ask before new deps | Task 1–2 gates |
