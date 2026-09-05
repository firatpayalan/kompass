import type { Note } from "../lib/types";
import NoteEditor from "./NoteEditor";
import NoteTimestamps from "./NoteTimestamps";
import type { ReminderDraft } from "./ReminderForm";

type NoteListProps = {
  notes: Note[];
  editingNoteId: number | null;
  onEdit: (id: number | null) => void;
  onSave: (
    id: number,
    body: string,
    reminder: ReminderDraft | null,
  ) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
};

export default function NoteList({
  notes,
  editingNoteId,
  onEdit,
  onSave,
  onDelete,
}: NoteListProps) {
  if (notes.length === 0) {
    return <p>Henüz not yok.</p>;
  }

  return (
    <ul className="note-list">
      {notes.map((note) => (
        <li className="note-list__item" key={note.id}>
          <NoteEditor
            editing={editingNoteId === note.id}
            note={note}
            onCancel={() => onEdit(null)}
            onEdit={() => onEdit(note.id)}
            onSave={(body, reminder) => onSave(note.id, body, reminder)}
          />
          {note.tags.length > 0 ? (
            <div className="note-list__tags">
              {note.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          ) : null}
          <div className="note-list__meta">
            <NoteTimestamps note={note} />
            <button onClick={() => onDelete(note.id)} type="button">
              Sil
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
