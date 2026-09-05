export type ReminderUrgency = "overdue" | "soon";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole local days from today to due date: negative = overdue. */
export function reminderUrgency(
  dueAt: string | null | undefined,
  now: Date = new Date(),
): ReminderUrgency | null {
  if (!dueAt) return null;
  const due = startOfLocalDay(new Date(dueAt));
  const today = startOfLocalDay(now);
  const days =
    Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return null;
}
