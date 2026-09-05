import type { NoteTag } from "../lib/types";
import {
  isPersonLabelColor,
  type PersonLabelColor,
} from "../lib/personLabels";
import type { AsyncDb } from "./asyncDb";

type TagRow = {
  id: number;
  name: string;
  color: string;
};

export type AddNoteTagInput = {
  name: string;
  color: PersonLabelColor;
};

export type UpdateNoteTagPatch = {
  name?: string;
  color?: PersonLabelColor;
};

function mapTag(row: TagRow): NoteTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color || "slate",
  };
}

export async function ensureNoteTagsColor(db: AsyncDb): Promise<void> {
  const columns = await db.select<{ name: string }>("PRAGMA table_info(tags)");
  if (columns.some((column) => column.name === "color")) {
    return;
  }
  await db.execute(
    "ALTER TABLE tags ADD COLUMN color TEXT NOT NULL DEFAULT 'slate'",
  );
}

export async function listNoteTags(db: AsyncDb): Promise<NoteTag[]> {
  const rows = await db.select<TagRow>(
    `SELECT id, name, color FROM tags ORDER BY name COLLATE NOCASE, id`,
  );
  return rows.map(mapTag);
}

export async function getNoteTag(
  db: AsyncDb,
  id: number,
): Promise<NoteTag | null> {
  const [row] = await db.select<TagRow>(
    `SELECT id, name, color FROM tags WHERE id = ?`,
    [id],
  );
  return row ? mapTag(row) : null;
}

export async function findNoteTagByName(
  db: AsyncDb,
  name: string,
): Promise<NoteTag | null> {
  const [row] = await db.select<TagRow>(
    `SELECT id, name, color FROM tags WHERE name = ? COLLATE NOCASE`,
    [name.trim()],
  );
  return row ? mapTag(row) : null;
}

export async function addTagToNote(
  db: AsyncDb,
  noteId: number,
  input: AddNoteTagInput,
): Promise<NoteTag> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Etiket adı boş olamaz");
  }
  if (!isPersonLabelColor(input.color)) {
    throw new Error("Geçersiz renk");
  }

  let tag = await findNoteTagByName(db, name);
  if (!tag) {
    const [row] = await db.select<TagRow>(
      `INSERT INTO tags (name, color) VALUES (?, ?)
       RETURNING id, name, color`,
      [name, input.color],
    );
    tag = mapTag(row);
  } else if (tag.color !== input.color) {
    tag = await updateNoteTag(db, tag.id, { color: input.color });
  }

  await db.execute(
    `INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)`,
    [noteId, tag.id],
  );
  return tag;
}

export async function linkTagToNote(
  db: AsyncDb,
  noteId: number,
  tagId: number,
): Promise<NoteTag> {
  const tag = await getNoteTag(db, tagId);
  if (!tag) {
    throw new Error("Etiket bulunamadı");
  }
  await db.execute(
    `INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)`,
    [noteId, tagId],
  );
  return tag;
}

export async function updateNoteTag(
  db: AsyncDb,
  id: number,
  patch: UpdateNoteTagPatch,
): Promise<NoteTag> {
  const existing = await getNoteTag(db, id);
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
    const dup = await findNoteTagByName(db, nextName);
    if (dup && dup.id !== id) {
      throw new Error("Bu isimde etiket var");
    }
  }

  try {
    const [row] = await db.select<TagRow>(
      `UPDATE tags SET name = ?, color = ? WHERE id = ?
       RETURNING id, name, color`,
      [nextName, nextColor, id],
    );
    return mapTag(row);
  } catch {
    throw new Error("Bu isimde etiket var");
  }
}

export async function deleteNoteTag(db: AsyncDb, id: number): Promise<void> {
  const existing = await getNoteTag(db, id);
  if (!existing) {
    throw new Error("Etiket bulunamadı");
  }
  await db.execute("DELETE FROM tags WHERE id = ?", [id]);
}
