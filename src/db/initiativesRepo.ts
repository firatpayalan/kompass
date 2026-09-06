import type { Initiative, InitiativeStatus } from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import { listTagsForInitiative } from "./initiativeTagsRepo";
import { linkNoteToInitiatives, listNotesForInitiative } from "./notesRepo";

type InitiativeRow = {
  id: number;
  name: string;
  status: InitiativeStatus;
  blocker_summary: string | null;
  created_at: string;
  last_activity_at: string;
  sort_order: number;
  archived_at: string | null;
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

const LAST_ACTIVITY_SQL = `COALESCE(
  (
    SELECT MAX(notes.updated_at)
    FROM note_initiatives
    INNER JOIN notes ON notes.id = note_initiatives.note_id
    WHERE note_initiatives.initiative_id = initiatives.id
      AND notes.deleted_at IS NULL
  ),
  initiatives.created_at
)`;

const INITIATIVE_COLUMNS = `id, name, status, blocker_summary, created_at,
  ${LAST_ACTIVITY_SQL} AS last_activity_at,
  sort_order, archived_at`;

function mapInitiative(row: InitiativeRow): Initiative {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    blockerSummary: row.blocker_summary,
    createdAt: row.created_at,
    lastActivityAt: row.last_activity_at,
    sortOrder: row.sort_order,
    archivedAt: row.archived_at,
    tags: [],
  };
}

async function withTags(
  db: AsyncDb,
  initiative: Initiative,
): Promise<Initiative> {
  return {
    ...initiative,
    tags: await listTagsForInitiative(db, initiative.id),
  };
}

/** Adds sort_order for DBs created before the column existed. */
export async function ensureInitiativesSortOrder(db: AsyncDb): Promise<void> {
  const columns = await db.select<{ name: string }>(
    "PRAGMA table_info(initiatives)",
  );
  if (columns.some((column) => column.name === "sort_order")) {
    return;
  }

  await db.execute(
    "ALTER TABLE initiatives ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
  );

  const rows = await db.select<{ id: number }>(
    `SELECT id FROM initiatives ORDER BY name COLLATE NOCASE, id`,
  );
  for (let index = 0; index < rows.length; index += 1) {
    await db.execute("UPDATE initiatives SET sort_order = ? WHERE id = ?", [
      index,
      rows[index].id,
    ]);
  }
}

export async function ensureInitiativesArchivedAt(db: AsyncDb): Promise<void> {
  const columns = await db.select<{ name: string }>(
    "PRAGMA table_info(initiatives)",
  );
  if (columns.some((column) => column.name === "archived_at")) {
    return;
  }
  await db.execute("ALTER TABLE initiatives ADD COLUMN archived_at TEXT");
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

  return row ? withTags(db, mapInitiative(row)) : null;
}

async function findInitiativeByName(
  db: AsyncDb,
  name: string,
): Promise<Initiative | null> {
  const [row] = await db.select<InitiativeRow>(
    `SELECT ${INITIATIVE_COLUMNS}
     FROM initiatives
     WHERE name = ? COLLATE NOCASE
       AND archived_at IS NULL`,
    [name],
  );

  return row ? mapInitiative(row) : null;
}

export async function createInitiative(
  db: AsyncDb,
  input: CreateInitiativeInput,
): Promise<Initiative> {
  return db.withTransaction(async (tx) => {
    if (await findInitiativeByName(tx, input.name)) {
      throw new Error("Bu isimde kayıt var");
    }

    const [row] = await tx.select<{
      id: number;
      name: string;
      status: InitiativeStatus;
      blocker_summary: string | null;
      created_at: string;
      sort_order: number;
      archived_at: string | null;
    }>(
      `INSERT INTO initiatives (name, status, blocker_summary, created_at, sort_order, archived_at)
       VALUES (
         ?,
         ?,
         ?,
         ?,
         COALESCE((SELECT MIN(sort_order) FROM initiatives WHERE archived_at IS NULL), 0) - 1,
         NULL
       )
       RETURNING id, name, status, blocker_summary, created_at, sort_order, archived_at`,
      [input.name, input.status, input.blockerSummary ?? null, input.nowIso],
    );

    if (!row) {
      throw new Error("İş kaydı oluşturulamadı");
    }

    return withTags(
      tx,
      mapInitiative({
        ...row,
        last_activity_at: row.created_at,
      }),
    );
  });
}

export async function listInitiatives(db: AsyncDb): Promise<Initiative[]> {
  const rows = await db.select<InitiativeRow>(
    `SELECT ${INITIATIVE_COLUMNS}
     FROM initiatives
     WHERE archived_at IS NULL
     ORDER BY sort_order ASC, id ASC`,
  );

  return Promise.all(rows.map((row) => withTags(db, mapInitiative(row))));
}

export async function listArchivedInitiatives(
  db: AsyncDb,
): Promise<Initiative[]> {
  const rows = await db.select<InitiativeRow>(
    `SELECT ${INITIATIVE_COLUMNS}
     FROM initiatives
     WHERE archived_at IS NOT NULL
     ORDER BY archived_at DESC, id DESC`,
  );

  return Promise.all(rows.map((row) => withTags(db, mapInitiative(row))));
}

export async function reorderInitiatives(
  db: AsyncDb,
  orderedIds: number[],
): Promise<void> {
  await db.withTransaction(async (tx) => {
    for (let index = 0; index < orderedIds.length; index += 1) {
      await tx.execute("UPDATE initiatives SET sort_order = ? WHERE id = ?", [
        index,
        orderedIds[index],
      ]);
    }
  });
}

export async function archiveInitiative(
  db: AsyncDb,
  id: number,
  nowIso: string,
): Promise<void> {
  await db.withTransaction(async (tx) => {
    const initiative = await getInitiative(tx, id);
    if (!initiative) {
      throw new Error("İş bulunamadı");
    }
    if (initiative.archivedAt) {
      return;
    }

    await tx.execute("UPDATE initiatives SET archived_at = ? WHERE id = ?", [
      nowIso,
      id,
    ]);
    await tx.execute(
      `UPDATE notes
       SET deleted_at = ?
       WHERE deleted_at IS NULL
         AND id IN (
           SELECT note_id FROM note_initiatives WHERE initiative_id = ?
         )`,
      [nowIso, id],
    );
  });
}

export async function restoreInitiative(
  db: AsyncDb,
  id: number,
): Promise<Initiative> {
  return db.withTransaction(async (tx) => {
    const initiative = await getInitiative(tx, id);
    if (!initiative) {
      throw new Error("İş bulunamadı");
    }
    if (!initiative.archivedAt) {
      return initiative;
    }

    await tx.execute(
      `UPDATE notes
       SET deleted_at = NULL
       WHERE deleted_at = ?
         AND id IN (
           SELECT note_id FROM note_initiatives WHERE initiative_id = ?
         )`,
      [initiative.archivedAt, id],
    );
    await tx.execute(
      "UPDATE initiatives SET archived_at = NULL WHERE id = ?",
      [id],
    );

    const restored = await getInitiative(tx, id);
    if (!restored) {
      throw new Error("İş bulunamadı");
    }
    return restored;
  });
}

export async function updateInitiative(
  db: AsyncDb,
  id: number,
  patch: UpdateInitiativePatch,
): Promise<Initiative> {
  return db.withTransaction(async (tx) => {
    const current = await getInitiative(tx, id);
    if (!current) {
      throw new Error("Kayıt bulunamadı");
    }

    const name = (patch.name ?? current.name).trim();
    if (!name) {
      throw new Error("İş adı boş olamaz");
    }
    const duplicate = await findInitiativeByName(tx, name);
    if (duplicate && duplicate.id !== id) {
      throw new Error("Bu isimde kayıt var");
    }

    await tx.execute(
      `UPDATE initiatives
       SET name = ?, status = ?, blocker_summary = ?
       WHERE id = ?`,
      [
        name,
        patch.status ?? current.status,
        patch.blockerSummary === undefined
          ? current.blockerSummary
          : patch.blockerSummary,
        id,
      ],
    );

    const updated = await getInitiative(tx, id);
    if (!updated) {
      throw new Error("Kayıt bulunamadı");
    }
    return updated;
  });
}

export async function deleteInitiative(
  db: AsyncDb,
  id: number,
): Promise<void> {
  await db.withTransaction(async (tx) => {
    await tx.execute("DELETE FROM note_initiatives WHERE initiative_id = ?", [
      id,
    ]);
    await tx.execute("DELETE FROM initiatives WHERE id = ?", [id]);
  });
}

export { linkNoteToInitiatives, listNotesForInitiative };
