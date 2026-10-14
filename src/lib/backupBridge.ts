import { desktopRequest } from "./desktop";
import { resetAppDb } from "../db/appDb";
import {
  checkpointAppDatabase,
  closeAppDatabase,
} from "../db/connection";

export function pickExportPath(): Promise<string | null> {
  return desktopRequest("backup.pickExport");
}

export function pickImportPath(): Promise<string | null> {
  return desktopRequest("backup.pickImport");
}

export function exportBackup(password: string, destPath: string) {
  return desktopRequest("backup.export", { password, destPath });
}

export function importBackup(password: string, sourcePath: string) {
  return desktopRequest("backup.import", { password, sourcePath });
}

/** Decrypts the archive only; does not close the live DB or replace files. */
export function verifyBackupPassword(password: string, sourcePath: string) {
  return desktopRequest("backup.verify", { password, sourcePath });
}

/** Flush WAL into `leadership.db` without closing the Node SQLite connection. */
export async function checkpointDb(): Promise<void> {
  await checkpointAppDatabase();
}

/** Close the Node SQLite connection so import can replace `leadership.db` on disk. */
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
