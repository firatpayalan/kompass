import { describe, expect, it } from "vitest";

import { createInitiative } from "../src/db/initiativesRepo";
import { createNote, softDeleteNote } from "../src/db/notesRepo";
import { createPerson } from "../src/db/peopleRepo";
import { searchNotes } from "../src/db/searchRepo";
import { openTestDb } from "../src/db/testDb";

describe("searchRepo", () => {
  it("searches note bodies and excludes soft-deleted notes by default", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const active = createNote(db, { body: "Gizli gündem", nowIso });
    const deleted = createNote(db, { body: "Gizli arşiv", nowIso });
    softDeleteNote(db, deleted.id, "2026-09-05T11:00:00.000Z");

    expect(searchNotes(db, "Gizli").map((note) => note.id)).toEqual([
      active.id,
    ]);
    expect(
      searchNotes(db, "Gizli", { includeDeleted: true }).map(
        (note) => note.id,
      ),
    ).toEqual([deleted.id, active.id]);
    db.close();
  });

  it("searches tag, person, and initiative names", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const person = createPerson(db, { name: "Ayşe Demir", nowIso });
    const initiative = createInitiative(db, {
      name: "Phoenix Lansmanı",
      status: "aktif",
      nowIso,
    });
    const tagged = createNote(db, { body: "Bütçe #kritik", nowIso });
    const linkedPerson = createNote(db, {
      body: "Haftalık görüşme",
      personIds: [person.id],
      nowIso,
    });
    const linkedInitiative = createNote(db, {
      body: "Kilometre taşı",
      initiativeIds: [initiative.id],
      nowIso,
    });

    expect(searchNotes(db, "krit").map((note) => note.id)).toEqual([
      tagged.id,
    ]);
    expect(searchNotes(db, "Ayşe").map((note) => note.id)).toEqual([
      linkedPerson.id,
    ]);
    expect(searchNotes(db, "Phoenix").map((note) => note.id)).toEqual([
      linkedInitiative.id,
    ]);
    db.close();
  });
});
