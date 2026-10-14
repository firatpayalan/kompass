import { DatabaseSync } from "node:sqlite";
import { openNodeDatabase } from "../../electron/sqlite";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BUILTIN_PERSON_LABELS } from "../lib/personLabels";
import { splitSqlStatements, type AsyncDb } from "./asyncDb";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export type TestAsyncDb = AsyncDb & {
  close(): void;
};

export function readSchemaSql(): string {
  return fs.readFileSync(path.join(currentDirectory, "schema.sql"), "utf8");
}

export function openTestDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");

  db.exec(readSchemaSql());
  const seed = db.prepare(
    `INSERT OR IGNORE INTO person_labels (name, color, created_at)
     VALUES (?, ?, ?)`,
  );
  const nowIso = "2026-09-05T00:00:00.000Z";
  for (const builtin of BUILTIN_PERSON_LABELS) {
    seed.run(builtin.name, builtin.color, nowIso);
  }
  return db;
}

export function openTestAsyncDb(): TestAsyncDb {
  const db = openNodeDatabase(":memory:");
  // Match production's connection and real transactions in repository tests.
  for (const statement of splitSqlStatements(readSchemaSql())) {
    void db.execute(statement);
  }
  for (const builtin of BUILTIN_PERSON_LABELS) {
    void db.execute(
      "INSERT OR IGNORE INTO person_labels (name, color, created_at) VALUES (?, ?, ?)",
      [builtin.name, builtin.color, "2026-09-05T00:00:00.000Z"],
    );
  }
  return db;
}
