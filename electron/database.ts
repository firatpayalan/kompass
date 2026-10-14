import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { createAppDb, type AppDb } from "../src/db/createAppDb";
import { migrateDatabase } from "../src/db/migrateDb";
import { openNodeDatabase, type NodeDatabase } from "./sqlite";

/** All repository calls, migrations and backup swaps share this queue. */
export class DatabaseService {
  private db: NodeDatabase | null = null;
  private repos: AppDb | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private paused = false;
  readonly filename: string;

  constructor(readonly directory: string) { this.filename = join(directory, "leadership.db"); }

  exclusive<T>(operation: () => Promise<T> | T): Promise<T> {
    const result = this.queue.then(operation, operation);
    this.queue = result.catch(() => undefined);
    return result;
  }

  async initialize(): Promise<void> {
    if (this.db) { this.paused = false; return; }
    mkdirSync(this.directory, { recursive: true, mode: 0o700 });
    const db = openNodeDatabase(this.filename);
    try {
      await migrateDatabase(db);
      this.db = db;
      this.repos = createAppDb(db);
      this.paused = false;
    } catch (error) { db.close(); throw error; }
  }

  async call(method: string, args: unknown[]): Promise<unknown> {
    if (this.paused) throw new Error("Yedek geri yükleniyor; lütfen bekleyin.");
    await this.initialize();
    if (!Object.hasOwn(this.repos!, method) || !Array.isArray(args)) throw new Error("Geçersiz veritabanı işlemi");
    const operation = this.repos![method as keyof AppDb] as (...args: unknown[]) => Promise<unknown>;
    return operation(...args);
  }

  checkpoint(): void {
    if (!this.db) throw new Error("Veritabanı hazır değil");
    this.db.checkpoint();
  }

  close(): void {
    this.db?.checkpoint();
    this.db?.close();
    this.db = null;
    this.repos = null;
    this.paused = true;
  }
}
