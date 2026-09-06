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

const DATABASE_URL = "sqlite:leadership.db";

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
    withTransaction<T>(fn: (tx: AsyncDb) => Promise<T>): Promise<T> {
      return enqueue(async () => {
        await database.execute("BEGIN");
        try {
          const result = await fn(transactionDb);
          await database.execute("COMMIT");
          return result;
        } catch (error) {
          await database.execute("ROLLBACK");
          throw error;
        }
      });
    },
  };
}

export async function connectAppDatabase(): Promise<AsyncDb> {
  const db = wrapTauriDatabase(await Database.load(DATABASE_URL));
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
