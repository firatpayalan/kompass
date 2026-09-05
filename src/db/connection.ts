import Database from "@tauri-apps/plugin-sql";

import { applySchema, type AsyncDb } from "./asyncDb";
import { ensurePeopleSortOrder } from "./peopleRepo";
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
  await ensurePeopleSortOrder(db);
  return db;
}
