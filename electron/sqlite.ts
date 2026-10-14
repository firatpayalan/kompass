import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { AsyncDb } from "../src/db/asyncDb";

export type NodeDatabase = AsyncDb & { close(): void; checkpoint(): void };

/** A single SQLite connection; nested repository transactions use savepoints. */
export function openNodeDatabase(filename: string): NodeDatabase {
  const database = new DatabaseSync(filename);
  database.exec("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
  let transactionId = 0;
  let depth = 0;
  const db: NodeDatabase = {
    async execute(sql, values = []) {
      database.prepare(sql).run(...values as SQLInputValue[]);
    },
    async select<T>(sql: string, values: unknown[] = []) {
      return database.prepare(sql).all(...values as SQLInputValue[]) as T[];
    },
    async withTransaction<T>(fn: (tx: AsyncDb) => Promise<T>): Promise<T> {
      const savepoint = `kompass_${++transactionId}`;
      const nested = depth > 0;
      database.exec(nested ? `SAVEPOINT ${savepoint}` : "BEGIN IMMEDIATE");
      depth++;
      try {
        const result = await fn(db);
        database.exec(nested ? `RELEASE SAVEPOINT ${savepoint}` : "COMMIT");
        return result;
      } catch (error) {
        database.exec(nested ? `ROLLBACK TO SAVEPOINT ${savepoint}; RELEASE SAVEPOINT ${savepoint}` : "ROLLBACK");
        throw error;
      } finally { depth--; }
    },
    checkpoint() { database.exec("PRAGMA wal_checkpoint(TRUNCATE)"); },
    close() { database.close(); },
  };
  return db;
}
