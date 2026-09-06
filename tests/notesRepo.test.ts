import { describe, expect, it } from "vitest";

import {
  createNote,
  getNote,
  linkNoteToTopics,
  listActiveNotes,
  listInboxNotes,
  listNotesInRange,
  linkNoteToPeople,
  softDeleteNote,
  updateNote,
} from "../src/db/notesRepo";
import { createPerson } from "../src/db/peopleRepo";
import { createReminder, markReminderDone } from "../src/db/remindersRepo";
import { openTestAsyncDb } from "../src/db/testDb";
import { createTopic } from "../src/db/topicsRepo";

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
      tags: [
        { id: expect.any(Number), name: "aksiyon", color: "slate" },
        { id: expect.any(Number), name: "önemli", color: "slate" },
      ],
      personIds: [person.id],
      initiativeIds: [initiative.id],
      topicIds: [],
      nextReminderDueAt: null,
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

  it("updates a note body and merges hashtag tags", async () => {
    const db = openTestAsyncDb();
    const note = await createNote(db, {
      body: "İlk metin #eski",
      nowIso: "2026-09-05T10:00:00.000Z",
    });

    const updated = await updateNote(db, note.id, "Yeni metin #yeni", "2026-09-05T11:00:00.000Z");

    expect(updated.body).toBe("Yeni metin #yeni");
    expect(updated.tags.map((tag) => tag.name).sort()).toEqual(["eski", "yeni"]);
    expect(updated.tags.every((tag) => tag.color === "slate")).toBe(true);
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

  it("links an untopic note to a topic", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-06T10:00:00.000Z";
    const person = await createPerson(db, { name: "Ayşe", nowIso });
    const topic = await createTopic(db, {
      personId: person.id,
      title: "1:1",
      nowIso,
    });
    const note = await createNote(db, {
      body: "Konusuz not",
      personIds: [person.id],
      nowIso,
    });

    expect(note.topicIds).toEqual([]);
    await linkNoteToTopics(db, note.id, [topic.id]);

    expect(await getNote(db, note.id)).toEqual(
      expect.objectContaining({
        id: note.id,
        topicIds: [topic.id],
        personIds: [person.id],
      }),
    );
    db.close();
  });

  it("includes nextReminderDueAt from open note reminders", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-06T10:00:00.000Z";
    const note = await createNote(db, { body: "Hatırlatmalı not", nowIso });
    const earlierDue = "2026-09-07T09:00:00.000Z";
    const laterDue = "2026-09-10T12:00:00.000Z";

    await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: laterDue,
      period: "once",
      nowIso,
    });
    await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: earlierDue,
      period: "once",
      nowIso,
    });

    const fetched = await getNote(db, note.id);
    expect(fetched?.nextReminderDueAt).toBe(earlierDue);

    const [listed] = await listActiveNotes(db);
    expect(listed.nextReminderDueAt).toBe(earlierDue);

    const doneReminder = await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: "2026-09-06T08:00:00.000Z",
      period: "once",
      nowIso,
    });
    await markReminderDone(db, doneReminder.id);

    expect((await getNote(db, note.id))?.nextReminderDueAt).toBe(earlierDue);
    db.close();
  });

  it("lists notes in a half-open created_at range and skips deleted", async () => {
    const db = openTestAsyncDb();
    const person = await createPerson(db, {
      name: "Ali",
      nowIso: "2026-09-01T00:00:00.000Z",
    });
    const inRange = await createNote(db, {
      body: "içerde",
      personIds: [person.id],
      nowIso: "2026-09-08T12:00:00.000Z",
    });
    await createNote(db, {
      body: "önce",
      personIds: [person.id],
      nowIso: "2026-09-06T23:59:59.000Z",
    });
    await createNote(db, {
      body: "sonra",
      personIds: [person.id],
      nowIso: "2026-09-14T00:00:00.000Z",
    });
    const deleted = await createNote(db, {
      body: "silindi",
      personIds: [person.id],
      nowIso: "2026-09-09T10:00:00.000Z",
    });
    await softDeleteNote(db, deleted.id, "2026-09-09T11:00:00.000Z");

    const notes = await listNotesInRange(
      db,
      "2026-09-07T00:00:00.000Z",
      "2026-09-14T00:00:00.000Z",
    );
    expect(notes.map((n) => n.id)).toEqual([inRange.id]);
    db.close();
  });
});
