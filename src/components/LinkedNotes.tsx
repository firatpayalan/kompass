import type { Note } from "../lib/types";

type LinkedNotesProps = {
  loading: boolean;
  notes: Note[];
  label?: string;
  emptyLabel?: string;
};

export default function LinkedNotes({
  loading,
  notes,
  label = "Bağlı notlar",
  emptyLabel = "Henüz bağlı not yok.",
}: LinkedNotesProps) {
  if (loading) {
    return <p>{label} yükleniyor…</p>;
  }

  if (notes.length === 0) {
    return <p>{emptyLabel}</p>;
  }

  return (
    <ul aria-label={label} className="linked-note-list">
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
