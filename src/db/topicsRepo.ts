import type { Note, Topic } from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import {
  listNotesForTopic,
  listUntopicNotesForPerson,
} from "./notesRepo";

type TopicRow = {
  id: number;
  person_id: number;
  title: string;
  created_at: string;
};

type IdRow = { id: number };

export type CreateTopicInput = {
  personId: number;
  title: string;
  nowIso?: string;
};

function mapTopic(row: TopicRow): Topic {
  return {
    id: row.id,
    personId: row.person_id,
    title: row.title,
    createdAt: row.created_at,
  };
}

export async function findTopicByTitle(
  db: AsyncDb,
  personId: number,
  title: string,
): Promise<Topic | null> {
  const rows = await db.select<TopicRow>(
    `SELECT id, person_id, title, created_at
     FROM topics
     WHERE person_id = ? AND title = ? COLLATE NOCASE`,
    [personId, title.trim()],
  );
  return rows[0] ? mapTopic(rows[0]) : null;
}

export async function createTopic(
  db: AsyncDb,
  input: CreateTopicInput,
): Promise<Topic> {
  const title = input.title.trim();
  if (!title) {
    throw new Error("Konu boş olamaz");
  }
  if (await findTopicByTitle(db, input.personId, title)) {
    throw new Error("Bu isimde konu var");
  }

  const nowIso = input.nowIso ?? new Date().toISOString();
  const [inserted] = await db.select<IdRow>(
    `INSERT INTO topics (person_id, title, created_at)
     VALUES (?, ?, ?)
     RETURNING id`,
    [input.personId, title, nowIso],
  );

  return {
    id: inserted.id,
    personId: input.personId,
    title,
    createdAt: nowIso,
  };
}

export async function listTopicsForPerson(
  db: AsyncDb,
  personId: number,
): Promise<Topic[]> {
  const rows = await db.select<TopicRow>(
    `SELECT id, person_id, title, created_at
     FROM topics
     WHERE person_id = ?
     ORDER BY created_at DESC, id DESC`,
    [personId],
  );
  return rows.map(mapTopic);
}

export type TopicWithNotes = Topic & { notes: Note[] };

export async function listTopicsWithNotesForPerson(
  db: AsyncDb,
  personId: number,
): Promise<{ topics: TopicWithNotes[]; untopicNotes: Note[] }> {
  const topics = await listTopicsForPerson(db, personId);
  const topicsWithNotes = await Promise.all(
    topics.map(async (topic) => ({
      ...topic,
      notes: await listNotesForTopic(db, topic.id),
    })),
  );
  const untopicNotes = await listUntopicNotesForPerson(db, personId);
  return { topics: topicsWithNotes, untopicNotes };
}

export { listNotesForTopic, listUntopicNotesForPerson };
