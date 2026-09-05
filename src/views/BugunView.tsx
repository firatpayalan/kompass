import { useEffect, useState } from "react";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { ReminderTicker } from "../hooks/useReminderTicker";
import type { Note } from "../lib/types";

type BugunDb = Pick<AppDb, "listActiveNotes">;

type BugunViewProps = {
  db?: BugunDb;
  ticker: ReminderTicker;
};

export default function BugunView({ db = getDb(), ticker }: BugunViewProps) {
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const {
    completeReminder,
    loadFailed: remindersLoadFailed,
    loading: remindersLoading,
    permissionDenied,
    reminders,
  } = ticker;

  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(() => db.listActiveNotes())
      .then((notes) => {
        if (active) {
          setRecentNotes(notes.slice(0, 10));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) {
          setNotesLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [db]);

  return (
    <section className="bugun-view">
      <h1>Bugün</h1>

      {permissionDenied ? (
        <p className="inline-banner" role="status">
          Bildirim izni yok; Bugün paneli çalışmaya devam eder
        </p>
      ) : null}

      <section aria-labelledby="bugun-reminders-heading">
        <h2 id="bugun-reminders-heading">Hatırlatmalar</h2>
        {remindersLoading ? (
          <p>Hatırlatmalar yükleniyor…</p>
        ) : remindersLoadFailed ? (
          <p>Hatırlatmalar yüklenemedi.</p>
        ) : reminders.length === 0 ? (
          <p>Bugün için hatırlatma yok.</p>
        ) : (
          <ul className="reminder-list">
            {reminders.map((reminder) => (
              <li key={reminder.id}>
                <div>
                  <strong>{reminder.title}</strong>
                  <time dateTime={reminder.dueAt}>
                    {new Date(reminder.dueAt).toLocaleString("tr-TR")}
                  </time>
                </div>
                <button
                  aria-label={`Tamamla: ${reminder.title}`}
                  onClick={() => void completeReminder(reminder)}
                  type="button"
                >
                  Tamamla
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-notes-heading">
        <h2 id="recent-notes-heading">Son notlar</h2>
        {notesLoading ? (
          <p>Notlar yükleniyor…</p>
        ) : recentNotes.length === 0 ? (
          <p>Henüz not yok.</p>
        ) : (
          <ul aria-label="Son notlar" className="recent-note-list">
            {recentNotes.map((note) => (
              <li key={note.id}>
                <p>{note.body}</p>
                <time dateTime={note.createdAt}>
                  {new Date(note.createdAt).toLocaleString("tr-TR")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </section>
    </section>
  );
}
