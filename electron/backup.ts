import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { type DatabaseService } from "./database";
import { openBackup, sealBackup, type BackupFile } from "./backupFormat";
import { writeAtomic } from "./files";

const names = ["leadership.db", "llm_settings.json", "claude_api_key", "openai_api_key"] as const;
const recoveryName = ".kompass-restore";

/** Roll back a file swap interrupted by an application crash. */
export function recoverInterruptedImport(directory: string): void {
  const recovery = join(directory, recoveryName);
  const manifest = join(recovery, "manifest.json");
  if (!existsSync(manifest)) { rmSync(recovery, { recursive: true, force: true }); return; }
  const present: unknown = JSON.parse(readFileSync(manifest, "utf8"));
  if (!Array.isArray(present) || present.some((name) => !names.includes(name))) throw new Error("Yedek geri alma bilgisi bozuk");
  for (const name of names) {
    const dest = join(directory, name);
    if (present.includes(name)) writeAtomic(dest, readFileSync(join(recovery, name)));
    else rmSync(dest, { force: true });
  }
  for (const suffix of ["-wal", "-shm"]) rmSync(join(directory, `leadership.db${suffix}`), { force: true });
  rmSync(recovery, { recursive: true, force: true });
}

export class BackupService {
  constructor(private database: DatabaseService) {}

  private assertExternalPath(filename: string): void {
    const absolute = resolve(filename);
    if ([...names, "leadership.db-wal", "leadership.db-shm"].some((name) => absolute === resolve(this.database.directory, name))) {
      throw new Error("Yedek dosyası uygulamanın veritabanı veya ayar dosyası olamaz");
    }
  }

  private async readArchive(password: string, sourcePath: string): Promise<BackupFile[]> {
    this.assertExternalPath(sourcePath);
    const files = await openBackup(password, readFileSync(sourcePath));
    const database = files.find((file) => file.name === "leadership.db");
    if (!database) throw new Error("Yedekte veritabanı bulunamadı");
    if (database.data.subarray(0, 16).toString("binary") !== "SQLite format 3\x00") throw new Error("Yedekteki veritabanı geçersiz");
    return files.filter((file) => names.includes(file.name as typeof names[number]));
  }

  async verify(password: string, sourcePath: string): Promise<void> {
    await this.readArchive(password, sourcePath);
  }

  async export(password: string, destPath: string): Promise<void> {
    this.assertExternalPath(destPath);
    await this.database.initialize();
    this.database.checkpoint();
    const files = names.filter((name) => existsSync(join(this.database.directory, name)))
      .map((name) => ({ name, data: readFileSync(join(this.database.directory, name)) }));
    const blob = await sealBackup(password, files);
    writeAtomic(destPath, blob);
  }

  async import(password: string, sourcePath: string): Promise<void> {
    const files = await this.readArchive(password, sourcePath);
    const directory = this.database.directory;
    const recovery = join(directory, recoveryName);
    mkdirSync(recovery, { recursive: true, mode: 0o700 });
    const staged = join(recovery, "incoming.db");
    writeFileSync(staged, files.find((file) => file.name === "leadership.db")!.data, { mode: 0o600 });
    // Validate the actual SQLite contents before touching the live connection.
    try {
      const check = new DatabaseSync(staged, { readOnly: true });
      try {
        const result = check.prepare("PRAGMA quick_check").get();
        if (!result || Object.values(result)[0] !== "ok") throw new Error("Yedekteki veritabanı bozuk");
        if (!check.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'notes'").get()) throw new Error("Yedekte Kompass veritabanı bulunamadı");
      } finally { check.close(); }
      this.database.close();
      const present = names.filter((name) => existsSync(join(directory, name)));
      for (const name of present) writeFileSync(join(recovery, name), readFileSync(join(directory, name)), { mode: 0o600 });
      writeAtomic(join(recovery, "manifest.json"), JSON.stringify(present));
      for (const name of names) {
        const file = files.find((item) => item.name === name);
        if (file) writeAtomic(join(directory, name), file.data);
        else rmSync(join(directory, name), { force: true });
      }
      for (const suffix of ["-wal", "-shm"]) rmSync(`${this.database.filename}${suffix}`, { force: true });
      await this.database.initialize();
      rmSync(recovery, { recursive: true, force: true });
    } catch (error) {
      this.database.close();
      recoverInterruptedImport(directory);
      await this.database.initialize();
      throw error;
    } finally {
      // Retain a recovery journal if rollback itself failed.
      if (!existsSync(join(recovery, "manifest.json"))) rmSync(recovery, { recursive: true, force: true });
      for (const file of files) file.data.fill(0);
    }
  }
}
