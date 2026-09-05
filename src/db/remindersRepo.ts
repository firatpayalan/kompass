import { nextDueAt } from "../lib/reminders";
import type {
  Reminder,
  ReminderPeriod,
  ReminderTargetType,
} from "../lib/types";
import type { AsyncDb } from "./asyncDb";

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

export async function createReminder(
  db: AsyncDb,
  input: CreateReminderInput,
): Promise<Reminder> {
  const [row] = await db.select<ReminderRow>(
    `INSERT INTO reminders
       (target_type, target_id, due_at, period, done, created_at)
     VALUES (?, ?, ?, ?, 0, ?)
     RETURNING id, target_type, target_id, due_at, period, done, created_at`,
    [
      input.targetType,
      input.targetId,
      input.dueAt,
      input.period,
      input.nowIso,
    ],
  );

  return mapReminder(row);
}

export async function listDueRemindersForBugun(
  db: AsyncDb,
  now: Date,
): Promise<Array<Reminder & { title: string }>> {
  const endOfLocalDay = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
  const rows = await db.select<DueReminderRow>(
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
    [endOfLocalDay.toISOString()],
  );

  return rows.map((row) => ({
    ...mapReminder(row),
    title: row.title,
  }));
}

export function markReminderDone(db: AsyncDb, id: number): Promise<void> {
  return db.execute("UPDATE reminders SET done = 1 WHERE id = ?", [id]);
}

export async function advanceOrCompleteReminder(
  db: AsyncDb,
  reminder: Reminder,
  now: Date,
): Promise<void> {
  const next = nextDueAt(reminder.dueAt, reminder.period, now);
  if (next === null) {
    await markReminderDone(db, reminder.id);
    return;
  }

  await db.execute("UPDATE reminders SET due_at = ? WHERE id = ?", [
    next,
    reminder.id,
  ]);
}
