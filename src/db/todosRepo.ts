import { BUILTIN_TODO_STATUSES } from "../lib/todoStatuses";
import { isPersonLabelColor } from "../lib/personLabels";
import type { TodoStatus } from "../lib/types";
import type { AsyncDb } from "./asyncDb";

type TodoStatusRow = {
  id: number;
  name: string;
  color: string;
  counts_as_complete: number;
  sort_order: number;
  is_builtin: number;
  created_at: string;
};

const TODO_STATUS_SELECT = `SELECT id, name, color, counts_as_complete, sort_order, is_builtin, created_at`;

function mapTodoStatus(row: TodoStatusRow): TodoStatus {
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    countsAsComplete: row.counts_as_complete !== 0,
    sortOrder: row.sort_order,
    isBuiltin: row.is_builtin !== 0,
    createdAt: row.created_at,
  };
}

export async function ensureTodosSchema(db: AsyncDb): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS todo_statuses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      color TEXT NOT NULL,
      counts_as_complete INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_builtin INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      note_id INTEGER NOT NULL UNIQUE REFERENCES notes(id) ON DELETE CASCADE,
      status_id INTEGER NOT NULL REFERENCES todo_statuses(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      completed_at TEXT
    )
  `);

  const nowIso = "2026-09-05T00:00:00.000Z";
  for (const builtin of BUILTIN_TODO_STATUSES) {
    await db.execute(
      `INSERT OR IGNORE INTO todo_statuses
         (name, color, counts_as_complete, sort_order, is_builtin, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
      [
        builtin.name,
        builtin.color,
        builtin.countsAsComplete ? 1 : 0,
        builtin.sortOrder,
        nowIso,
      ],
    );
  }
}

export async function listTodoStatuses(db: AsyncDb): Promise<TodoStatus[]> {
  const rows = await db.select<TodoStatusRow>(
    `${TODO_STATUS_SELECT}
     FROM todo_statuses
     ORDER BY sort_order, id`,
  );
  return rows.map(mapTodoStatus);
}

export async function createTodoStatus(
  db: AsyncDb,
  input: {
    name: string;
    color: string;
    countsAsComplete: boolean;
    nowIso?: string;
  },
): Promise<TodoStatus> {
  const name = input.name.trim();
  if (!name) {
    throw new Error("Durum adı boş olamaz");
  }
  if (!isPersonLabelColor(input.color)) {
    throw new Error("Geçersiz renk");
  }

  const [maxRow] = await db.select<{ nextOrder: number }>(
    `SELECT COALESCE(MAX(sort_order), -1) + 1 AS nextOrder FROM todo_statuses`,
  );
  const sortOrder = maxRow?.nextOrder ?? 0;
  const nowIso = input.nowIso ?? new Date().toISOString();

  try {
    const [row] = await db.select<TodoStatusRow>(
      `INSERT INTO todo_statuses
         (name, color, counts_as_complete, sort_order, is_builtin, created_at)
       VALUES (?, ?, ?, ?, 0, ?)
       RETURNING id, name, color, counts_as_complete, sort_order, is_builtin, created_at`,
      [name, input.color, input.countsAsComplete ? 1 : 0, sortOrder, nowIso],
    );
    return mapTodoStatus(row);
  } catch {
    throw new Error("Bu isimde durum var");
  }
}

export async function deleteTodoStatus(db: AsyncDb, id: number): Promise<void> {
  const [row] = await db.select<TodoStatusRow>(
    `${TODO_STATUS_SELECT} FROM todo_statuses WHERE id = ?`,
    [id],
  );
  if (!row) {
    throw new Error("Durum bulunamadı");
  }
  if (row.is_builtin !== 0) {
    throw new Error("Hazır durum silinemez");
  }

  const [inUse] = await db.select<{ id: number }>(
    `SELECT id FROM todos WHERE status_id = ? LIMIT 1`,
    [id],
  );
  if (inUse) {
    throw new Error("Durum kullanımda");
  }

  await db.execute("DELETE FROM todo_statuses WHERE id = ?", [id]);
}
