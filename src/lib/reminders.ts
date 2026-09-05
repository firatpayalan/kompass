import type { ReminderPeriod } from "./types";

export function isDue(dueAtIso: string, now: Date): boolean {
  return new Date(dueAtIso).getTime() <= now.getTime();
}

function addPeriod(d: Date, period: ReminderPeriod): Date {
  const n = new Date(d);
  if (period === "daily") n.setUTCDate(n.getUTCDate() + 1);
  else if (period === "weekly") n.setUTCDate(n.getUTCDate() + 7);
  else if (period === "monthly") n.setUTCMonth(n.getUTCMonth() + 1);
  return n;
}

export function nextDueAt(
  dueAtIso: string,
  period: ReminderPeriod,
  now: Date,
): string | null {
  if (period === "once") {
    return isDue(dueAtIso, now) ? null : dueAtIso;
  }
  let cursor = new Date(dueAtIso);
  // If still in the future, keep current due
  if (cursor.getTime() > now.getTime()) return cursor.toISOString();
  while (cursor.getTime() <= now.getTime()) {
    cursor = addPeriod(cursor, period);
  }
  return cursor.toISOString();
}
