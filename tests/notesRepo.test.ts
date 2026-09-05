import { describe, expect, it } from "vitest";

import {
  createNote,
  getNote,
  listActiveNotes,
} from "../src/db/notesRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("notesRepo", () => {
  it("rejects an empty body", async () => {
    const db = openTestAsyncDb();

    await expect(createNote(db, { body: "  " })).rejects.toThrow(
      "Not boş olamaz",
    );
    db.close();
  });

  it("creates a note with normalized tags and linked records", async () => {
    const db = openTestAsyncDb();
    const createdAt = "2026-09-05T10:00:00.000Z";
    const [person] = await db.select<{ id: number }>(
      `INSERT INTO people (name, role_or_notes, created_at)
       VALUES (?, ?, ?)
       RETURNING id`,
      ["Ayşe", null, createdAt],
    );
    const [initiative] = await db.select<{ id: number }>(
      `INSERT INTO initiatives (name, status, blocker_summary, created_at)
       VALUES (?, ?, ?, ?)
       RETURNING id`,
      ["Lansman", "aktif", null, createdAt],
    );

    const note = await createNote(db, {
      body: "Toplantı #Aksiyon #aksiyon #Önemli",
      personIds: [person.id],
      initiativeIds: [initiative.id],
      nowIso: createdAt,
    });

    expect(note).toEqual({
      id: expect.any(Number),
      body: "Toplantı #Aksiyon #aksiyon #Önemli",
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      tags: ["aksiyon", "önemli"],
      personIds: [person.id],
      initiativeIds: [initiative.id],
    });
    expect(await getNote(db, note.id)).toEqual(note);
    expect(await listActiveNotes(db)).toEqual([note]);
    db.close();
  });

  it("returns null for a missing note", async () => {
    const db = openTestAsyncDb();

    expect(await getNote(db, 404)).toBeNull();
    db.close();
  });
});
