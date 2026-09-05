import { useEffect, useState } from "react";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { ReminderTicker } from "../hooks/useReminderTicker";
import type { Note } from "../lib/types";
import NoteArchiveShell from "../components/NoteArchiveShell";
import NoteTimestamps from "../components/NoteTimestamps";

type BugunDb = Pick<AppDb, "listActiveNotes" | "softDeleteNote">;

type BugunViewProps = {
  db?: BugunDb;
  ticker: ReminderTicker;
  onToast?: (message: string) => void;
};

const ignoreToast = () => undefined;

export default function BugunView({
  db = getDb(),
  ticker,
  onToast = ignoreToast,
}: BugunViewProps) {
  const [recentNotes, setRecentNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(true);
  const {
    completeReminder,
    loadFailed: remindersLoadFailed,
    loading: remindersLoading,
    permissionDenied,
    reminders,
  } = ticker;

  const loadNotes = async () => {
    try {
      const notes = await db.listActiveNotes();
      setRecentNotes(notes.slice(0, 10));
    } catch {
      // Keep the panel usable even if notes fail.
    } finally {
      setNotesLoading(false);
    }
  };

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

  const archiveNote = async (noteId: number) => {
    try {
      await db.softDeleteNote(noteId, new Date().toISOString());
      onToast("Not arşivlendi");
      await loadNotes();
    } catch {
      onToast("Not arşivlenemedi");
    }
  };

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
          <NoteArchiveShell enabled onArchive={archiveNote}>
            {({ openArchiveMenu }) => (
              <ul aria-label="Son notlar" className="recent-note-list">
                {recentNotes.map((note) => (
                  <li
                    key={note.id}
                    onContextMenu={(event) => openArchiveMenu(event, note)}
                  >
                    <p>{note.body}</p>
                    <NoteTimestamps note={note} />
                  </li>
                ))}
              </ul>
            )}
          </NoteArchiveShell>
        )}
      </section>
    </section>
  );
}
