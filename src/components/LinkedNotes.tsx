import { useState } from "react";
import type { Note } from "../lib/types";

type LinkedNotesProps = {
  loading: boolean;
  notes: Note[];
  label?: string;
  emptyLabel?: string;
  onUpdateNote?: (noteId: number, body: string) => Promise<void>;
};

export default function LinkedNotes({
  loading,
  notes,
  label = "Bağlı notlar",
  emptyLabel = "Henüz bağlı not yok.",
  onUpdateNote,
}: LinkedNotesProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  if (loading) {
    return <p>{label} yükleniyor…</p>;
  }

  if (notes.length === 0) {
    return <p>{emptyLabel}</p>;
  }

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setDraft(note.body);
  };

  const saveEdit = async () => {
    if (editingId === null || !onUpdateNote) return;
    setSaving(true);
    try {
      await onUpdateNote(editingId, draft);
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ul aria-label={label} className="linked-note-list">
      {notes.map((note) => (
        <li key={note.id}>
          {editingId === note.id ? (
            <div className="linked-note-edit">
              <label>
                Notu düzenle
                <textarea
                  autoFocus
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  value={draft}
                />
              </label>
              <div className="linked-note-edit__actions">
                <button
                  onClick={() => setEditingId(null)}
                  type="button"
                >
                  Vazgeç
                </button>
                <button disabled={saving} onClick={saveEdit} type="button">
                  {saving ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p>{note.body}</p>
              <div className="linked-note-meta">
                <time dateTime={note.createdAt}>
                  {new Date(note.createdAt).toLocaleString("tr-TR")}
                </time>
                {onUpdateNote ? (
                  <button
                    onClick={() => startEdit(note)}
                    type="button"
                  >
                    Düzenle
                  </button>
                ) : null}
              </div>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
