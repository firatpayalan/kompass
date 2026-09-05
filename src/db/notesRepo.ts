import { parseHashtags } from "../lib/tags";
import type { Note } from "../lib/types";

export type SqlDb = {
  prepare(sql: string): {
    run: (...args: unknown[]) => unknown;
    all: (...args: unknown[]) => unknown[];
    get: (...args: unknown[]) => unknown;
  };
  exec(sql: string): void;
};

type NoteRow = {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type NameRow = {
  name: string;
};

type IdRow = {
  id: number;
};

type InsertResult = {
  lastInsertRowid: number | bigint;
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

function getTags(db: SqlDb, noteId: number): string[] {
  return (
    db
      .prepare(
        `SELECT tags.name
         FROM tags
         JOIN note_tags ON note_tags.tag_id = tags.id
         WHERE note_tags.note_id = ?
         ORDER BY note_tags.rowid`,
      )
      .all(noteId) as NameRow[]
  ).map((row) => row.name);
}

function getLinkedIds(
  db: SqlDb,
  table: "note_people" | "note_initiatives",
  idColumn: "person_id" | "initiative_id",
  noteId: number,
): number[] {
  return (
    db
      .prepare(
        `SELECT ${idColumn} AS id
         FROM ${table}
         WHERE note_id = ?
         ORDER BY rowid`,
      )
      .all(noteId) as IdRow[]
  ).map((row) => row.id);
}

function mapNote(db: SqlDb, row: NoteRow): Note {
  return {
    id: row.id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    tags: getTags(db, row.id),
    personIds: getLinkedIds(db, "note_people", "person_id", row.id),
    initiativeIds: getLinkedIds(
      db,
      "note_initiatives",
      "initiative_id",
      row.id,
    ),
  };
}

function listNotes(db: SqlDb, deleted: boolean): Note[] {
  const operator = deleted ? "IS NOT NULL" : "IS NULL";
  const rows = db
    .prepare(
      `SELECT id, body, created_at, updated_at, deleted_at
       FROM notes
       WHERE deleted_at ${operator}
       ORDER BY created_at DESC, id DESC`,
    )
    .all() as NoteRow[];

  return rows.map((row) => mapNote(db, row));
}

export function createNote(db: SqlDb, input: CreateNoteInput): Note {
  if (!input.body.trim()) {
    throw new Error("Not boş olamaz");
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const tags = parseHashtags(input.body);

  db.exec("BEGIN");
  try {
    const result = db
      .prepare(
        `INSERT INTO notes (body, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, NULL)`,
      )
      .run(input.body, nowIso, nowIso) as InsertResult;
    const noteId = Number(result.lastInsertRowid);
    const insertTag = db.prepare("INSERT OR IGNORE INTO tags (name) VALUES (?)");
    const selectTag = db.prepare("SELECT id FROM tags WHERE name = ?");
    const linkTag = db.prepare(
      "INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)",
    );

    for (const tag of tags) {
      insertTag.run(tag);
      const tagRow = selectTag.get(tag) as IdRow;
      linkTag.run(noteId, tagRow.id);
    }

    const linkPerson = db.prepare(
      "INSERT INTO note_people (note_id, person_id) VALUES (?, ?)",
    );
    for (const personId of uniqueIds(input.personIds)) {
      linkPerson.run(noteId, personId);
    }

    const linkInitiative = db.prepare(
      "INSERT INTO note_initiatives (note_id, initiative_id) VALUES (?, ?)",
    );
    for (const initiativeId of uniqueIds(input.initiativeIds)) {
      linkInitiative.run(noteId, initiativeId);
    }

    db.exec("COMMIT");
    return getNote(db, noteId) as Note;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function getNote(db: SqlDb, id: number): Note | null {
  const row = db
    .prepare(
      `SELECT id, body, created_at, updated_at, deleted_at
       FROM notes
       WHERE id = ?`,
    )
    .get(id) as NoteRow | undefined;

  return row ? mapNote(db, row) : null;
}

export function listActiveNotes(db: SqlDb): Note[] {
  return listNotes(db, false);
}

export function listDeletedNotes(db: SqlDb): Note[] {
  return listNotes(db, true);
}

export function softDeleteNote(
  db: SqlDb,
  id: number,
  nowIso: string,
): void {
  db.prepare("UPDATE notes SET deleted_at = ? WHERE id = ?").run(nowIso, id);
}

export function restoreNote(db: SqlDb, id: number): void {
  db.prepare("UPDATE notes SET deleted_at = NULL WHERE id = ?").run(id);
}

export function permanentlyDeleteNote(db: SqlDb, id: number): void {
  db.prepare("DELETE FROM notes WHERE id = ?").run(id);
}
