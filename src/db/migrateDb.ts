import { applySchema, type AsyncDb } from "./asyncDb";
import { ensurePeopleArchivedAt, ensurePeopleSortOrder } from "./peopleRepo";
import {
  ensurePeopleLabelId,
  ensurePersonLabels,
} from "./personLabelsRepo";
import { ensureInitiativesArchivedAt, ensureInitiativesSortOrder } from "./initiativesRepo";
import { ensureTopicsArchivedAt, ensureTopicsInitiativeOwner } from "./topicsRepo";
import { ensureNoteImagesTable } from "./noteImagesRepo";
import { ensureNoteTagsColor } from "./noteTagsRepo";
import { ensureInitiativeTagsSchema } from "./initiativeTagsRepo";
import { ensureTopicTagsSchema } from "./topicTagsRepo";
import { ensureWeeklySummariesTable } from "./weeklySummariesRepo";
import { ensureTodosSchema } from "./todosRepo";
import schemaSql from "./schema.sql?raw";


export async function migrateDatabase(db: AsyncDb): Promise<void> {
  await applySchema(db, schemaSql);
  // Must run before any topics query; schema IF NOT EXISTS leaves legacy tables
  // without initiative_id, and schema indexes on that column would fail if applied early.
  await ensureTopicsInitiativeOwner(db);
  await ensureTopicsArchivedAt(db);
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
  await ensureTodosSchema(db);
  // Reject an incompatible backup before it is accepted as the live database.
  await db.select("SELECT id, body, created_at, updated_at, deleted_at FROM notes LIMIT 0");
}
