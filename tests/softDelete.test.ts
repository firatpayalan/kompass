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
import { openTestAsyncDb } from "../src/db/testDb";

describe("note deletion lifecycle", () => {
  it("soft deletes, restores, and permanently deletes a note", async () => {
    const db = openTestAsyncDb();
    const note = await createNote(db, {
      body: "silinecek #takip",
      nowIso: "2026-09-05T10:00:00.000Z",
    });

    await softDeleteNote(db, note.id, "2026-09-05T11:00:00.000Z");

    expect(await listActiveNotes(db)).toHaveLength(0);
    expect(await listDeletedNotes(db)).toEqual([
      {
        ...note,
        deletedAt: "2026-09-05T11:00:00.000Z",
      },
    ]);

    await restoreNote(db, note.id);

    expect(await listDeletedNotes(db)).toHaveLength(0);
    expect(await listActiveNotes(db)).toEqual([note]);

    await softDeleteNote(db, note.id, "2026-09-05T12:00:00.000Z");
    await permanentlyDeleteNote(db, note.id);

    expect(await getNote(db, note.id)).toBeNull();
    expect(await listDeletedNotes(db)).toHaveLength(0);
    expect(
      await db.select("SELECT * FROM tags WHERE name = ?", ["takip"]),
    ).toHaveLength(1);
    expect(
      await db.select("SELECT * FROM note_tags WHERE note_id = ?", [note.id]),
    ).toHaveLength(0);
    db.close();
  });
});
