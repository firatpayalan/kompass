import { describe, expect, it } from "vitest";

import { createInitiative } from "../src/db/initiativesRepo";
import { createNote, softDeleteNote } from "../src/db/notesRepo";
import { createPerson } from "../src/db/peopleRepo";
import { searchNotes } from "../src/db/searchRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("searchRepo", () => {
  it("searches note bodies and excludes soft-deleted notes by default", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const active = await createNote(db, { body: "Gizli gündem", nowIso });
    const deleted = await createNote(db, { body: "Gizli arşiv", nowIso });
    await softDeleteNote(db, deleted.id, "2026-09-05T11:00:00.000Z");

    expect((await searchNotes(db, "Gizli")).map((note) => note.id)).toEqual([
      active.id,
    ]);
    expect(
      (await searchNotes(db, "Gizli", { includeDeleted: true })).map(
        (note) => note.id,
      ),
    ).toEqual([deleted.id, active.id]);
    db.close();
  });

  it("searches tag, person, and initiative names", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const person = await createPerson(db, { name: "Ayşe Demir", nowIso });
    const initiative = await createInitiative(db, {
      name: "Phoenix Lansmanı",
      status: "aktif",
      nowIso,
    });
    const tagged = await createNote(db, { body: "Bütçe #kritik", nowIso });
    const linkedPerson = await createNote(db, {
      body: "Haftalık görüşme",
      personIds: [person.id],
      nowIso,
    });
    const linkedInitiative = await createNote(db, {
      body: "Kilometre taşı",
      initiativeIds: [initiative.id],
      nowIso,
    });

    expect((await searchNotes(db, "krit")).map((note) => note.id)).toEqual([
      tagged.id,
    ]);
    expect((await searchNotes(db, "Ayşe")).map((note) => note.id)).toEqual([
      linkedPerson.id,
    ]);
    expect((await searchNotes(db, "Phoenix")).map((note) => note.id)).toEqual([
      linkedInitiative.id,
    ]);
    db.close();
  });
});
