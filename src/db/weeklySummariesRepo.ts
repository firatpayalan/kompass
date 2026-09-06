import type { AsyncDb } from "./asyncDb";

export type WeeklySummary = {
  weekStart: string;
  content: string;
  provider: "claude" | "openai";
  model: string;
  createdAt: string;
};

type Row = {
  week_start: string;
  content: string;
  provider: string;
  model: string;
  created_at: string;
};

export async function ensureWeeklySummariesTable(db: AsyncDb): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS weekly_summaries (
      week_start TEXT PRIMARY KEY,
      content TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

export async function getWeeklySummary(
  db: AsyncDb,
  weekStart: string,
): Promise<WeeklySummary | null> {
  const rows = await db.select<Row>(
    `SELECT week_start, content, provider, model, created_at
     FROM weekly_summaries WHERE week_start = ?`,
    [weekStart],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    weekStart: row.week_start,
    content: row.content,
    provider: row.provider as "claude" | "openai",
    model: row.model,
    createdAt: row.created_at,
  };
}

export async function upsertWeeklySummary(
  db: AsyncDb,
  input: WeeklySummary,
): Promise<void> {
  await db.execute(
    `INSERT INTO weekly_summaries (week_start, content, provider, model, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(week_start) DO UPDATE SET
       content = excluded.content,
       provider = excluded.provider,
       model = excluded.model,
       created_at = excluded.created_at`,
    [
      input.weekStart,
      input.content,
      input.provider,
      input.model,
      input.createdAt,
    ],
  );
}
