import { describe, expect, it } from "vitest";

import {
  createNote,
  getNote,
  listActiveNotes,
  listInboxNotes,
  linkNoteToPeople,
  updateNote,
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
      topicIds: [],
    });
    expect(await getNote(db, note.id)).toEqual(note);
    expect(await listActiveNotes(db)).toEqual([note]);
    db.close();
  });

  it("rolls back the note when linking a person fails", async () => {
    const db = openTestAsyncDb();

    await expect(
      createNote(db, {
        body: "Rollback #geçici",
        personIds: [404],
        nowIso: "2026-09-05T10:00:00.000Z",
      }),
    ).rejects.toThrow();

    expect(await db.select("SELECT id FROM notes")).toEqual([]);
    expect(await db.select("SELECT id FROM tags")).toEqual([]);
    db.close();
  });

  it("returns null for a missing note", async () => {
    const db = openTestAsyncDb();

    expect(await getNote(db, 404)).toBeNull();
    db.close();
  });

  it("updates a note body and rebuilds its tags", async () => {
    const db = openTestAsyncDb();
    const note = await createNote(db, {
      body: "İlk metin #eski",
      nowIso: "2026-09-05T10:00:00.000Z",
    });

    const updated = await updateNote(db, note.id, "Yeni metin #yeni", "2026-09-05T11:00:00.000Z");

    expect(updated.body).toBe("Yeni metin #yeni");
    expect(updated.tags).toEqual(["yeni"]);
    expect(updated.updatedAt).toBe("2026-09-05T11:00:00.000Z");
    db.close();
  });

  it("lists only unlinked notes in the inbox", async () => {
    const db = openTestAsyncDb();
    const [person] = await db.select<{ id: number }>(
      `INSERT INTO people (name, role_or_notes, created_at)
       VALUES ('Ayşe', NULL, '2026-09-05T09:00:00.000Z')
       RETURNING id`,
    );
    const inbox = await createNote(db, {
      body: "Hızlı not",
      nowIso: "2026-09-05T10:00:00.000Z",
    });
    const linked = await createNote(db, {
      body: "Bağlı not",
      nowIso: "2026-09-05T10:05:00.000Z",
    });
    await linkNoteToPeople(db, linked.id, [person.id]);

    const listed = await listInboxNotes(db);

    expect(listed.map((note) => note.id)).toEqual([inbox.id]);
    db.close();
  });
});
