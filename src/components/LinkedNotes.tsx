import type { Note } from "../lib/types";

type LinkedNotesProps = {
  loading: boolean;
  notes: Note[];
};

export default function LinkedNotes({ loading, notes }: LinkedNotesProps) {
  if (loading) {
    return <p>Bağlı notlar yükleniyor…</p>;
  }

  if (notes.length === 0) {
    return <p>Henüz bağlı not yok.</p>;
  }

  return (
    <ul aria-label="Bağlı notlar" className="linked-note-list">
      {notes.map((note) => (
        <li key={note.id}>
          <p>{note.body}</p>
          <time dateTime={note.createdAt}>
            {new Date(note.createdAt).toLocaleString("tr-TR")}
          </time>
        </li>
      ))}
    </ul>
  );
}
