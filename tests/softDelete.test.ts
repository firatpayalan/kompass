import { describe, expect, it } from "vitest";

import {
  createNote,
  getNote,
  listActiveNotes,
  listDeletedNotes,
  permanentlyDeleteNote,
  restoreNote,
  softDeleteNote,
} from "../src/db/notesRepo";
import { openTestDb } from "../src/db/testDb";

describe("note deletion lifecycle", () => {
  it("soft deletes, restores, and permanently deletes a note", () => {
    const db = openTestDb();
    const note = createNote(db, {
      body: "silinecek #takip",
      nowIso: "2026-09-05T10:00:00.000Z",
    });

    softDeleteNote(db, note.id, "2026-09-05T11:00:00.000Z");

    expect(listActiveNotes(db)).toHaveLength(0);
    expect(listDeletedNotes(db)).toEqual([
      {
        ...note,
        deletedAt: "2026-09-05T11:00:00.000Z",
      },
    ]);

    restoreNote(db, note.id);

    expect(listDeletedNotes(db)).toHaveLength(0);
    expect(listActiveNotes(db)).toEqual([note]);

    softDeleteNote(db, note.id, "2026-09-05T12:00:00.000Z");
    permanentlyDeleteNote(db, note.id);

    expect(getNote(db, note.id)).toBeNull();
    expect(listDeletedNotes(db)).toHaveLength(0);
    expect(
      db.prepare("SELECT * FROM tags WHERE name = ?").get("takip"),
    ).toBeTruthy();
    expect(
      db.prepare("SELECT * FROM note_tags WHERE note_id = ?").get(note.id),
    ).toBeUndefined();
    db.close();
  });
});
