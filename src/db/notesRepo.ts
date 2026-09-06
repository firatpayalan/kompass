import { parseHashtags } from "../lib/tags";
import type { Note, NoteTag } from "../lib/types";
import type { AsyncDb } from "./asyncDb";

export type NoteRow = {
  id: number;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type TagLinkRow = {
  note_id: number;
  id: number;
  name: string;
  color: string;
};

type LinkRow = {
  note_id: number;
  linked_id: number;
};

type IdRow = {
  id: number;
};

type ReminderDueRow = {
  note_id: number;
  due_at: string;
};

export type CreateNoteInput = {
  body: string;
  personIds?: number[];
  initiativeIds?: number[];
  topicIds?: number[];
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
  table: "note_people" | "note_initiatives" | "note_topics",
  idColumn: "person_id" | "initiative_id" | "topic_id",
  noteId: number,
  linkedIds: number[],
): Promise<void> {
  await db.withTransaction(async (tx) => {
    await tx.execute(`DELETE FROM ${table} WHERE note_id = ?`, [noteId]);
    for (const linkedId of uniqueIds(linkedIds)) {
      await tx.execute(
        `INSERT INTO ${table} (note_id, ${idColumn}) VALUES (?, ?)`,
        [noteId, linkedId],
      );
    }
  });
}

async function listLinkedNotes(
  db: AsyncDb,
  table: "note_people" | "note_initiatives",
  idColumn: "person_id" | "initiative_id",
  linkedId: number,
  options: { includeDeleted?: boolean } = {},
): Promise<Note[]> {
  const deletedClause = options.includeDeleted
    ? ""
    : "AND notes.deleted_at IS NULL";
  const rows = await db.select<NoteRow>(
    `SELECT notes.id, notes.body, notes.created_at, notes.updated_at, notes.deleted_at
     FROM notes
     JOIN ${table} ON ${table}.note_id = notes.id
     WHERE ${table}.${idColumn} = ? ${deletedClause}
     ORDER BY notes.created_at DESC, notes.id DESC`,
    [linkedId],
  );

  return mapNoteRows(db, rows);
}

async function getTagsByNote(
  db: AsyncDb,
  noteIds: number[],
): Promise<Map<number, NoteTag[]>> {
  const rows = await db.select<TagLinkRow>(
    `SELECT note_tags.note_id AS note_id, tags.id AS id, tags.name AS name,
            COALESCE(tags.color, 'slate') AS color
     FROM tags
     JOIN note_tags ON note_tags.tag_id = tags.id
     WHERE note_tags.note_id IN (${placeholders(noteIds.length)})
     ORDER BY note_tags.rowid`,
    noteIds,
  );

  return groupByNoteId(rows, (row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
  }));
}

async function getLinkedIdsByNote(
  db: AsyncDb,
  table: "note_people" | "note_initiatives" | "note_topics",
  idColumn: "person_id" | "initiative_id" | "topic_id",
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

async function getNextReminderDueByNote(
  db: AsyncDb,
  noteIds: number[],
): Promise<Map<number, string>> {
  const rows = await db.select<ReminderDueRow>(
    `SELECT target_id AS note_id, MIN(due_at) AS due_at
     FROM reminders
     WHERE done = 0
       AND target_type = 'note'
       AND target_id IN (${placeholders(noteIds.length)})
     GROUP BY target_id`,
    noteIds,
  );

  return new Map(rows.map((row) => [row.note_id, row.due_at]));
}

export async function mapNoteRows(
  db: AsyncDb,
  rows: NoteRow[],
): Promise<Note[]> {
  if (rows.length === 0) {
    return [];
  }

  const noteIds = rows.map((row) => row.id);
  const [tags, personIds, initiativeIds, topicIds, dueMap] = await Promise.all([
    getTagsByNote(db, noteIds),
    getLinkedIdsByNote(db, "note_people", "person_id", noteIds),
    getLinkedIdsByNote(db, "note_initiatives", "initiative_id", noteIds),
    getLinkedIdsByNote(db, "note_topics", "topic_id", noteIds),
    getNextReminderDueByNote(db, noteIds),
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
    topicIds: topicIds.get(row.id) ?? [],
    nextReminderDueAt: dueMap.get(row.id) ?? null,
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
  const noteId = await db.withTransaction(async (tx) => {
    const [inserted] = await tx.select<IdRow>(
      `INSERT INTO notes (body, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, NULL)
       RETURNING id`,
      [input.body, nowIso, nowIso],
    );
    const insertedNoteId = inserted.id;

    for (const tag of parseHashtags(input.body)) {
      await tx.execute(
        "INSERT OR IGNORE INTO tags (name, color) VALUES (?, 'slate')",
        [tag],
      );
      const [tagRow] = await tx.select<IdRow>(
        "SELECT id FROM tags WHERE name = ?",
        [tag],
      );
      await tx.execute(
        "INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)",
        [insertedNoteId, tagRow.id],
      );
    }

    for (const personId of uniqueIds(input.personIds)) {
      await tx.execute(
        "INSERT INTO note_people (note_id, person_id) VALUES (?, ?)",
        [insertedNoteId, personId],
      );
    }

    for (const initiativeId of uniqueIds(input.initiativeIds)) {
      await tx.execute(
        "INSERT INTO note_initiatives (note_id, initiative_id) VALUES (?, ?)",
        [insertedNoteId, initiativeId],
      );
    }

    for (const topicId of uniqueIds(input.topicIds)) {
      await tx.execute(
        "INSERT INTO note_topics (note_id, topic_id) VALUES (?, ?)",
        [insertedNoteId, topicId],
      );
    }

    return insertedNoteId;
  });

  return (await getNote(db, noteId)) as Note;
}

export async function updateNote(
  db: AsyncDb,
  id: number,
  body: string,
  nowIso = new Date().toISOString(),
): Promise<Note> {
  if (!body.trim()) {
    throw new Error("Not boş olamaz");
  }

  await db.withTransaction(async (tx) => {
    await tx.execute(
      "UPDATE notes SET body = ?, updated_at = ? WHERE id = ?",
      [body, nowIso, id],
    );
    // Keep chip-managed tags; only ensure hashtags from the body are linked.
    for (const tag of parseHashtags(body)) {
      await tx.execute(
        "INSERT OR IGNORE INTO tags (name, color) VALUES (?, 'slate')",
        [tag],
      );
      const [tagRow] = await tx.select<IdRow>(
        "SELECT id FROM tags WHERE name = ?",
        [tag],
      );
      await tx.execute(
        "INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)",
        [id, tagRow.id],
      );
    }
  });

  const note = await getNote(db, id);
  if (!note) {
    throw new Error("Kayıt bulunamadı");
  }
  return note;
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

export async function listNotesInRange(
  db: AsyncDb,
  startIso: string,
  endIso: string,
): Promise<Note[]> {
  const rows = await db.select<NoteRow>(
    `SELECT id, body, created_at, updated_at, deleted_at
     FROM notes
     WHERE deleted_at IS NULL
       AND created_at >= ?
       AND created_at < ?
     ORDER BY created_at DESC, id DESC`,
    [startIso, endIso],
  );
  return mapNoteRows(db, rows);
}

export async function listDeletedNotes(db: AsyncDb): Promise<Note[]> {
  const rows = await db.select<NoteRow>(
    `SELECT id, body, created_at, updated_at, deleted_at
     FROM notes
     WHERE deleted_at IS NOT NULL
       AND NOT EXISTS (
         SELECT 1
         FROM note_people
         JOIN people ON people.id = note_people.person_id
         WHERE note_people.note_id = notes.id
           AND people.archived_at IS NOT NULL
       )
       AND NOT EXISTS (
         SELECT 1
         FROM note_initiatives
         JOIN initiatives ON initiatives.id = note_initiatives.initiative_id
         WHERE note_initiatives.note_id = notes.id
           AND initiatives.archived_at IS NOT NULL
       )
     ORDER BY created_at DESC, id DESC`,
  );

  return mapNoteRows(db, rows);
}

/** Active notes with no person and no initiative links (quick-capture inbox). */
export async function listInboxNotes(db: AsyncDb): Promise<Note[]> {
  const rows = await db.select<NoteRow>(
    `SELECT id, body, created_at, updated_at, deleted_at
     FROM notes
     WHERE deleted_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM note_people WHERE note_people.note_id = notes.id
       )
       AND NOT EXISTS (
         SELECT 1 FROM note_initiatives WHERE note_initiatives.note_id = notes.id
       )
     ORDER BY created_at DESC, id DESC`,
  );

  return mapNoteRows(db, rows);
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

export function linkNoteToTopics(
  db: AsyncDb,
  noteId: number,
  topicIds: number[],
): Promise<void> {
  return replaceLinks(db, "note_topics", "topic_id", noteId, topicIds);
}

export function listNotesForPerson(
  db: AsyncDb,
  personId: number,
): Promise<Note[]> {
  return listLinkedNotes(db, "note_people", "person_id", personId);
}

export function listNotesForInitiative(
  db: AsyncDb,
  initiativeId: number,
  options: { includeDeleted?: boolean } = {},
): Promise<Note[]> {
  return listLinkedNotes(
    db,
    "note_initiatives",
    "initiative_id",
    initiativeId,
    options,
  );
}

export async function listNotesForTopic(
  db: AsyncDb,
  topicId: number,
  options: { includeDeleted?: boolean } = {},
): Promise<Note[]> {
  const deletedClause = options.includeDeleted
    ? ""
    : "AND notes.deleted_at IS NULL";
  const rows = await db.select<NoteRow>(
    `SELECT notes.id, notes.body, notes.created_at, notes.updated_at, notes.deleted_at
     FROM notes
     JOIN note_topics ON note_topics.note_id = notes.id
     WHERE note_topics.topic_id = ? ${deletedClause}
     ORDER BY notes.created_at DESC, notes.id DESC`,
    [topicId],
  );

  return mapNoteRows(db, rows);
}

/** Person-linked notes that are not under any topic. */
export async function listUntopicNotesForPerson(
  db: AsyncDb,
  personId: number,
  options: { includeDeleted?: boolean } = {},
): Promise<Note[]> {
  const deletedClause = options.includeDeleted
    ? ""
    : "AND notes.deleted_at IS NULL";
  const rows = await db.select<NoteRow>(
    `SELECT notes.id, notes.body, notes.created_at, notes.updated_at, notes.deleted_at
     FROM notes
     JOIN note_people ON note_people.note_id = notes.id
     WHERE note_people.person_id = ?
       ${deletedClause}
       AND NOT EXISTS (
         SELECT 1 FROM note_topics WHERE note_topics.note_id = notes.id
       )
     ORDER BY notes.created_at DESC, notes.id DESC`,
    [personId],
  );

  return mapNoteRows(db, rows);
}

/** Initiative-linked notes that are not under any topic. */
export async function listUntopicNotesForInitiative(
  db: AsyncDb,
  initiativeId: number,
  options: { includeDeleted?: boolean } = {},
): Promise<Note[]> {
  const deletedClause = options.includeDeleted
    ? ""
    : "AND notes.deleted_at IS NULL";
  const rows = await db.select<NoteRow>(
    `SELECT notes.id, notes.body, notes.created_at, notes.updated_at, notes.deleted_at
     FROM notes
     JOIN note_initiatives ON note_initiatives.note_id = notes.id
     WHERE note_initiatives.initiative_id = ?
       ${deletedClause}
       AND NOT EXISTS (
         SELECT 1 FROM note_topics WHERE note_topics.note_id = notes.id
       )
     ORDER BY notes.created_at DESC, notes.id DESC`,
    [initiativeId],
  );

  return mapNoteRows(db, rows);
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
