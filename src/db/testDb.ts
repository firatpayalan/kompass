import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export function openTestDb(): Database.Database {
  const db = new Database(":memory:");
  const schema = fs.readFileSync(
    path.join(currentDirectory, "schema.sql"),
    "utf8",
  );

  db.exec(schema);
  return db;
}
