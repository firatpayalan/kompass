import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { AsyncDb } from "./asyncDb";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export type TestAsyncDb = AsyncDb & {
  close(): void;
};

export function readSchemaSql(): string {
  return fs.readFileSync(path.join(currentDirectory, "schema.sql"), "utf8");
}

export function openTestDb(): Database.Database {
  const db = new Database(":memory:");

  db.exec(readSchemaSql());
  return db;
}

export function openTestAsyncDb(): TestAsyncDb {
  const db = openTestDb();

  const transactionDb: AsyncDb = {
    async execute(sql, bindValues = []) {
      db.prepare(sql).run(...bindValues);
    },
    async select<T>(sql: string, bindValues: unknown[] = []) {
      return db.prepare(sql).all(...bindValues) as T[];
    },
    async withTransaction<T>(
      fn: (tx: AsyncDb) => Promise<T>,
    ): Promise<T> {
      return fn(transactionDb);
    },
  };

  return {
    ...transactionDb,
    async withTransaction<T>(
      fn: (tx: AsyncDb) => Promise<T>,
    ): Promise<T> {
      db.exec("BEGIN");
      try {
        const result = await fn(transactionDb);
        db.exec("COMMIT");
        return result;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}
