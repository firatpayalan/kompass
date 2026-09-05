import { useCallback, useEffect, useState } from "react";
import NoteList from "../components/NoteList";
import type { ReminderDraft } from "../components/ReminderForm";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Note } from "../lib/types";

type NotesDb = Pick<
  AppDb,
  "createReminder" | "listActiveNotes" | "softDeleteNote" | "updateNote"
>;

type NotesViewProps = {
  db?: NotesDb;
  refreshKey?: number;
  onToast?: (message: string) => void;
};

const ignoreToast = () => undefined;

export default function NotesView({
  db = getDb(),
  refreshKey = 0,
  onToast = ignoreToast,
}: NotesViewProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadNotes = useCallback(async () => {
    try {
      setNotes(await db.listActiveNotes());
    } catch {
      onToast("Notlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [db, onToast]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes, refreshKey]);

  const saveNote = async (
    id: number,
    body: string,
    reminder: ReminderDraft | null,
  ) => {
    if (!body.trim()) {
      onToast("Not boş olamaz");
      return;
    }
    if (reminder && !reminder.dueAt) {
      onToast("Hatırlatma zamanı gerekli");
      return;
    }

    try {
      await db.updateNote(id, body);
    } catch {
      onToast("Not güncellenemedi");
      return;
    }

    let reminderFailed = false;
    if (reminder) {
      try {
        await db.createReminder({
          targetType: "note",
          targetId: id,
          dueAt: new Date(reminder.dueAt).toISOString(),
          period: reminder.period,
          nowIso: new Date().toISOString(),
        });
      } catch {
        reminderFailed = true;
      }
    }

    setEditingNoteId(null);
    await loadNotes();
    if (reminderFailed) {
      onToast("Not kaydedildi, hatırlatma eklenemedi");
    }
  };

  const deleteNote = async (id: number) => {
    try {
      await db.softDeleteNote(id, new Date().toISOString());
      if (editingNoteId === id) {
        setEditingNoteId(null);
      }
      await loadNotes();
    } catch {
      onToast("Not silinemedi");
    }
  };

  return (
    <section className="notes-view">
      <h1>Notlar</h1>
      {loading ? (
        <p>Notlar yükleniyor…</p>
      ) : (
        <NoteList
          editingNoteId={editingNoteId}
          notes={notes}
          onDelete={deleteNote}
          onEdit={setEditingNoteId}
          onSave={saveNote}
        />
      )}
    </section>
  );
}
