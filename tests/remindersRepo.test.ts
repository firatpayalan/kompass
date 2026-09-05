import { describe, expect, it } from "vitest";

import { createInitiative } from "../src/db/initiativesRepo";
import { createNote, softDeleteNote } from "../src/db/notesRepo";
import {
  advanceOrCompleteReminder,
  createReminder,
  listDueRemindersForBugun,
  markReminderDone,
} from "../src/db/remindersRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("remindersRepo", () => {
  it("creates a reminder", async () => {
    const db = openTestAsyncDb();
    const note = await createNote(db, {
      body: "Bütçe notunu gözden geçir",
      nowIso: "2026-09-05T08:00:00.000Z",
    });

    const reminder = await createReminder(db, {
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

  it("lists unfinished reminders through the end of the local day with titles", async () => {
    const db = openTestAsyncDb();
    const now = new Date(2026, 8, 5, 12);
    const note = await createNote(db, {
      body: "Müşteri takip notu",
      nowIso: now.toISOString(),
    });
    const initiative = await createInitiative(db, {
      name: "Sonbahar lansmanı",
      status: "aktif",
      nowIso: now.toISOString(),
    });
    const noteReminder = await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: new Date(2026, 8, 5, 18).toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });
    const initiativeReminder = await createReminder(db, {
      targetType: "initiative",
      targetId: initiative.id,
      dueAt: new Date(2026, 8, 5, 9).toISOString(),
      period: "weekly",
      nowIso: now.toISOString(),
    });
    await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: new Date(2026, 8, 6, 9).toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });

    expect(await listDueRemindersForBugun(db, now)).toEqual([
      { ...initiativeReminder, title: "Sonbahar lansmanı" },
      { ...noteReminder, title: "Müşteri takip notu" },
    ]);
    db.close();
  });

  it("excludes a soft-deleted note's reminder from Bugün", async () => {
    const db = openTestAsyncDb();
    const now = new Date(2026, 8, 5, 12);
    const active = await createNote(db, {
      body: "Aktif not",
      nowIso: now.toISOString(),
    });
    const deleted = await createNote(db, {
      body: "Silinmiş not",
      nowIso: now.toISOString(),
    });
    await createReminder(db, {
      targetType: "note",
      targetId: active.id,
      dueAt: now.toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });
    await createReminder(db, {
      targetType: "note",
      targetId: deleted.id,
      dueAt: now.toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });
    await softDeleteNote(db, deleted.id, now.toISOString());

    expect(
      (await listDueRemindersForBugun(db, now)).map(({ title }) => title),
    ).toEqual(["Aktif not"]);
    db.close();
  });

  it("excludes reminders marked done", async () => {
    const db = openTestAsyncDb();
    const now = new Date(2026, 8, 5, 12);
    const note = await createNote(db, {
      body: "Tamamlanmış not",
      nowIso: now.toISOString(),
    });
    const reminder = await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: now.toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });

    await markReminderDone(db, reminder.id);

    expect(await listDueRemindersForBugun(db, now)).toEqual([]);
    db.close();
  });

  it("completes a due one-time reminder", async () => {
    const db = openTestAsyncDb();
    const reminder = await createReminder(db, {
      targetType: "note",
      targetId: 1,
      dueAt: "2026-09-05T09:00:00.000Z",
      period: "once",
      nowIso: "2026-09-05T08:00:00.000Z",
    });

    await advanceOrCompleteReminder(
      db,
      reminder,
      new Date("2026-09-05T10:00:00.000Z"),
    );

    expect(
      await db.select("SELECT done FROM reminders WHERE id = ?", [
        reminder.id,
      ]),
    ).toEqual([{ done: 1 }]);
    db.close();
  });

  it("advances a recurring reminder using nextDueAt", async () => {
    const db = openTestAsyncDb();
    const reminder = await createReminder(db, {
      targetType: "initiative",
      targetId: 1,
      dueAt: "2026-09-01T10:00:00.000Z",
      period: "weekly",
      nowIso: "2026-09-01T08:00:00.000Z",
    });

    await advanceOrCompleteReminder(
      db,
      reminder,
      new Date("2026-09-05T10:00:00.000Z"),
    );

    expect(
      await db.select("SELECT due_at, done FROM reminders WHERE id = ?", [
        reminder.id,
      ]),
    ).toEqual([{ due_at: "2026-09-08T10:00:00.000Z", done: 0 }]);
    db.close();
  });
});
