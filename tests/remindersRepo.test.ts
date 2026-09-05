import { describe, expect, it } from "vitest";

import { createInitiative } from "../src/db/initiativesRepo";
import { createNote, softDeleteNote } from "../src/db/notesRepo";
import {
  advanceOrCompleteReminder,
  createReminder,
  listDueRemindersForBugun,
  markReminderDone,
} from "../src/db/remindersRepo";
import { openTestDb } from "../src/db/testDb";

describe("remindersRepo", () => {
  it("creates a reminder", () => {
    const db = openTestDb();
    const note = createNote(db, {
      body: "Bütçe notunu gözden geçir",
      nowIso: "2026-09-05T08:00:00.000Z",
    });

    const reminder = createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: "2026-09-05T10:00:00.000Z",
      period: "daily",
      nowIso: "2026-09-05T08:00:00.000Z",
    });

    expect(reminder).toEqual({
      id: expect.any(Number),
      targetType: "note",
      targetId: note.id,
      dueAt: "2026-09-05T10:00:00.000Z",
      period: "daily",
      done: false,
      createdAt: "2026-09-05T08:00:00.000Z",
    });
    db.close();
  });

  it("lists unfinished reminders through the end of the local day with titles", () => {
    const db = openTestDb();
    const now = new Date(2026, 8, 5, 12);
    const note = createNote(db, {
      body: "Müşteri takip notu",
      nowIso: now.toISOString(),
    });
    const initiative = createInitiative(db, {
      name: "Sonbahar lansmanı",
      status: "aktif",
      nowIso: now.toISOString(),
    });
    const noteReminder = createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: new Date(2026, 8, 5, 18).toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });
    const initiativeReminder = createReminder(db, {
      targetType: "initiative",
      targetId: initiative.id,
      dueAt: new Date(2026, 8, 5, 9).toISOString(),
      period: "weekly",
      nowIso: now.toISOString(),
    });
    createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: new Date(2026, 8, 6, 9).toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });

    expect(listDueRemindersForBugun(db, now)).toEqual([
      { ...initiativeReminder, title: "Sonbahar lansmanı" },
      { ...noteReminder, title: "Müşteri takip notu" },
    ]);
    db.close();
  });

  it("excludes a soft-deleted note's reminder from Bugün", () => {
    const db = openTestDb();
    const now = new Date(2026, 8, 5, 12);
    const active = createNote(db, {
      body: "Aktif not",
      nowIso: now.toISOString(),
    });
    const deleted = createNote(db, {
      body: "Silinmiş not",
      nowIso: now.toISOString(),
    });
    createReminder(db, {
      targetType: "note",
      targetId: active.id,
      dueAt: now.toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });
    createReminder(db, {
      targetType: "note",
      targetId: deleted.id,
      dueAt: now.toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });
    softDeleteNote(db, deleted.id, now.toISOString());

    expect(listDueRemindersForBugun(db, now).map(({ title }) => title)).toEqual([
      "Aktif not",
    ]);
    db.close();
  });

  it("excludes reminders marked done", () => {
    const db = openTestDb();
    const now = new Date(2026, 8, 5, 12);
    const note = createNote(db, {
      body: "Tamamlanmış not",
      nowIso: now.toISOString(),
    });
    const reminder = createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: now.toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });

    markReminderDone(db, reminder.id);

    expect(listDueRemindersForBugun(db, now)).toEqual([]);
    db.close();
  });

  it("completes a due one-time reminder", () => {
    const db = openTestDb();
    const reminder = createReminder(db, {
      targetType: "note",
      targetId: 1,
      dueAt: "2026-09-05T09:00:00.000Z",
      period: "once",
      nowIso: "2026-09-05T08:00:00.000Z",
    });

    advanceOrCompleteReminder(
      db,
      reminder,
      new Date("2026-09-05T10:00:00.000Z"),
    );

    expect(
      db.prepare("SELECT done FROM reminders WHERE id = ?").get(reminder.id),
    ).toEqual({ done: 1 });
    db.close();
  });

  it("advances a recurring reminder using nextDueAt", () => {
    const db = openTestDb();
    const reminder = createReminder(db, {
      targetType: "initiative",
      targetId: 1,
      dueAt: "2026-09-01T10:00:00.000Z",
      period: "weekly",
      nowIso: "2026-09-01T08:00:00.000Z",
    });

    advanceOrCompleteReminder(
      db,
      reminder,
      new Date("2026-09-05T10:00:00.000Z"),
    );

    expect(
      db
        .prepare("SELECT due_at, done FROM reminders WHERE id = ?")
        .get(reminder.id),
    ).toEqual({ due_at: "2026-09-08T10:00:00.000Z", done: 0 });
    db.close();
  });
});
