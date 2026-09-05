import type { Person } from "../lib/types";
import {
  linkNoteToPeople,
  listNotesForPerson,
  type SqlDb,
} from "./notesRepo";

type PersonRow = {
  id: number;
  name: string;
  role_or_notes: string | null;
  created_at: string;
};

type InsertResult = {
  lastInsertRowid: number | bigint;
};

export type CreatePersonInput = {
  name: string;
  roleOrNotes?: string | null;
  nowIso: string;
};

function mapPerson(row: PersonRow): Person {
  return {
    id: row.id,
    name: row.name,
    roleOrNotes: row.role_or_notes,
    createdAt: row.created_at,
  };
}

function getPerson(db: SqlDb, id: number): Person | null {
  const row = db
    .prepare(
      `SELECT id, name, role_or_notes, created_at
       FROM people
       WHERE id = ?`,
    )
    .get(id) as PersonRow | undefined;

  return row ? mapPerson(row) : null;
}

export function createPerson(
  db: SqlDb,
  input: CreatePersonInput,
): Person {
  if (findPersonByName(db, input.name)) {
    throw new Error("Bu isimde kayıt var");
  }

  const result = db
    .prepare(
      `INSERT INTO people (name, role_or_notes, created_at)
       VALUES (?, ?, ?)`,
    )
    .run(input.name, input.roleOrNotes ?? null, input.nowIso) as InsertResult;

  return getPerson(db, Number(result.lastInsertRowid)) as Person;
}

export function listPeople(db: SqlDb): Person[] {
  const rows = db
    .prepare(
      `SELECT id, name, role_or_notes, created_at
       FROM people
       ORDER BY name COLLATE NOCASE, id`,
    )
    .all() as PersonRow[];

  return rows.map(mapPerson);
}

export function findPersonByName(db: SqlDb, name: string): Person | null {
  const row = db
    .prepare(
      `SELECT id, name, role_or_notes, created_at
       FROM people
       WHERE name = ? COLLATE NOCASE`,
    )
    .get(name) as PersonRow | undefined;

  return row ? mapPerson(row) : null;
}

export function deletePerson(db: SqlDb, id: number): void {
  db.prepare("DELETE FROM note_people WHERE person_id = ?").run(id);
  db.prepare("DELETE FROM people WHERE id = ?").run(id);
}

export { linkNoteToPeople, listNotesForPerson };
