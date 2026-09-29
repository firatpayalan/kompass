import type { Initiative, Note, Topic, TopicTag } from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import { createInitiative } from "./initiativesRepo";
import {
  createNote,
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
  archived_at: string | null;
};

type IdRow = { id: number };

export type CreateTopicInput = {
  title: string;
  nowIso?: string;
} & ({ personId: number; initiativeId?: never } | { initiativeId: number; personId?: never });

const TOPIC_COLUMNS =
  "id, person_id, initiative_id, title, created_at, archived_at";

function mapTopic(row: TopicRow): Topic {
  return {
    id: row.id,
    personId: row.person_id,
    initiativeId: row.initiative_id,
    title: row.title,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
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
            archived_at TEXT,
            CHECK (
              (person_id IS NOT NULL AND initiative_id IS NULL)
              OR (person_id IS NULL AND initiative_id IS NOT NULL)
            )
          )
        `);

        if (hasInitiative) {
          const hasArchived = columns.some(
            (column) => column.name === "archived_at",
          );
          if (hasArchived) {
            await tx.execute(`
              INSERT INTO topics_new (id, person_id, initiative_id, title, created_at, archived_at)
              SELECT id, person_id, initiative_id, title, created_at, archived_at FROM topics
            `);
          } else {
            await tx.execute(`
              INSERT INTO topics_new (id, person_id, initiative_id, title, created_at, archived_at)
              SELECT id, person_id, initiative_id, title, created_at, NULL FROM topics
            `);
          }
        } else {
          await tx.execute(`
            INSERT INTO topics_new (id, person_id, initiative_id, title, created_at, archived_at)
            SELECT id, person_id, NULL, title, created_at, NULL FROM topics
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

/** Adds archived_at and recreates title uniqueness to ignore archived topics. */
export async function ensureTopicsArchivedAt(db: AsyncDb): Promise<void> {
  const columns = await db.select<{ name: string }>("PRAGMA table_info(topics)");
  if (columns.length === 0) {
    return;
  }

  if (!columns.some((column) => column.name === "archived_at")) {
    await db.execute("ALTER TABLE topics ADD COLUMN archived_at TEXT");
  }

  await db.execute("DROP INDEX IF EXISTS topics_person_title_unique");
  await db.execute("DROP INDEX IF EXISTS topics_initiative_title_unique");
  await db.execute(`
    CREATE UNIQUE INDEX topics_person_title_unique
      ON topics(person_id, title COLLATE NOCASE)
      WHERE person_id IS NOT NULL AND archived_at IS NULL
  `);
  await db.execute(`
    CREATE UNIQUE INDEX topics_initiative_title_unique
      ON topics(initiative_id, title COLLATE NOCASE)
      WHERE initiative_id IS NOT NULL AND archived_at IS NULL
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
     WHERE person_id = ? AND title = ? COLLATE NOCASE AND archived_at IS NULL`,
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
     WHERE initiative_id = ? AND title = ? COLLATE NOCASE AND archived_at IS NULL`,
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
    `INSERT INTO topics (person_id, initiative_id, title, created_at, archived_at)
     VALUES (?, ?, ?, ?, NULL)
     RETURNING id`,
    [personId, initiativeId, title, nowIso],
  );

  return {
    id: inserted.id,
    personId: personId ?? null,
    initiativeId: initiativeId ?? null,
    title,
    createdAt: nowIso,
    archivedAt: null,
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
  options: { includeArchived?: boolean } = {},
): Promise<Topic[]> {
  const includeArchived = options.includeArchived === true;
  const rows = await db.select<TopicRow>(
    `SELECT ${TOPIC_COLUMNS}
     FROM topics
     WHERE person_id = ?
       ${includeArchived ? "" : "AND archived_at IS NULL"}
     ORDER BY created_at DESC, id DESC`,
    [personId],
  );
  return rows.map(mapTopic);
}

export async function listTopicsForInitiative(
  db: AsyncDb,
  initiativeId: number,
  options: { includeArchived?: boolean } = {},
): Promise<Topic[]> {
  const includeArchived = options.includeArchived === true;
  const rows = await db.select<TopicRow>(
    `SELECT ${TOPIC_COLUMNS}
     FROM topics
     WHERE initiative_id = ?
       ${includeArchived ? "" : "AND archived_at IS NULL"}
     ORDER BY created_at DESC, id DESC`,
    [initiativeId],
  );
  return rows.map(mapTopic);
}

export type TopicWithNotes = Topic & {
  notes: Note[];
  tags: TopicTag[];
};

export type ArchivedTopic = Topic & {
  archivedAt: string;
  ownerKind: "person" | "initiative";
  ownerName: string;
};

export async function listTopicsWithNotesForPerson(
  db: AsyncDb,
  personId: number,
  options: {
    includeDeletedNotes?: boolean;
    includeArchivedTopics?: boolean;
  } = {},
): Promise<{ topics: TopicWithNotes[]; untopicNotes: Note[] }> {
  const noteOpts = { includeDeleted: options.includeDeletedNotes === true };
  const topics = await listTopicsForPerson(db, personId, {
    includeArchived: options.includeArchivedTopics === true,
  });
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
  options: {
    includeDeletedNotes?: boolean;
    includeArchivedTopics?: boolean;
  } = {},
): Promise<{ topics: TopicWithNotes[]; untopicNotes: Note[] }> {
  const noteOpts = { includeDeleted: options.includeDeletedNotes === true };
  const topics = await listTopicsForInitiative(db, initiativeId, {
    includeArchived: options.includeArchivedTopics === true,
  });
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

export async function listArchivedTopics(
  db: AsyncDb,
): Promise<ArchivedTopic[]> {
  type ArchivedRow = TopicRow & {
    owner_kind: "person" | "initiative";
    owner_name: string;
  };
  const rows = await db.select<ArchivedRow>(
    `SELECT
       topics.id,
       topics.person_id,
       topics.initiative_id,
       topics.title,
       topics.created_at,
       topics.archived_at,
       CASE
         WHEN topics.person_id IS NOT NULL THEN 'person'
         ELSE 'initiative'
       END AS owner_kind,
       COALESCE(people.name, initiatives.name, '') AS owner_name
     FROM topics
     LEFT JOIN people ON people.id = topics.person_id
     LEFT JOIN initiatives ON initiatives.id = topics.initiative_id
     WHERE topics.archived_at IS NOT NULL
     ORDER BY topics.archived_at DESC, topics.id DESC`,
  );
  return rows.map((row) => ({
    ...mapTopic(row),
    archivedAt: row.archived_at as string,
    ownerKind: row.owner_kind,
    ownerName: row.owner_name,
  }));
}

export async function archiveTopic(
  db: AsyncDb,
  id: number,
  nowIso: string,
): Promise<void> {
  const topic = await getTopic(db, id);
  if (!topic) {
    throw new Error("Konu bulunamadı");
  }
  if (topic.archivedAt) {
    return;
  }
  await db.execute("UPDATE topics SET archived_at = ? WHERE id = ?", [
    nowIso,
    id,
  ]);
}

export async function restoreTopic(db: AsyncDb, id: number): Promise<Topic> {
  const topic = await getTopic(db, id);
  if (!topic) {
    throw new Error("Konu bulunamadı");
  }
  if (!topic.archivedAt) {
    return topic;
  }

  const duplicate =
    topic.personId != null
      ? await findTopicByTitleForPerson(db, topic.personId, topic.title)
      : topic.initiativeId != null
        ? await findTopicByTitleForInitiative(
            db,
            topic.initiativeId,
            topic.title,
          )
        : null;
  if (duplicate) {
    throw new Error("Bu isimde aktif bir konu var");
  }

  await db.execute("UPDATE topics SET archived_at = NULL WHERE id = ?", [id]);
  const restored = await getTopic(db, id);
  if (!restored) {
    throw new Error("Konu bulunamadı");
  }
  return restored;
}

export async function promoteTopicToInitiative(
  db: AsyncDb,
  topicId: number,
  nowIso: string,
): Promise<Initiative> {
  return db.withTransaction(async (tx) => {
    const topic = await getTopic(tx, topicId);
    if (!topic) {
      throw new Error("Konu bulunamadı");
    }
    if (topic.archivedAt) {
      throw new Error("Arşivlenmiş konu işe çevrilemez");
    }
    if (topic.initiativeId == null) {
      throw new Error("Bu konu bir işe ait değil");
    }

    const created = await createInitiative(tx, {
      name: topic.title,
      status: "aktif",
      nowIso,
    });

    const topicTrail = `Bu konu “${created.name}” işine taşınmıştır.`;
    const initiativeTrail = `“${topic.title}” konusundan taşınmıştır.`;

    await createNote(tx, {
      body: topicTrail,
      initiativeIds: [topic.initiativeId],
      topicIds: [topic.id],
      nowIso,
    });
    await createNote(tx, {
      body: initiativeTrail,
      initiativeIds: [created.id],
      nowIso,
    });

    return created;
  });
}

export { listNotesForTopic, listUntopicNotesForPerson, listUntopicNotesForInitiative };
