import type { Initiative, InitiativeStatus } from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import { linkNoteToInitiatives, listNotesForInitiative } from "./notesRepo";

type InitiativeRow = {
  id: number;
  name: string;
  status: InitiativeStatus;
  blocker_summary: string | null;
  created_at: string;
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

const INITIATIVE_COLUMNS = "id, name, status, blocker_summary, created_at";

function mapInitiative(row: InitiativeRow): Initiative {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    blockerSummary: row.blocker_summary,
    createdAt: row.created_at,
  };
}

async function getInitiative(
  db: AsyncDb,
  id: number,
): Promise<Initiative | null> {
  const [row] = await db.select<InitiativeRow>(
    `SELECT ${INITIATIVE_COLUMNS}
     FROM initiatives
     WHERE id = ?`,
    [id],
  );

  return row ? mapInitiative(row) : null;
}

async function findInitiativeByName(
  db: AsyncDb,
  name: string,
): Promise<Initiative | null> {
  const [row] = await db.select<InitiativeRow>(
    `SELECT ${INITIATIVE_COLUMNS}
     FROM initiatives
     WHERE name = ? COLLATE NOCASE`,
    [name],
  );

  return row ? mapInitiative(row) : null;
}

export async function createInitiative(
  db: AsyncDb,
  input: CreateInitiativeInput,
): Promise<Initiative> {
  if (await findInitiativeByName(db, input.name)) {
    throw new Error("Bu isimde kayıt var");
  }

  const [row] = await db.select<InitiativeRow>(
    `INSERT INTO initiatives (name, status, blocker_summary, created_at)
     VALUES (?, ?, ?, ?)
     RETURNING ${INITIATIVE_COLUMNS}`,
    [input.name, input.status, input.blockerSummary ?? null, input.nowIso],
  );

  return mapInitiative(row);
}

export async function listInitiatives(db: AsyncDb): Promise<Initiative[]> {
  const rows = await db.select<InitiativeRow>(
    `SELECT ${INITIATIVE_COLUMNS}
     FROM initiatives
     ORDER BY name COLLATE NOCASE, id`,
  );

  return rows.map(mapInitiative);
}

export async function updateInitiative(
  db: AsyncDb,
  id: number,
  patch: UpdateInitiativePatch,
): Promise<Initiative> {
  const current = await getInitiative(db, id);
  if (!current) {
    throw new Error("Kayıt bulunamadı");
  }

  const name = patch.name ?? current.name;
  const duplicate = await findInitiativeByName(db, name);
  if (duplicate && duplicate.id !== id) {
    throw new Error("Bu isimde kayıt var");
  }

  const [row] = await db.select<InitiativeRow>(
    `UPDATE initiatives
     SET name = ?, status = ?, blocker_summary = ?
     WHERE id = ?
     RETURNING ${INITIATIVE_COLUMNS}`,
    [
      name,
      patch.status ?? current.status,
      patch.blockerSummary === undefined
        ? current.blockerSummary
        : patch.blockerSummary,
      id,
    ],
  );

  return mapInitiative(row);
}

export async function deleteInitiative(
  db: AsyncDb,
  id: number,
): Promise<void> {
  await db.execute("DELETE FROM note_initiatives WHERE initiative_id = ?", [
    id,
  ]);
  await db.execute("DELETE FROM initiatives WHERE id = ?", [id]);
}

export { linkNoteToInitiatives, listNotesForInitiative };
