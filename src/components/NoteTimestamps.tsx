import type { Note } from "../lib/types";

type NoteTimestampsProps = {
  note: Pick<Note, "createdAt" | "updatedAt">;
};

export default function NoteTimestamps({ note }: NoteTimestampsProps) {
  const createdLabel = new Date(note.createdAt).toLocaleString("tr-TR");
  const wasEdited = note.updatedAt !== note.createdAt;

  return (
    <div className="note-timestamps">
      <time dateTime={note.createdAt}>{createdLabel}</time>
      {wasEdited ? (
        <time className="note-timestamps__edited" dateTime={note.updatedAt}>
          Düzenlendi: {new Date(note.updatedAt).toLocaleString("tr-TR")}
        </time>
      ) : null}
    </div>
  );
}
