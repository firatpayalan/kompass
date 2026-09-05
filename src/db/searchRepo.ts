import type { Note } from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import { mapNoteRows, type NoteRow } from "./notesRepo";

export type SearchNotesOptions = {
  includeDeleted?: boolean;
};

export async function searchNotes(
  db: AsyncDb,
  query: string,
  opts: SearchNotesOptions = {},
): Promise<Note[]> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  const ftsQuery = `"${trimmedQuery.replace(/"/g, '""')}"`;
  const likeQuery = `%${trimmedQuery}%`;
  const rows = await db.select<NoteRow>(
    `SELECT notes.id, notes.body, notes.created_at, notes.updated_at, notes.deleted_at
     FROM notes
     WHERE (? = 1 OR notes.deleted_at IS NULL)
       AND (
         notes.id IN (
           SELECT rowid
           FROM notes_fts
           WHERE notes_fts MATCH ?
         )
         OR EXISTS (
           SELECT 1
           FROM note_tags
           JOIN tags ON tags.id = note_tags.tag_id
           WHERE note_tags.note_id = notes.id
             AND tags.name LIKE ?
         )
         OR EXISTS (
           SELECT 1
           FROM note_people
           JOIN people ON people.id = note_people.person_id
           WHERE note_people.note_id = notes.id
             AND people.name LIKE ?
         )
         OR EXISTS (
           SELECT 1
           FROM note_initiatives
           JOIN initiatives ON initiatives.id = note_initiatives.initiative_id
           WHERE note_initiatives.note_id = notes.id
             AND initiatives.name LIKE ?
         )
       )
     ORDER BY notes.created_at DESC, notes.id DESC`,
    [opts.includeDeleted ? 1 : 0, ftsQuery, likeQuery, likeQuery, likeQuery],
  );

  return mapNoteRows(db, rows);
}
