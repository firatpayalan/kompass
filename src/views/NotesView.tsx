import { useCallback, useEffect, useState } from "react";
import NoteList from "../components/NoteList";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Note } from "../lib/types";

type NotesDb = Pick<
  AppDb,
  "listActiveNotes" | "softDeleteNote" | "updateNote"
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

  const saveNote = async (id: number, body: string) => {
    if (!body.trim()) {
      onToast("Not boş olamaz");
      return;
    }
    try {
      await db.updateNote(id, body);
      setEditingNoteId(null);
      await loadNotes();
    } catch {
      onToast("Not güncellenemedi");
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
