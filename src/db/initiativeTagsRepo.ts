import type { InitiativeTag } from "../lib/types";
import {
  isPersonLabelColor,
  type PersonLabelColor,
} from "../lib/personLabels";
import type { AsyncDb } from "./asyncDb";

type TagRow = {
  id: number;
  name: string;
  color: string;
  created_at: string;
};

export type AddInitiativeTagInput = {
  name: string;
  color: PersonLabelColor;
  nowIso?: string;
};

export type UpdateInitiativeTagPatch = {
  name?: string;
  color?: PersonLabelColor;
};

function mapTag(row: TagRow): InitiativeTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export async function ensureInitiativeTagsSchema(db: AsyncDb): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS initiative_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS initiative_tag_links (
      initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES initiative_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (initiative_id, tag_id)
    )
  `);
}

export async function listTagsForInitiative(
  db: AsyncDb,
  initiativeId: number,
): Promise<InitiativeTag[]> {
  const rows = await db.select<TagRow>(
    `SELECT initiative_tags.id, initiative_tags.name, initiative_tags.color, initiative_tags.created_at
     FROM initiative_tag_links
     JOIN initiative_tags ON initiative_tags.id = initiative_tag_links.tag_id
     WHERE initiative_tag_links.initiative_id = ?
     ORDER BY initiative_tags.name COLLATE NOCASE, initiative_tags.id`,
    [initiativeId],
  );
  return rows.map(mapTag);
}

export async function listInitiativeTags(db: AsyncDb): Promise<InitiativeTag[]> {
  const rows = await db.select<TagRow>(
    `SELECT id, name, color, created_at
     FROM initiative_tags
     ORDER BY name COLLATE NOCASE, id`,
  );
  return rows.map(mapTag);
}

export async function linkTagToInitiative(
  db: AsyncDb,
  initiativeId: number,
  tagId: number,
): Promise<InitiativeTag> {
  const tag = await getInitiativeTag(db, tagId);
  if (!tag) {
    throw new Error("Etiket bulunamadı");
  }
  await db.execute(
    `INSERT OR IGNORE INTO initiative_tag_links (initiative_id, tag_id) VALUES (?, ?)`,
    [initiativeId, tagId],
  );
  return tag;
}

export async function getInitiativeTag(
  db: AsyncDb,
  id: number,
): Promise<InitiativeTag | null> {
  const [row] = await db.select<TagRow>(
    `SELECT id, name, color, created_at FROM initiative_tags WHERE id = ?`,
    [id],
  );
  return row ? mapTag(row) : null;
}

export async function findInitiativeTagByName(
  db: AsyncDb,
  name: string,
): Promise<InitiativeTag | null> {
  const [row] = await db.select<TagRow>(
    `SELECT id, name, color, created_at
     FROM initiative_tags
     WHERE name = ? COLLATE NOCASE`,
    [name.trim()],
  );
  return row ? mapTag(row) : null;
}

export async function addTagToInitiative(
  db: AsyncDb,
  initiativeId: number,
  input: AddInitiativeTagInput,
): Promise<InitiativeTag> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Etiket adı boş olamaz");
  }
  if (!isPersonLabelColor(input.color)) {
    throw new Error("Geçersiz renk");
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  let tag = await findInitiativeTagByName(db, name);
  if (!tag) {
    const [row] = await db.select<TagRow>(
      `INSERT INTO initiative_tags (name, color, created_at)
       VALUES (?, ?, ?)
       RETURNING id, name, color, created_at`,
      [name, input.color, nowIso],
    );
    tag = mapTag(row);
  } else if (tag.color !== input.color) {
    tag = await updateInitiativeTag(db, tag.id, { color: input.color });
  }

  await db.execute(
    `INSERT OR IGNORE INTO initiative_tag_links (initiative_id, tag_id) VALUES (?, ?)`,
    [initiativeId, tag.id],
  );
  return tag;
}

export async function updateInitiativeTag(
  db: AsyncDb,
  id: number,
  patch: UpdateInitiativeTagPatch,
): Promise<InitiativeTag> {
  const existing = await getInitiativeTag(db, id);
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
    const dup = await findInitiativeTagByName(db, nextName);
    if (dup && dup.id !== id) {
      throw new Error("Bu isimde etiket var");
    }
  }

  try {
    const [row] = await db.select<TagRow>(
      `UPDATE initiative_tags SET name = ?, color = ? WHERE id = ?
       RETURNING id, name, color, created_at`,
      [nextName, nextColor, id],
    );
    return mapTag(row);
  } catch {
    throw new Error("Bu isimde etiket var");
  }
}

export async function deleteInitiativeTag(
  db: AsyncDb,
  id: number,
): Promise<void> {
  const existing = await getInitiativeTag(db, id);
  if (!existing) {
    throw new Error("Etiket bulunamadı");
  }
  await db.execute("DELETE FROM initiative_tags WHERE id = ?", [id]);
}

export async function removeTagFromInitiative(
  db: AsyncDb,
  initiativeId: number,
  tagId: number,
): Promise<void> {
  await db.execute(
    `DELETE FROM initiative_tag_links WHERE initiative_id = ? AND tag_id = ?`,
    [initiativeId, tagId],
  );
}
