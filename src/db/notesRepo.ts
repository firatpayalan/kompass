import { parseHashtags } from "../lib/tags";
import type { Note } from "../lib/types";
import type { AsyncDb } from "./asyncDb";

// Writes are not wrapped in BEGIN/COMMIT: the Tauri SQL plugin runs every
// statement through a connection pool, so a transaction opened by one call can
// be committed on a different connection. Multi-statement writes below are
// ordered so a partial failure leaves recoverable data instead of a broken note.

export type NoteRow = {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type TagRow = {
  note_id: number;
  name: string;
};

type LinkRow = {
  note_id: number;
  linked_id: number;
};

type IdRow = {
  id: number;
};

export type CreateNoteInput = {
  body: string;
  personIds?: number[];
  initiativeIds?: number[];
  nowIso?: string;
};

function uniqueIds(ids: number[] | undefined): number[] {
  return [...new Set(ids ?? [])];
}

function placeholders(count: number): string {
  return new Array(count).fill("?").join(", ");
}

function groupByNoteId<Row extends { note_id: number }, Value>(
  rows: Row[],
  toValue: (row: Row) => Value,
): Map<number, Value[]> {
  const grouped = new Map<number, Value[]>();
  for (const row of rows) {
    const existing = grouped.get(row.note_id);
    if (existing) {
      existing.push(toValue(row));
    } else {
      grouped.set(row.note_id, [toValue(row)]);
    }
  }
  return grouped;
}

async function replaceLinks(
  db: AsyncDb,
  table: "note_people" | "note_initiatives",
  idColumn: "person_id" | "initiative_id",
  noteId: number,
  linkedIds: number[],
): Promise<void> {
  await db.execute(`DELETE FROM ${table} WHERE note_id = ?`, [noteId]);
  for (const linkedId of uniqueIds(linkedIds)) {
    await db.execute(
      `INSERT INTO ${table} (note_id, ${idColumn}) VALUES (?, ?)`,
      [noteId, linkedId],
    );
  }
}

async function listLinkedActiveNotes(
  db: AsyncDb,
  table: "note_people" | "note_initiatives",
  idColumn: "person_id" | "initiative_id",
  linkedId: number,
): Promise<Note[]> {
  const rows = await db.select<NoteRow>(
    `SELECT notes.id, notes.body, notes.created_at, notes.updated_at, notes.deleted_at
     FROM notes
     JOIN ${table} ON ${table}.note_id = notes.id
     WHERE ${table}.${idColumn} = ? AND notes.deleted_at IS NULL
     ORDER BY notes.created_at DESC, notes.id DESC`,
    [linkedId],
  );

  return mapNoteRows(db, rows);
}

async function getTagsByNote(
  db: AsyncDb,
  noteIds: number[],
): Promise<Map<number, string[]>> {
  const rows = await db.select<TagRow>(
    `SELECT note_tags.note_id AS note_id, tags.name AS name
     FROM tags
     JOIN note_tags ON note_tags.tag_id = tags.id
     WHERE note_tags.note_id IN (${placeholders(noteIds.length)})
     ORDER BY note_tags.rowid`,
    noteIds,
  );

  return groupByNoteId(rows, (row) => row.name);
}

async function getLinkedIdsByNote(
  db: AsyncDb,
  table: "note_people" | "note_initiatives",
  idColumn: "person_id" | "initiative_id",
  noteIds: number[],
): Promise<Map<number, number[]>> {
  const rows = await db.select<LinkRow>(
    `SELECT note_id, ${idColumn} AS linked_id
     FROM ${table}
     WHERE note_id IN (${placeholders(noteIds.length)})
     ORDER BY rowid`,
    noteIds,
  );

  return groupByNoteId(rows, (row) => row.linked_id);
}

export async function mapNoteRows(
  db: AsyncDb,
  rows: NoteRow[],
): Promise<Note[]> {
  if (rows.length === 0) {
    return [];
  }

  const noteIds = rows.map((row) => row.id);
  const [tags, personIds, initiativeIds] = await Promise.all([
    getTagsByNote(db, noteIds),
    getLinkedIdsByNote(db, "note_people", "person_id", noteIds),
    getLinkedIdsByNote(db, "note_initiatives", "initiative_id", noteIds),
  ]);

  return rows.map((row) => ({
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    tags: tags.get(row.id) ?? [],
    personIds: personIds.get(row.id) ?? [],
    initiativeIds: initiativeIds.get(row.id) ?? [],
  }));
}

async function listNotes(db: AsyncDb, deleted: boolean): Promise<Note[]> {
  const operator = deleted ? "IS NOT NULL" : "IS NULL";
  const rows = await db.select<NoteRow>(
    `SELECT id, body, created_at, updated_at, deleted_at
     FROM notes
     WHERE deleted_at ${operator}
     ORDER BY created_at DESC, id DESC`,
  );

  return mapNoteRows(db, rows);
}

export async function createNote(
  db: AsyncDb,
  input: CreateNoteInput,
): Promise<Note> {
  if (!input.body.trim()) {
    throw new Error("Not boş olamaz");
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const [inserted] = await db.select<IdRow>(
    `INSERT INTO notes (body, created_at, updated_at, deleted_at)
     VALUES (?, ?, ?, NULL)
     RETURNING id`,
    [input.body, nowIso, nowIso],
  );
  const noteId = inserted.id;

  for (const tag of parseHashtags(input.body)) {
    await db.execute("INSERT OR IGNORE INTO tags (name) VALUES (?)", [tag]);
    const [tagRow] = await db.select<IdRow>(
      "SELECT id FROM tags WHERE name = ?",
      [tag],
    );
    await db.execute(
      "INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)",
      [noteId, tagRow.id],
    );
  }

  for (const personId of uniqueIds(input.personIds)) {
    await db.execute(
      "INSERT INTO note_people (note_id, person_id) VALUES (?, ?)",
      [noteId, personId],
    );
  }

  for (const initiativeId of uniqueIds(input.initiativeIds)) {
    await db.execute(
      "INSERT INTO note_initiatives (note_id, initiative_id) VALUES (?, ?)",
      [noteId, initiativeId],
    );
  }

  return (await getNote(db, noteId)) as Note;
}

export async function getNote(db: AsyncDb, id: number): Promise<Note | null> {
  const rows = await db.select<NoteRow>(
    `SELECT id, body, created_at, updated_at, deleted_at
     FROM notes
     WHERE id = ?`,
    [id],
  );

  const [note] = await mapNoteRows(db, rows);
  return note ?? null;
}

export function listActiveNotes(db: AsyncDb): Promise<Note[]> {
  return listNotes(db, false);
}

export function listDeletedNotes(db: AsyncDb): Promise<Note[]> {
  return listNotes(db, true);
}

export function linkNoteToPeople(
  db: AsyncDb,
  noteId: number,
  personIds: number[],
): Promise<void> {
  return replaceLinks(db, "note_people", "person_id", noteId, personIds);
}

export function linkNoteToInitiatives(
  db: AsyncDb,
  noteId: number,
  initiativeIds: number[],
): Promise<void> {
  return replaceLinks(
    db,
    "note_initiatives",
    "initiative_id",
    noteId,
    initiativeIds,
  );
}

export function listNotesForPerson(
  db: AsyncDb,
  personId: number,
): Promise<Note[]> {
  return listLinkedActiveNotes(db, "note_people", "person_id", personId);
}

export function listNotesForInitiative(
  db: AsyncDb,
  initiativeId: number,
): Promise<Note[]> {
  return listLinkedActiveNotes(
    db,
    "note_initiatives",
    "initiative_id",
    initiativeId,
  );
}

export function softDeleteNote(
  db: AsyncDb,
  id: number,
  nowIso: string,
): Promise<void> {
  return db.execute("UPDATE notes SET deleted_at = ? WHERE id = ?", [
    nowIso,
    id,
  ]);
}

export function restoreNote(db: AsyncDb, id: number): Promise<void> {
  return db.execute("UPDATE notes SET deleted_at = NULL WHERE id = ?", [id]);
}

export function permanentlyDeleteNote(
  db: AsyncDb,
  id: number,
): Promise<void> {
  return db.execute("DELETE FROM notes WHERE id = ?", [id]);
}
