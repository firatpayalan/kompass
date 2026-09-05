import Database from "@tauri-apps/plugin-sql";

import { applySchema, type AsyncDb } from "./asyncDb";
import schemaSql from "./schema.sql?raw";

const DATABASE_URL = "sqlite:leadership.db";

function wrapTauriDatabase(database: Database): AsyncDb {
  return {
    async execute(sql, bindValues = []) {
      await database.execute(sql, bindValues);
    },
    select(sql, bindValues = []) {
      return database.select(sql, bindValues);
    },
  };
}

export async function connectAppDatabase(): Promise<AsyncDb> {
  const db = wrapTauriDatabase(await Database.load(DATABASE_URL));
  await applySchema(db, schemaSql);
  return db;
}
