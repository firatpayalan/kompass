import type { TopicTag } from "../lib/types";
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

export type AddTopicTagInput = {
  name: string;
  color: PersonLabelColor;
  nowIso?: string;
};

export type UpdateTopicTagPatch = {
  name?: string;
  color?: PersonLabelColor;
};

function mapTag(row: TagRow): TopicTag {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    createdAt: row.created_at,
  };
}

export async function ensureTopicTagsSchema(db: AsyncDb): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS topic_tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS topic_tag_links (
      topic_id INTEGER NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES topic_tags(id) ON DELETE CASCADE,
      PRIMARY KEY (topic_id, tag_id)
    )
  `);
}

export async function listTagsForTopic(
  db: AsyncDb,
  topicId: number,
): Promise<TopicTag[]> {
  const rows = await db.select<TagRow>(
    `SELECT topic_tags.id, topic_tags.name, topic_tags.color, topic_tags.created_at
     FROM topic_tag_links
     JOIN topic_tags ON topic_tags.id = topic_tag_links.tag_id
     WHERE topic_tag_links.topic_id = ?
     ORDER BY topic_tags.name COLLATE NOCASE, topic_tags.id`,
    [topicId],
  );
  return rows.map(mapTag);
}

export async function listTopicTags(db: AsyncDb): Promise<TopicTag[]> {
  const rows = await db.select<TagRow>(
    `SELECT id, name, color, created_at
     FROM topic_tags
     ORDER BY name COLLATE NOCASE, id`,
  );
  return rows.map(mapTag);
}

export async function linkTagToTopic(
  db: AsyncDb,
  topicId: number,
  tagId: number,
): Promise<TopicTag> {
  const tag = await getTopicTag(db, tagId);
  if (!tag) {
    throw new Error("Etiket bulunamadı");
  }
  await db.execute(
    `INSERT OR IGNORE INTO topic_tag_links (topic_id, tag_id) VALUES (?, ?)`,
    [topicId, tagId],
  );
  return tag;
}

export async function getTopicTag(
  db: AsyncDb,
  id: number,
): Promise<TopicTag | null> {
  const [row] = await db.select<TagRow>(
    `SELECT id, name, color, created_at FROM topic_tags WHERE id = ?`,
    [id],
  );
  return row ? mapTag(row) : null;
}

export async function findTopicTagByName(
  db: AsyncDb,
  name: string,
): Promise<TopicTag | null> {
  const [row] = await db.select<TagRow>(
    `SELECT id, name, color, created_at
     FROM topic_tags
     WHERE name = ? COLLATE NOCASE`,
    [name.trim()],
  );
  return row ? mapTag(row) : null;
}

export async function addTagToTopic(
  db: AsyncDb,
  topicId: number,
  input: AddTopicTagInput,
): Promise<TopicTag> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Etiket adı boş olamaz");
  }
  if (!isPersonLabelColor(input.color)) {
    throw new Error("Geçersiz renk");
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  let tag = await findTopicTagByName(db, name);
  if (!tag) {
    const [row] = await db.select<TagRow>(
      `INSERT INTO topic_tags (name, color, created_at)
       VALUES (?, ?, ?)
       RETURNING id, name, color, created_at`,
      [name, input.color, nowIso],
    );
    tag = mapTag(row);
  } else if (tag.color !== input.color) {
    tag = await updateTopicTag(db, tag.id, { color: input.color });
  }

  await db.execute(
    `INSERT OR IGNORE INTO topic_tag_links (topic_id, tag_id) VALUES (?, ?)`,
    [topicId, tag.id],
  );
  return tag;
}

export async function updateTopicTag(
  db: AsyncDb,
  id: number,
  patch: UpdateTopicTagPatch,
): Promise<TopicTag> {
  const existing = await getTopicTag(db, id);
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
    const dup = await findTopicTagByName(db, nextName);
    if (dup && dup.id !== id) {
      throw new Error("Bu isimde etiket var");
    }
  }

  try {
    const [row] = await db.select<TagRow>(
      `UPDATE topic_tags SET name = ?, color = ? WHERE id = ?
       RETURNING id, name, color, created_at`,
      [nextName, nextColor, id],
    );
    return mapTag(row);
  } catch {
    throw new Error("Bu isimde etiket var");
  }
}

export async function deleteTopicTag(db: AsyncDb, id: number): Promise<void> {
  const existing = await getTopicTag(db, id);
  if (!existing) {
    throw new Error("Etiket bulunamadı");
  }
  await db.execute("DELETE FROM topic_tags WHERE id = ?", [id]);
}

export async function removeTagFromTopic(
  db: AsyncDb,
  topicId: number,
  tagId: number,
): Promise<void> {
  await db.execute(
    `DELETE FROM topic_tag_links WHERE topic_id = ? AND tag_id = ?`,
    [topicId, tagId],
  );
}
