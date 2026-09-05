export type ReminderUrgency = "overdue" | "soon";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole local days from today to due date: negative = overdue. */
export function reminderDaysUntil(
  dueAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!dueAt) return null;
  const due = startOfLocalDay(new Date(dueAt));
  const today = startOfLocalDay(now);
  return Math.round((due.getTime() - today.getTime()) / 86_400_000);
}

export function reminderUrgency(
  dueAt: string | null | undefined,
  now: Date = new Date(),
): ReminderUrgency | null {
  const days = reminderDaysUntil(dueAt, now);
  if (days === null) return null;
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return null;
}

/** Turkish label for overdue / soon cards; null when no tint applies. */
export function reminderUrgencyLabel(
  dueAt: string | null | undefined,
  now: Date = new Date(),
): string | null {
  const days = reminderDaysUntil(dueAt, now);
  if (days === null) return null;
  if (days < 0) {
    const past = Math.abs(days);
    return past === 1 ? "1 gün gecikti" : `${past} gün gecikti`;
  }
  if (days === 0) return "Bugün";
  if (days <= 3) {
    return days === 1 ? "1 gün kaldı" : `${days} gün kaldı`;
  }
  return null;
}
