import type { Initiative, InitiativeStatus } from "../lib/types";
import {
  linkNoteToInitiatives,
  listNotesForInitiative,
  type SqlDb,
} from "./notesRepo";

type InitiativeRow = {
  id: number;
  name: string;
  status: InitiativeStatus;
  blocker_summary: string | null;
  created_at: string;
};

type InsertResult = {
  lastInsertRowid: number | bigint;
};

export type CreateInitiativeInput = {
  name: string;
  status: InitiativeStatus;
  blockerSummary?: string | null;
  nowIso: string;
};

export type UpdateInitiativePatch = {
  name?: string;
  status?: InitiativeStatus;
  blockerSummary?: string | null;
};

function mapInitiative(row: InitiativeRow): Initiative {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    blockerSummary: row.blocker_summary,
    createdAt: row.created_at,
  };
}

function getInitiative(db: SqlDb, id: number): Initiative | null {
  const row = db
    .prepare(
      `SELECT id, name, status, blocker_summary, created_at
       FROM initiatives
       WHERE id = ?`,
    )
    .get(id) as InitiativeRow | undefined;

  return row ? mapInitiative(row) : null;
}

function findInitiativeByName(
  db: SqlDb,
  name: string,
): Initiative | null {
  const row = db
    .prepare(
      `SELECT id, name, status, blocker_summary, created_at
       FROM initiatives
       WHERE name = ? COLLATE NOCASE`,
    )
    .get(name) as InitiativeRow | undefined;

  return row ? mapInitiative(row) : null;
}

export function createInitiative(
  db: SqlDb,
  input: CreateInitiativeInput,
): Initiative {
  if (findInitiativeByName(db, input.name)) {
    throw new Error("Bu isimde kayıt var");
  }

  const result = db
    .prepare(
      `INSERT INTO initiatives (name, status, blocker_summary, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.status,
      input.blockerSummary ?? null,
      input.nowIso,
    ) as InsertResult;

  return getInitiative(db, Number(result.lastInsertRowid)) as Initiative;
}

export function listInitiatives(db: SqlDb): Initiative[] {
  const rows = db
    .prepare(
      `SELECT id, name, status, blocker_summary, created_at
       FROM initiatives
       ORDER BY name COLLATE NOCASE, id`,
    )
    .all() as InitiativeRow[];

  return rows.map(mapInitiative);
}

export function updateInitiative(
  db: SqlDb,
  id: number,
  patch: UpdateInitiativePatch,
): Initiative {
  const current = getInitiative(db, id);
  if (!current) {
    throw new Error("Kayıt bulunamadı");
  }

  const name = patch.name ?? current.name;
  const duplicate = findInitiativeByName(db, name);
  if (duplicate && duplicate.id !== id) {
    throw new Error("Bu isimde kayıt var");
  }

  db.prepare(
    `UPDATE initiatives
     SET name = ?, status = ?, blocker_summary = ?
     WHERE id = ?`,
  ).run(
    name,
    patch.status ?? current.status,
    patch.blockerSummary === undefined
      ? current.blockerSummary
      : patch.blockerSummary,
    id,
  );

  return getInitiative(db, id) as Initiative;
}

export function deleteInitiative(db: SqlDb, id: number): void {
  db.prepare("DELETE FROM note_initiatives WHERE initiative_id = ?").run(id);
  db.prepare("DELETE FROM initiatives WHERE id = ?").run(id);
}

export { linkNoteToInitiatives, listNotesForInitiative };
