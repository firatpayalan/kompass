import { describe, expect, it } from "vitest";

import {
  createNote,
  getNote,
  listActiveNotes,
} from "../src/db/notesRepo";
import { openTestDb } from "../src/db/testDb";

describe("notesRepo", () => {
  it("rejects an empty body", () => {
    const db = openTestDb();

    expect(() => createNote(db, { body: "  " })).toThrow("Not boş olamaz");
    db.close();
  });

  it("creates a note with normalized tags and linked records", () => {
    const db = openTestDb();
    const createdAt = "2026-09-05T10:00:00.000Z";
    const personId = Number(
      db
        .prepare(
          "INSERT INTO people (name, role_or_notes, created_at) VALUES (?, ?, ?)",
        )
        .run("Ayşe", null, createdAt).lastInsertRowid,
    );
    const initiativeId = Number(
      db
        .prepare(
          "INSERT INTO initiatives (name, status, blocker_summary, created_at) VALUES (?, ?, ?, ?)",
        )
        .run("Lansman", "aktif", null, createdAt).lastInsertRowid,
    );

    const note = createNote(db, {
      body: "Toplantı #Aksiyon #aksiyon #Önemli",
      personIds: [personId],
      initiativeIds: [initiativeId],
      nowIso: createdAt,
    });

    expect(note).toEqual({
      id: expect.any(Number),
      body: "Toplantı #Aksiyon #aksiyon #Önemli",
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      tags: ["aksiyon", "önemli"],
      personIds: [personId],
      initiativeIds: [initiativeId],
    });
    expect(getNote(db, note.id)).toEqual(note);
    expect(listActiveNotes(db)).toEqual([note]);
    db.close();
  });

  it("returns null for a missing note", () => {
    const db = openTestDb();

    expect(getNote(db, 404)).toBeNull();
    db.close();
  });
});
