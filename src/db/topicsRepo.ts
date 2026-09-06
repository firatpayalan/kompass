import type { Note, Topic, TopicTag } from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import {
  listNotesForTopic,
  listUntopicNotesForInitiative,
  listUntopicNotesForPerson,
} from "./notesRepo";
import { listTagsForTopic } from "./topicTagsRepo";

type TopicRow = {
  id: number;
  person_id: number | null;
  initiative_id: number | null;
  title: string;
  created_at: string;
};

type IdRow = { id: number };

export type CreateTopicInput = {
  title: string;
  nowIso?: string;
} & ({ personId: number; initiativeId?: never } | { initiativeId: number; personId?: never });

const TOPIC_COLUMNS =
  "id, person_id, initiative_id, title, created_at";

function mapTopic(row: TopicRow): Topic {
  return {
    id: row.id,
    personId: row.person_id,
    initiativeId: row.initiative_id,
    title: row.title,
    createdAt: row.created_at,
  };
}

/** Migrates legacy person-only topics to support initiative owners. */
export async function ensureTopicsInitiativeOwner(db: AsyncDb): Promise<void> {
  const columns = await db.select<{ name: string; notnull: number }>(
    "PRAGMA table_info(topics)",
  );
  if (columns.length === 0) {
    // Table missing — schema apply should create it; still ensure indexes if present later.
    return;
  }

  const hasInitiative = columns.some((column) => column.name === "initiative_id");
  const personCol = columns.find((column) => column.name === "person_id");
  const personNotNull = personCol?.notnull === 1;

  if (!hasInitiative || personNotNull) {
    await db.execute("PRAGMA foreign_keys = OFF");
    try {
      await db.withTransaction(async (tx) => {
        await tx.execute(`
          CREATE TABLE topics_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            person_id INTEGER REFERENCES people(id) ON DELETE CASCADE,
            initiative_id INTEGER REFERENCES initiatives(id) ON DELETE CASCADE,
            title TEXT NOT NULL COLLATE NOCASE,
            created_at TEXT NOT NULL,
            CHECK (
              (person_id IS NOT NULL AND initiative_id IS NULL)
              OR (person_id IS NULL AND initiative_id IS NOT NULL)
            )
          )
        `);

        if (hasInitiative) {
          await tx.execute(`
            INSERT INTO topics_new (id, person_id, initiative_id, title, created_at)
            SELECT id, person_id, initiative_id, title, created_at FROM topics
          `);
        } else {
          await tx.execute(`
            INSERT INTO topics_new (id, person_id, initiative_id, title, created_at)
            SELECT id, person_id, NULL, title, created_at FROM topics
          `);
        }

        await tx.execute("DROP TABLE topics");
        await tx.execute("ALTER TABLE topics_new RENAME TO topics");
      });
    } finally {
      await db.execute("PRAGMA foreign_keys = ON");
    }
  }

  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS topics_person_title_unique
      ON topics(person_id, title COLLATE NOCASE)
      WHERE person_id IS NOT NULL
  `);
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS topics_initiative_title_unique
      ON topics(initiative_id, title COLLATE NOCASE)
      WHERE initiative_id IS NOT NULL
  `);
}

export async function findTopicByTitleForPerson(
  db: AsyncDb,
  personId: number,
  title: string,
): Promise<Topic | null> {
  const rows = await db.select<TopicRow>(
    `SELECT ${TOPIC_COLUMNS}
     FROM topics
     WHERE person_id = ? AND title = ? COLLATE NOCASE`,
    [personId, title.trim()],
  );
  return rows[0] ? mapTopic(rows[0]) : null;
}

export async function findTopicByTitleForInitiative(
  db: AsyncDb,
  initiativeId: number,
  title: string,
): Promise<Topic | null> {
  const rows = await db.select<TopicRow>(
    `SELECT ${TOPIC_COLUMNS}
     FROM topics
     WHERE initiative_id = ? AND title = ? COLLATE NOCASE`,
    [initiativeId, title.trim()],
  );
  return rows[0] ? mapTopic(rows[0]) : null;
}

/** @deprecated use findTopicByTitleForPerson */
export async function findTopicByTitle(
  db: AsyncDb,
  personId: number,
  title: string,
): Promise<Topic | null> {
  return findTopicByTitleForPerson(db, personId, title);
}

export async function createTopic(
  db: AsyncDb,
  input: CreateTopicInput,
): Promise<Topic> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Konu boş olamaz");
  }

  const personId = "personId" in input ? input.personId : null;
  const initiativeId = "initiativeId" in input ? input.initiativeId : null;
  if ((personId == null) === (initiativeId == null)) {
    throw new Error("Konu sahibi gerekli");
  }

  if (personId != null) {
    if (await findTopicByTitleForPerson(db, personId, title)) {
      throw new Error("Bu isimde konu var");
    }
  } else if (initiativeId != null) {
    if (await findTopicByTitleForInitiative(db, initiativeId, title)) {
      throw new Error("Bu isimde konu var");
    }
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const [inserted] = await db.select<IdRow>(
    `INSERT INTO topics (person_id, initiative_id, title, created_at)
     VALUES (?, ?, ?, ?)
     RETURNING id`,
    [personId, initiativeId, title, nowIso],
  );

  return {
    id: inserted.id,
    personId: personId ?? null,
    initiativeId: initiativeId ?? null,
    title,
    createdAt: nowIso,
  };
}

export async function getTopic(
  db: AsyncDb,
  id: number,
): Promise<Topic | null> {
  const rows = await db.select<TopicRow>(
    `SELECT ${TOPIC_COLUMNS}
     FROM topics
     WHERE id = ?`,
    [id],
  );
  return rows[0] ? mapTopic(rows[0]) : null;
}

export async function updateTopic(
  db: AsyncDb,
  id: number,
  title: string,
): Promise<Topic> {
  const trimmed = title.trim();
  if (!trimmed) {
    throw new Error("Konu boş olamaz");
  }

  const current = await getTopic(db, id);
  if (!current) {
    throw new Error("Konu bulunamadı");
  }

  const duplicate =
    current.personId != null
      ? await findTopicByTitleForPerson(db, current.personId, trimmed)
      : current.initiativeId != null
        ? await findTopicByTitleForInitiative(db, current.initiativeId, trimmed)
        : null;
  if (duplicate && duplicate.id !== id) {
    throw new Error("Bu isimde konu var");
  }

  await db.execute(`UPDATE topics SET title = ? WHERE id = ?`, [
    trimmed,
    id,
  ]);

  return { ...current, title: trimmed };
}

export async function listTopicsForPerson(
  db: AsyncDb,
  personId: number,
): Promise<Topic[]> {
  const rows = await db.select<TopicRow>(
    `SELECT ${TOPIC_COLUMNS}
     FROM topics
     WHERE person_id = ?
     ORDER BY created_at DESC, id DESC`,
    [personId],
  );
  return rows.map(mapTopic);
}

export async function listTopicsForInitiative(
  db: AsyncDb,
  initiativeId: number,
): Promise<Topic[]> {
  const rows = await db.select<TopicRow>(
    `SELECT ${TOPIC_COLUMNS}
     FROM topics
     WHERE initiative_id = ?
     ORDER BY created_at DESC, id DESC`,
    [initiativeId],
  );
  return rows.map(mapTopic);
}

export type TopicWithNotes = Topic & {
  notes: Note[];
  tags: TopicTag[];
};

export async function listTopicsWithNotesForPerson(
  db: AsyncDb,
  personId: number,
  options: { includeDeletedNotes?: boolean } = {},
): Promise<{ topics: TopicWithNotes[]; untopicNotes: Note[] }> {
  const noteOpts = { includeDeleted: options.includeDeletedNotes === true };
  const topics = await listTopicsForPerson(db, personId);
  const topicsWithNotes = await Promise.all(
    topics.map(async (topic) => ({
      ...topic,
      notes: await listNotesForTopic(db, topic.id, noteOpts),
      tags: await listTagsForTopic(db, topic.id),
    })),
  );
  const untopicNotes = await listUntopicNotesForPerson(
    db,
    personId,
    noteOpts,
  );
  return { topics: topicsWithNotes, untopicNotes };
}

export async function listTopicsWithNotesForInitiative(
  db: AsyncDb,
  initiativeId: number,
  options: { includeDeletedNotes?: boolean } = {},
): Promise<{ topics: TopicWithNotes[]; untopicNotes: Note[] }> {
  const noteOpts = { includeDeleted: options.includeDeletedNotes === true };
  const topics = await listTopicsForInitiative(db, initiativeId);
  const topicsWithNotes = await Promise.all(
    topics.map(async (topic) => ({
      ...topic,
      notes: await listNotesForTopic(db, topic.id, noteOpts),
      tags: await listTagsForTopic(db, topic.id),
    })),
  );
  const untopicNotes = await listUntopicNotesForInitiative(
    db,
    initiativeId,
    noteOpts,
  );
  return { topics: topicsWithNotes, untopicNotes };
}

export { listNotesForTopic, listUntopicNotesForPerson, listUntopicNotesForInitiative };
