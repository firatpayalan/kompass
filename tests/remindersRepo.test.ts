import { describe, expect, it } from "vitest";

import { createInitiative } from "../src/db/initiativesRepo";
import { createNote, softDeleteNote } from "../src/db/notesRepo";
import {
  advanceOrCompleteReminder,
  createReminder,
  listDueRemindersForBugun,
  listOverdueReminders,
  listUpcomingReminders,
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

  it("lists unfinished reminders due today only with titles", async () => {
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
      dueAt: new Date(2026, 8, 4, 18).toISOString(),
      period: "once",
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

  it("buckets overdue vs upcoming around local day boundaries", async () => {
    const db = openTestAsyncDb();
    const now = new Date(2026, 8, 5, 12);
    const note = await createNote(db, {
      body: "Not",
      nowIso: now.toISOString(),
    });

    const overdue = await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: new Date(2026, 8, 4, 23, 59, 59, 999).toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });
    const today = await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: new Date(2026, 8, 5, 0, 0, 0, 0).toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });
    const tomorrow = await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: new Date(2026, 8, 6, 9).toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });
    const day7 = await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: new Date(2026, 8, 12, 23, 59, 59, 999).toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });
    await createReminder(db, {
      targetType: "note",
      targetId: note.id,
      dueAt: new Date(2026, 8, 13, 0, 0, 0, 0).toISOString(),
      period: "once",
      nowIso: now.toISOString(),
    });

    expect(await listOverdueReminders(db, now)).toEqual([
      expect.objectContaining({ id: overdue.id }),
    ]);
    expect(await listDueRemindersForBugun(db, now)).toEqual([
      expect.objectContaining({ id: today.id }),
    ]);
    expect((await listUpcomingReminders(db, now)).map((r) => r.id)).toEqual([
      tomorrow.id,
      day7.id,
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

  it("completes a one-time reminder even when dueAt is still in the future", async () => {
    const db = openTestAsyncDb();
    const reminder = await createReminder(db, {
      targetType: "note",
      targetId: 1,
      dueAt: "2026-09-05T18:00:00.000Z",
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

  it("skips a future recurring occurrence in Yaklaşanlar on complete", async () => {
    const db = openTestAsyncDb();
    const reminder = await createReminder(db, {
      targetType: "initiative",
      targetId: 1,
      dueAt: "2026-09-08T10:00:00.000Z",
      period: "weekly",
      nowIso: "2026-09-05T08:00:00.000Z",
    });

    await advanceOrCompleteReminder(
      db,
      reminder,
      new Date("2026-09-05T12:00:00.000Z"),
    );

    expect(
      await db.select("SELECT due_at, done FROM reminders WHERE id = ?", [
        reminder.id,
      ]),
    ).toEqual([{ due_at: "2026-09-15T10:00:00.000Z", done: 0 }]);
    db.close();
  });
});
