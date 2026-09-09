import Database from "@tauri-apps/plugin-sql";

import { applySchema, type AsyncDb } from "./asyncDb";
import { ensurePeopleArchivedAt, ensurePeopleSortOrder } from "./peopleRepo";
import {
  ensurePeopleLabelId,
  ensurePersonLabels,
} from "./personLabelsRepo";
import { ensureInitiativesArchivedAt, ensureInitiativesSortOrder } from "./initiativesRepo";
import { ensureTopicsInitiativeOwner } from "./topicsRepo";
import { ensureNoteImagesTable } from "./noteImagesRepo";
import { ensureNoteTagsColor } from "./noteTagsRepo";
import { ensureInitiativeTagsSchema } from "./initiativeTagsRepo";
import { ensureTopicTagsSchema } from "./topicTagsRepo";
import { ensureWeeklySummariesTable } from "./weeklySummariesRepo";
import schemaSql from "./schema.sql?raw";

/** plugin-sql stores this file under `app_config_dir()` as `leadership.db`. */
export const DATABASE_URL = "sqlite:leadership.db";

let pluginDatabase: Database | null = null;
let liveDb: AsyncDb | null = null;

/** Flush WAL into `leadership.db` before Rust copies file bytes for export. */
export async function checkpointAppDatabase(db?: AsyncDb): Promise<void> {
  const target = db ?? liveDb;
  if (!target) {
    throw new Error("Veritabanı hazır değil");
  }
  await target.execute("PRAGMA wal_checkpoint(FULL);");
}

/** Close the plugin-sql pool so import can replace `leadership.db` on disk. */
export async function closeAppDatabase(): Promise<void> {
  if (!pluginDatabase) return;
  await pluginDatabase.close();
  pluginDatabase = null;
  liveDb = null;
}

function wrapTauriDatabase(database: Database): AsyncDb {
  let operationQueue = Promise.resolve();

  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = operationQueue.then(operation, operation);
    operationQueue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  const transactionDb: AsyncDb = {
    async execute(sql, bindValues = []) {
      await database.execute(sql, bindValues);
    },
    select(sql, bindValues = []) {
      return database.select(sql, bindValues);
    },
    async withTransaction<T>(
      fn: (tx: AsyncDb) => Promise<T>,
    ): Promise<T> {
      return fn(transactionDb);
    },
  };

  return {
    execute(sql, bindValues = []) {
      return enqueue(() => transactionDb.execute(sql, bindValues));
    },
    select(sql, bindValues = []) {
      return enqueue(() => transactionDb.select(sql, bindValues));
    },
    // Do NOT issue BEGIN/COMMIT/ROLLBACK via separate plugin-sql execute()
    // calls. sqlx pools each statement onto its own connection, so those
    // commands often land on different connections and fail with
    // "cannot commit - no transaction is active" (and can leave an orphaned
    // write lock). Serialize work on the JS queue instead until the plugin
    // exposes a real transaction API or SQLite is pinned to max_connections(1).
    withTransaction<T>(fn: (tx: AsyncDb) => Promise<T>): Promise<T> {
      return enqueue(() => fn(transactionDb));
    },
  };
}

export async function connectAppDatabase(): Promise<AsyncDb> {
  const database = await Database.load(DATABASE_URL);
  pluginDatabase = database;
  const db = wrapTauriDatabase(database);
  liveDb = db;
  await applySchema(db, schemaSql);
  // Must run before any topics query; schema IF NOT EXISTS leaves legacy tables
  // without initiative_id, and schema indexes on that column would fail if applied early.
  await ensureTopicsInitiativeOwner(db);
  await ensurePersonLabels(db);
  await ensurePeopleSortOrder(db);
  await ensurePeopleArchivedAt(db);
  await ensurePeopleLabelId(db);
  await ensureInitiativesSortOrder(db);
  await ensureInitiativesArchivedAt(db);
  await ensureTopicTagsSchema(db);
  await ensureInitiativeTagsSchema(db);
  await ensureNoteTagsColor(db);
  await ensureNoteImagesTable(db);
  await ensureWeeklySummariesTable(db);
  return db;
}
