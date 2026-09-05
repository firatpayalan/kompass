import type { PersonLabel } from "../lib/types";
import {
  BUILTIN_PERSON_LABELS,
  isPersonLabelColor,
  type PersonLabelColor,
} from "../lib/personLabels";
import type { AsyncDb } from "./asyncDb";

type LabelRow = {
  id: number;
  name: string;
  color: string;
  created_at: string;
};

export type CreatePersonLabelInput = {
  name: string;
  color: PersonLabelColor;
  nowIso?: string;
};

export type UpdatePersonLabelPatch = {
  name?: string;
  color?: PersonLabelColor;
};

function mapLabel(row: LabelRow): PersonLabel {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export async function ensurePersonLabels(db: AsyncDb): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS person_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  const nowIso = "2026-09-05T00:00:00.000Z";
  for (const builtin of BUILTIN_PERSON_LABELS) {
    await db.execute(
      `INSERT OR IGNORE INTO person_labels (name, color, created_at)
       VALUES (?, ?, ?)`,
      [builtin.name, builtin.color, nowIso],
    );
  }
}

export async function ensurePeopleLabelId(db: AsyncDb): Promise<void> {
  const columns = await db.select<{ name: string }>("PRAGMA table_info(people)");
  if (columns.some((column) => column.name === "label_id")) {
    return;
  }
  await db.execute(
    "ALTER TABLE people ADD COLUMN label_id INTEGER REFERENCES person_labels(id) ON DELETE SET NULL",
  );
}

export async function listPersonLabels(db: AsyncDb): Promise<PersonLabel[]> {
  const rows = await db.select<LabelRow>(
    `SELECT id, name, color, created_at
     FROM person_labels
     ORDER BY name COLLATE NOCASE, id`,
  );
  return rows.map(mapLabel);
}

export async function createPersonLabel(
  db: AsyncDb,
  input: CreatePersonLabelInput,
): Promise<PersonLabel> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Etiket adı boş olamaz");
  }
  if (!isPersonLabelColor(input.color)) {
    throw new Error("Geçersiz renk");
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  try {
    const [row] = await db.select<LabelRow>(
      `INSERT INTO person_labels (name, color, created_at)
       VALUES (?, ?, ?)
       RETURNING id, name, color, created_at`,
      [name, input.color, nowIso],
    );
    return mapLabel(row);
  } catch {
    throw new Error("Bu isimde etiket var");
  }
}

export async function getPersonLabel(
  db: AsyncDb,
  id: number,
): Promise<PersonLabel | null> {
  const [row] = await db.select<LabelRow>(
    `SELECT id, name, color, created_at
     FROM person_labels
     WHERE id = ?`,
    [id],
  );
  return row ? mapLabel(row) : null;
}

export async function updatePersonLabel(
  db: AsyncDb,
  id: number,
  patch: UpdatePersonLabelPatch,
): Promise<PersonLabel> {
  const existing = await getPersonLabel(db, id);
  if (!existing) {
    throw new Error("Etiket bulunamadı");
  }

  const nextName =
    patch.name !== undefined ? patch.name.trim() : existing.name;
  const nextColor = patch.color ?? existing.color;

  if (!nextName) {
    throw new Error("Etiket adı boş olamaz");
  }
  if (!isPersonLabelColor(nextColor)) {
    throw new Error("Geçersiz renk");
  }

  if (
    nextName.localeCompare(existing.name, "tr", { sensitivity: "base" }) !== 0
  ) {
    const [dup] = await db.select<{ id: number }>(
      `SELECT id FROM person_labels
       WHERE name = ? COLLATE NOCASE AND id != ?`,
      [nextName, id],
    );
    if (dup) {
      throw new Error("Bu isimde etiket var");
    }
  }

  try {
    const [row] = await db.select<LabelRow>(
      `UPDATE person_labels
       SET name = ?, color = ?
       WHERE id = ?
       RETURNING id, name, color, created_at`,
      [nextName, nextColor, id],
    );
    return mapLabel(row);
  } catch {
    throw new Error("Bu isimde etiket var");
  }
}
