import { describe, expect, it } from "vitest";

import { createInitiative } from "../src/db/initiativesRepo";
import { createNote } from "../src/db/notesRepo";
import {
  archiveTopic,
  createTopic,
  ensureTopicsArchivedAt,
  ensureTopicsInitiativeOwner,
  listArchivedTopics,
  listTopicsWithNotesForInitiative,
  restoreTopic,
} from "../src/db/topicsRepo";
import { openTestAsyncDb, readSchemaSql } from "../src/db/testDb";

describe("topic archive", () => {
  it("archives a topic, hides it from the initiative, and restores it", async () => {
    const db = openTestAsyncDb();
    await ensureTopicsInitiativeOwner(db);
    await ensureTopicsArchivedAt(db);

    const initiative = await createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      nowIso: "2026-09-06T09:00:00.000Z",
    });
    const topic = await createTopic(db, {
      initiativeId: initiative.id,
      title: "RFC",
      nowIso: "2026-09-06T10:00:00.000Z",
    });
    const note = await createNote(db, {
      body: "RFC taslağı",
      initiativeIds: [initiative.id],
      topicIds: [topic.id],
      nowIso: "2026-09-06T10:05:00.000Z",
    });

    await archiveTopic(db, topic.id, "2026-09-06T11:00:00.000Z");

    const active = await listTopicsWithNotesForInitiative(db, initiative.id);
    expect(active.topics).toHaveLength(0);
    expect(active.untopicNotes.map((item) => item.id)).not.toContain(note.id);

    const archived = await listArchivedTopics(db);
    expect(archived).toEqual([
      expect.objectContaining({
        id: topic.id,
        title: "RFC",
        ownerKind: "initiative",
        ownerName: "Lansman",
        archivedAt: "2026-09-06T11:00:00.000Z",
      }),
    ]);

    const restored = await restoreTopic(db, topic.id);
    expect(restored.archivedAt).toBeNull();

    const after = await listTopicsWithNotesForInitiative(db, initiative.id);
    expect(after.topics).toHaveLength(1);
    expect(after.topics[0].notes.map((item) => item.id)).toEqual([note.id]);
    expect(await listArchivedTopics(db)).toEqual([]);

    db.close();
  });

  it("allows recreating a title after the previous topic was archived", async () => {
    const db = openTestAsyncDb();
    await ensureTopicsInitiativeOwner(db);
    await ensureTopicsArchivedAt(db);

    const initiative = await createInitiative(db, {
      name: "Atlas",
      status: "aktif",
      nowIso: "2026-09-06T09:00:00.000Z",
    });
    const first = await createTopic(db, {
      initiativeId: initiative.id,
      title: "RFC",
      nowIso: "2026-09-06T10:00:00.000Z",
    });
    await archiveTopic(db, first.id, "2026-09-06T11:00:00.000Z");

    const second = await createTopic(db, {
      initiativeId: initiative.id,
      title: "RFC",
      nowIso: "2026-09-06T12:00:00.000Z",
    });
    expect(second.id).not.toBe(first.id);

    await expect(restoreTopic(db, first.id)).rejects.toThrow(
      "Bu isimde aktif bir konu var",
    );
    db.close();
  });

  it("adds archived_at on legacy topic tables", async () => {
    const db = openTestAsyncDb();
    // Simulate pre-archive schema by dropping and recreating without archived_at
    await db.execute("DROP TABLE IF EXISTS note_topics");
    await db.execute("DROP TABLE IF EXISTS topic_tag_links");
    await db.execute("DROP TABLE IF EXISTS topics");
    await db.execute(`
      CREATE TABLE topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER,
        initiative_id INTEGER,
        title TEXT NOT NULL COLLATE NOCASE,
        created_at TEXT NOT NULL,
        CHECK (
          (person_id IS NOT NULL AND initiative_id IS NULL)
          OR (person_id IS NULL AND initiative_id IS NOT NULL)
        )
      )
    `);
    await ensureTopicsArchivedAt(db);
    const columns = await db.select<{ name: string }>("PRAGMA table_info(topics)");
    expect(columns.some((column) => column.name === "archived_at")).toBe(true);
    db.close();
  });
});
