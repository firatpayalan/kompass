import { useCallback, useEffect, useState } from "react";
import ConfirmDialog from "../components/ConfirmDialog";
import type { AppDb } from "../db/appDb";
import { getDb } from "../db/appDb";
import type { Note } from "../lib/types";

type TrashDb = Pick<
  AppDb,
  "listDeletedNotes" | "permanentlyDeleteNote" | "restoreNote"
>;

type TrashViewProps = {
  db?: TrashDb;
  onToast?: (message: string) => void;
};

const ignoreToast = () => undefined;

export default function TrashView({
  db = getDb(),
  onToast = ignoreToast,
}: TrashViewProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteToDelete, setNoteToDelete] = useState<Note | null>(null);

  const loadNotes = useCallback(async () => {
    try {
      setNotes(await db.listDeletedNotes());
    } catch {
      onToast("Silinen notlar yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [db, onToast]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const restore = async (id: number) => {
    try {
      await db.restoreNote(id);
      await loadNotes();
    } catch {
      onToast("Not geri yüklenemedi");
    }
  };

  const permanentlyDelete = async () => {
    if (!noteToDelete) {
      return;
    }

    try {
      await db.permanentlyDeleteNote(noteToDelete.id);
      setNoteToDelete(null);
      await loadNotes();
    } catch {
      onToast("Not kalıcı olarak silinemedi");
    }
  };

  return (
    <section className="notes-view">
      <h1>Silinenler</h1>
      {loading ? (
        <p>Silinen notlar yükleniyor…</p>
      ) : notes.length === 0 ? (
        <p>Silinen not yok.</p>
      ) : (
        <ul className="note-list" aria-label="Silinen notlar">
          {notes.map((note) => (
            <li className="note-list__item" key={note.id}>
              <p className="note-editor__preview">{note.body}</p>
              {note.tags.length > 0 ? (
                <div className="note-list__tags">
                  {note.tags.map((tag) => (
                    <span key={tag}>#{tag}</span>
                  ))}
                </div>
              ) : null}
              <div className="note-list__meta">
                <time dateTime={note.deletedAt ?? note.updatedAt}>
                  {new Date(
                    note.deletedAt ?? note.updatedAt,
                  ).toLocaleString("tr-TR")}
                </time>
                <div className="note-editor__actions">
                  <button onClick={() => void restore(note.id)} type="button">
                    Geri yükle
                  </button>
                  <button
                    onClick={() => setNoteToDelete(note)}
                    type="button"
                  >
                    Kalıcı sil
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {noteToDelete ? (
        <ConfirmDialog
          message="Bu not kalıcı olarak silinecek. Emin misiniz?"
          onCancel={() => setNoteToDelete(null)}
          onConfirm={() => void permanentlyDelete()}
        />
      ) : null}
    </section>
  );
}
