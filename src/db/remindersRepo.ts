import { nextDueAt } from "../lib/reminders";
import type {
  Reminder,
  ReminderPeriod,
  ReminderTargetType,
} from "../lib/types";
import type { SqlDb } from "./notesRepo";

type ReminderRow = {
  id: number;
  target_type: ReminderTargetType;
  target_id: number;
  due_at: string;
  period: ReminderPeriod;
  done: number;
  created_at: string;
};

type DueReminderRow = ReminderRow & {
  title: string;
};

type InsertResult = {
  lastInsertRowid: number | bigint;
};

export type CreateReminderInput = {
  targetType: ReminderTargetType;
  targetId: number;
  dueAt: string;
  period: ReminderPeriod;
  nowIso: string;
};

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    dueAt: row.due_at,
    period: row.period,
    done: Boolean(row.done),
    createdAt: row.created_at,
  };
}

function getReminder(db: SqlDb, id: number): Reminder | null {
  const row = db
    .prepare(
      `SELECT id, target_type, target_id, due_at, period, done, created_at
       FROM reminders
       WHERE id = ?`,
    )
    .get(id) as ReminderRow | undefined;

  return row ? mapReminder(row) : null;
}

export function createReminder(
  db: SqlDb,
  input: CreateReminderInput,
): Reminder {
  const result = db
    .prepare(
      `INSERT INTO reminders
         (target_type, target_id, due_at, period, done, created_at)
       VALUES (?, ?, ?, ?, 0, ?)`,
    )
    .run(
      input.targetType,
      input.targetId,
      input.dueAt,
      input.period,
      input.nowIso,
    ) as InsertResult;

  return getReminder(db, Number(result.lastInsertRowid)) as Reminder;
}

export function listDueRemindersForBugun(
  db: SqlDb,
  now: Date,
): Array<Reminder & { title: string }> {
  const endOfLocalDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  const rows = db
    .prepare(
      `SELECT reminders.id,
              reminders.target_type,
              reminders.target_id,
              reminders.due_at,
              reminders.period,
              reminders.done,
              reminders.created_at,
              CASE
                WHEN reminders.target_type = 'note'
                  THEN substr(notes.body, 1, 80)
                ELSE initiatives.name
              END AS title
       FROM reminders
       LEFT JOIN notes
         ON reminders.target_type = 'note'
        AND notes.id = reminders.target_id
       LEFT JOIN initiatives
         ON reminders.target_type = 'initiative'
        AND initiatives.id = reminders.target_id
       WHERE reminders.done = 0
         AND reminders.due_at <= ?
         AND (
           (reminders.target_type = 'note'
             AND notes.id IS NOT NULL
             AND notes.deleted_at IS NULL)
           OR
           (reminders.target_type = 'initiative'
             AND initiatives.id IS NOT NULL)
         )
       ORDER BY reminders.due_at, reminders.id`,
    )
    .all(endOfLocalDay.toISOString()) as DueReminderRow[];

  return rows.map((row) => ({
    ...mapReminder(row),
    title: row.title,
  }));
}

export function markReminderDone(db: SqlDb, id: number): void {
  db.prepare("UPDATE reminders SET done = 1 WHERE id = ?").run(id);
}

export function advanceOrCompleteReminder(
  db: SqlDb,
  reminder: Reminder,
  now: Date,
): void {
  const next = nextDueAt(reminder.dueAt, reminder.period, now);
  if (next === null) {
    markReminderDone(db, reminder.id);
    return;
  }

  db.prepare("UPDATE reminders SET due_at = ? WHERE id = ?").run(
    next,
    reminder.id,
  );
}
