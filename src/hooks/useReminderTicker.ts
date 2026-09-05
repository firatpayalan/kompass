import { useCallback, useEffect, useRef, useState } from "react";
import type { AppDb } from "../db/appDb";
import type { Reminder } from "../lib/types";
import { notifyReminder } from "../notifications/notify";

export type BugunReminder = Reminder & { title: string };
export type ReminderNotifier = (
  title: string,
  body: string,
) => Promise<boolean>;

type ReminderTickerDb = Pick<
  AppDb,
  "advanceOrCompleteReminder" | "listDueRemindersForBugun"
>;

type UseReminderTickerOptions = {
  db: ReminderTickerDb;
  notify?: ReminderNotifier;
  now?: () => Date;
};

export type ReminderTicker = {
  completeReminder: (reminder: BugunReminder) => Promise<void>;
  loadFailed: boolean;
  loading: boolean;
  permissionDenied: boolean;
  refresh: () => Promise<void>;
  reminders: BugunReminder[];
};

const currentTime = () => new Date();

/** Recurring reminders may notify again once they advance to a new dueAt. */
const notificationKey = (reminder: BugunReminder) =>
  `${reminder.id}@${reminder.dueAt}`;

export function useReminderTicker({
  db,
  notify = notifyReminder,
  now = currentTime,
}: UseReminderTickerOptions): ReminderTicker {
  const [reminders, setReminders] = useState<BugunReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const notifiedIds = useRef(new Set<string>());
  const notificationsDisabled = useRef(false);

  const refresh = useCallback(async () => {
    const current = now();
    try {
      const nextReminders = await db.listDueRemindersForBugun(current);
      setReminders(nextReminders);
      setLoadFailed(false);

      for (const reminder of nextReminders) {
        if (notificationsDisabled.current) {
          break;
        }
        const key = notificationKey(reminder);
        if (
          new Date(reminder.dueAt).getTime() > current.getTime() ||
          notifiedIds.current.has(key)
        ) {
          continue;
        }

        notifiedIds.current.add(key);
        try {
          const granted = await notify("Hatırlatma", reminder.title);
          if (!granted) {
            notificationsDisabled.current = true;
            setPermissionDenied(true);
            break;
          }
        } catch {
          notificationsDisabled.current = true;
          setPermissionDenied(true);
          break;
        }
      }
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [db, notify, now]);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => void refresh(), 60_000);
    const handleFocus = () => void refresh();
    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [refresh]);

  const completeReminder = useCallback(
    async (reminder: BugunReminder) => {
      await db.advanceOrCompleteReminder(reminder, now());
      await refresh();
    },
    [db, now, refresh],
  );

  return {
    completeReminder,
    loadFailed,
    loading,
    permissionDenied,
    refresh,
    reminders,
  };
}
