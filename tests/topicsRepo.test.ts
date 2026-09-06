import { describe, expect, it } from "vitest";

import { applySchema } from "../src/db/asyncDb";
import { createInitiative } from "../src/db/initiativesRepo";
import { createNote } from "../src/db/notesRepo";
import { createPerson } from "../src/db/peopleRepo";
import {
  createTopic,
  ensureTopicsInitiativeOwner,
  listTopicsWithNotesForInitiative,
  listTopicsWithNotesForPerson,
  updateTopic,
} from "../src/db/topicsRepo";
import { openTestAsyncDb, readSchemaSql } from "../src/db/testDb";

describe("topicsRepo", () => {
  it("creates person-scoped topics and nests notes under them", async () => {
    const db = openTestAsyncDb();
    const person = await createPerson(db, {
      name: "Cartman",
      nowIso: "2026-09-05T09:00:00.000Z",
    });
    const topic = await createTopic(db, {
      personId: person.id,
      title: "USS Fishkill",
      nowIso: "2026-09-05T10:00:00.000Z",
    });
    expect(topic.initiativeId).toBeNull();
    const note = await createNote(db, {
      body: "küfür etti",
      personIds: [person.id],
      topicIds: [topic.id],
      nowIso: "2026-09-05T10:05:00.000Z",
    });
    await createNote(db, {
      body: "konusuz eski not",
      personIds: [person.id],
      nowIso: "2026-09-05T09:30:00.000Z",
    });

    const result = await listTopicsWithNotesForPerson(db, person.id);

    expect(result.topics).toHaveLength(1);
    expect(result.topics[0].title).toBe("USS Fishkill");
    expect(result.topics[0].notes.map((item) => item.id)).toEqual([note.id]);
    expect(result.untopicNotes.map((item) => item.body)).toEqual([
      "konusuz eski not",
    ]);
    db.close();
  });

  it("rejects duplicate topic titles for the same person", async () => {
    const db = openTestAsyncDb();
    const person = await createPerson(db, {
      name: "Kenny",
      nowIso: "2026-09-05T09:00:00.000Z",
    });
    await createTopic(db, {
      personId: person.id,
      title: "1:1",
      nowIso: "2026-09-05T10:00:00.000Z",
    });

    await expect(
      createTopic(db, {
        personId: person.id,
        title: "1:1",
        nowIso: "2026-09-05T11:00:00.000Z",
      }),
    ).rejects.toThrow("Bu isimde konu var");
    db.close();
  });

  it("renames a topic", async () => {
    const db = openTestAsyncDb();
    const person = await createPerson(db, {
      name: "Stan",
      nowIso: "2026-09-05T09:00:00.000Z",
    });
    const topic = await createTopic(db, {
      personId: person.id,
      title: "Eski ad",
      nowIso: "2026-09-05T10:00:00.000Z",
    });

    const updated = await updateTopic(db, topic.id, "Yeni ad");

    expect(updated.title).toBe("Yeni ad");
    const listed = await listTopicsWithNotesForPerson(db, person.id);
    expect(listed.topics[0].title).toBe("Yeni ad");
    db.close();
  });

  it("creates initiative-scoped topics with untopic notes", async () => {
    const db = openTestAsyncDb();
    const initiative = await createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      nowIso: "2026-09-05T09:00:00.000Z",
    });
    const topic = await createTopic(db, {
      initiativeId: initiative.id,
      title: "Kickoff",
      nowIso: "2026-09-05T10:00:00.000Z",
    });
    expect(topic.personId).toBeNull();
    expect(topic.initiativeId).toBe(initiative.id);

    const underTopic = await createNote(db, {
      body: "Konulu",
      initiativeIds: [initiative.id],
      topicIds: [topic.id],
      nowIso: "2026-09-05T10:05:00.000Z",
    });
    await createNote(db, {
      body: "Konusuz iş notu",
      initiativeIds: [initiative.id],
      nowIso: "2026-09-05T09:30:00.000Z",
    });

    const result = await listTopicsWithNotesForInitiative(db, initiative.id);
    expect(result.topics).toHaveLength(1);
    expect(result.topics[0].notes.map((n) => n.id)).toEqual([underTopic.id]);
    expect(result.untopicNotes.map((n) => n.body)).toEqual(["Konusuz iş notu"]);

    await expect(
      createTopic(db, {
        initiativeId: initiative.id,
        title: "Kickoff",
        nowIso: "2026-09-05T11:00:00.000Z",
      }),
    ).rejects.toThrow("Bu isimde konu var");
    db.close();
  });

  it("migrates legacy person-only topics without failing schema apply", async () => {
    const db = openTestAsyncDb();
    const person = await createPerson(db, {
      name: "Legacy",
      nowIso: "2026-09-05T09:00:00.000Z",
    });

    await db.execute("PRAGMA foreign_keys = OFF");
    await db.execute("DROP TABLE topics");
    await db.execute(`
      CREATE TABLE topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
        title TEXT NOT NULL COLLATE NOCASE,
        created_at TEXT NOT NULL
      )
    `);
    await db.execute("PRAGMA foreign_keys = ON");
    await db.execute(
      `INSERT INTO topics (person_id, title, created_at) VALUES (?, ?, ?)`,
      [person.id, "Eski konu", "2026-09-05T09:30:00.000Z"],
    );

    // Real app path: CREATE IF NOT EXISTS leaves legacy table; indexes must not run yet.
    await expect(applySchema(db, readSchemaSql())).resolves.toBeUndefined();
    await ensureTopicsInitiativeOwner(db);

    const columns = await db.select<{ name: string }>("PRAGMA table_info(topics)");
    expect(columns.map((c) => c.name)).toContain("initiative_id");

    const listed = await listTopicsWithNotesForPerson(db, person.id);
    expect(listed.topics.map((t) => t.title)).toEqual(["Eski konu"]);

    const initiative = await createInitiative(db, {
      name: "Yeni iş",
      status: "aktif",
      nowIso: "2026-09-05T10:00:00.000Z",
    });
    const topic = await createTopic(db, {
      initiativeId: initiative.id,
      title: "Kickoff",
      nowIso: "2026-09-05T10:05:00.000Z",
    });
    expect(topic.initiativeId).toBe(initiative.id);
    db.close();
  });
});
