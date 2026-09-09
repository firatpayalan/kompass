import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { resetAppDb } from "../db/appDb";
import {
  checkpointAppDatabase,
  closeAppDatabase,
} from "../db/connection";

function localDateStamp(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function pickExportPath(): Promise<string | null> {
  const today = localDateStamp();
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

/** Decrypts the archive only; does not close the live DB or replace files. */
export function verifyBackupPassword(password: string, sourcePath: string) {
  return invoke<void>("verify_backup_password", { password, sourcePath });
}

/** Flush WAL into `leadership.db` without closing the plugin-sql pool. */
export async function checkpointDb(): Promise<void> {
  await checkpointAppDatabase();
}

/** Close the plugin-sql pool so import can replace `leadership.db` on disk. */
export async function closeLiveDb(): Promise<void> {
  await closeAppDatabase();
}

export async function reconnectDb(): Promise<void> {
  await resetAppDb();
}

export function reloadApp(): void {
  window.location.reload();
}

export async function resetAfterImport(): Promise<void> {
  await resetAppDb();
  reloadApp();
}

export type BackupBridge = {
  pickExportPath: typeof pickExportPath;
  pickImportPath: typeof pickImportPath;
  exportBackup: typeof exportBackup;
  importBackup: typeof importBackup;
  verifyBackupPassword: typeof verifyBackupPassword;
  checkpointDb: typeof checkpointDb;
  closeLiveDb: typeof closeLiveDb;
  resetAfterImport: typeof resetAfterImport;
  reconnectDb: typeof reconnectDb;
  reloadApp: typeof reloadApp;
};

export const defaultBackupBridge: BackupBridge = {
  pickExportPath,
  pickImportPath,
  exportBackup,
  importBackup,
  verifyBackupPassword,
  checkpointDb,
  closeLiveDb,
  resetAfterImport,
  reconnectDb,
  reloadApp,
};
