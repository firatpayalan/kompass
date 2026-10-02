import { BUILTIN_TODO_STATUSES } from "../lib/todoStatuses";
import { isPersonLabelColor } from "../lib/personLabels";
import type { Todo, TodoListItem, TodoStatus } from "../lib/types";
import type { AsyncDb } from "./asyncDb";
import { createNote, getNote } from "./notesRepo";

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

  const [existing] = await db.select<{ id: number }>(
    `SELECT id FROM todo_statuses WHERE name = ? COLLATE NOCASE`,
    [name],
  );
  if (existing) {
    throw new Error("Bu isimde durum var");
  }

  const [row] = await db.select<TodoStatusRow>(
    `INSERT INTO todo_statuses
       (name, color, counts_as_complete, sort_order, is_builtin, created_at)
     VALUES (?, ?, ?, ?, 0, ?)
     RETURNING id, name, color, counts_as_complete, sort_order, is_builtin, created_at`,
    [name, input.color, input.countsAsComplete ? 1 : 0, sortOrder, nowIso],
  );
  return mapTodoStatus(row);
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

type TodoRow = {
  id: number;
  title: string;
  note_id: number;
  status_id: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type TodoListRow = TodoRow & {
  status_name: string;
  status_color: string;
  counts_as_complete: number;
  note_deleted_at: string | null;
};

type LinkRow = { note_id: number; linked_id: number };

const TODO_SELECT = `SELECT id, title, note_id, status_id, created_at, updated_at, completed_at`;

const COMPLETION_TITLE_MAX = 120;

function mapTodo(row: TodoRow): Todo {
  return {
    id: row.id,
    title: row.title,
    noteId: row.note_id,
    statusId: row.status_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

function truncateTitle(title: string): string {
  const chars = [...title];
  return chars.length > COMPLETION_TITLE_MAX
    ? `${chars.slice(0, COMPLETION_TITLE_MAX).join("").trimEnd()}…`
    : title;
}

async function getTodoRow(db: AsyncDb, id: number): Promise<TodoRow> {
  const [row] = await db.select<TodoRow>(
    `${TODO_SELECT} FROM todos WHERE id = ?`,
    [id],
  );
  if (!row) {
    throw new Error("To-do bulunamadı");
  }
  return row;
}

async function getTodoStatus(db: AsyncDb, id: number): Promise<TodoStatus> {
  const [row] = await db.select<TodoStatusRow>(
    `${TODO_STATUS_SELECT} FROM todo_statuses WHERE id = ?`,
    [id],
  );
  if (!row) {
    throw new Error("Durum bulunamadı");
  }
  return mapTodoStatus(row);
}

export async function createTodoFromNote(
  db: AsyncDb,
  noteId: number,
  nowIso: string = new Date().toISOString(),
): Promise<Todo> {
  const note = await getNote(db, noteId);
  if (!note) {
    throw new Error("Not bulunamadı");
  }
  const title = note.body.trim();
  if (!title) {
    throw new Error("Not boş olamaz");
  }

  const [existing] = await db.select<{ id: number }>(
    `SELECT id FROM todos WHERE note_id = ?`,
    [noteId],
  );
  if (existing) {
    throw new Error("Bu not zaten bir to-do");
  }

  const [open] = await db.select<{ id: number }>(
    `SELECT id FROM todo_statuses WHERE name = 'açık' AND is_builtin = 1`,
  );
  if (!open) {
    throw new Error("Durum bulunamadı");
  }

  const [row] = await db.select<TodoRow>(
    `INSERT INTO todos (title, note_id, status_id, created_at, updated_at, completed_at)
     VALUES (?, ?, ?, ?, ?, NULL)
     RETURNING id, title, note_id, status_id, created_at, updated_at, completed_at`,
    [title, noteId, open.id, nowIso, nowIso],
  );
  return mapTodo(row);
}

async function linkedIdsByNote(
  db: AsyncDb,
  table: "note_people" | "note_initiatives",
  idColumn: "person_id" | "initiative_id",
  noteIds: number[],
): Promise<Map<number, number[]>> {
  const grouped = new Map<number, number[]>();
  if (noteIds.length === 0) {
    return grouped;
  }
  const rows = await db.select<LinkRow>(
    `SELECT note_id, ${idColumn} AS linked_id
     FROM ${table}
     WHERE note_id IN (${noteIds.map(() => "?").join(", ")})
     ORDER BY rowid`,
    noteIds,
  );
  for (const row of rows) {
    const list = grouped.get(row.note_id);
    if (list) {
      list.push(row.linked_id);
    } else {
      grouped.set(row.note_id, [row.linked_id]);
    }
  }
  return grouped;
}

export async function listTodos(
  db: AsyncDb,
  filter: { completion?: "all" | "open" | "done" } = {},
): Promise<TodoListItem[]> {
  const completion = filter.completion ?? "all";
  const where =
    completion === "open"
      ? "WHERE todo_statuses.counts_as_complete = 0"
      : completion === "done"
        ? "WHERE todo_statuses.counts_as_complete != 0"
        : "";

  const rows = await db.select<TodoListRow>(
    `SELECT todos.id, todos.title, todos.note_id, todos.status_id,
            todos.created_at, todos.updated_at, todos.completed_at,
            todo_statuses.name AS status_name,
            todo_statuses.color AS status_color,
            todo_statuses.counts_as_complete AS counts_as_complete,
            notes.deleted_at AS note_deleted_at
     FROM todos
     JOIN todo_statuses ON todo_statuses.id = todos.status_id
     JOIN notes ON notes.id = todos.note_id
     ${where}
     ORDER BY todos.updated_at DESC, todos.id DESC`,
  );

  const noteIds = rows.map((row) => row.note_id);
  const [initiatives, people] = await Promise.all([
    linkedIdsByNote(db, "note_initiatives", "initiative_id", noteIds),
    linkedIdsByNote(db, "note_people", "person_id", noteIds),
  ]);

  return rows.map((row) => ({
    ...mapTodo(row),
    statusName: row.status_name,
    statusColor: row.status_color,
    countsAsComplete: row.counts_as_complete !== 0,
    noteDeletedAt: row.note_deleted_at,
    initiativeIds: initiatives.get(row.note_id) ?? [],
    personIds: people.get(row.note_id) ?? [],
  }));
}

export async function updateTodoStatus(
  db: AsyncDb,
  todoId: number,
  statusId: number,
  options: { initiativeId?: number; nowIso?: string } = {},
): Promise<Todo> {
  const nowIso = options.nowIso ?? new Date().toISOString();
  const todo = await getTodoRow(db, todoId);
  const oldStatus = await getTodoStatus(db, todo.status_id);
  const newStatus = await getTodoStatus(db, statusId);
  const wasComplete = oldStatus.countsAsComplete;
  const willComplete = newStatus.countsAsComplete;

  if (willComplete && !wasComplete) {
    // Resolve target initiative before mutating anything.
    const note = await getNote(db, todo.note_id);
    const initiativeIds = note?.initiativeIds ?? [];
    let targetInitiativeId: number | null = null;
    if (initiativeIds.length === 1) {
      targetInitiativeId = initiativeIds[0];
    } else if (initiativeIds.length >= 2) {
      if (
        options.initiativeId === undefined ||
        !initiativeIds.includes(options.initiativeId)
      ) {
        throw new Error("İş seçimi gerekli");
      }
      targetInitiativeId = options.initiativeId;
    }

    if (targetInitiativeId !== null) {
      // NOTE: Not atomic. The completion note is written *before* the todo
      // UPDATE on purpose: if the UPDATE fails we may end up with an extra
      // note (retry-able, harmless), instead of a completed todo with no
      // note. `withTransaction` here is only a serialization queue (no real
      // BEGIN/COMMIT), so true atomicity is not available.
      await createNote(db, {
        body: `To-do tamamlandı: “${truncateTitle(todo.title)}”`,
        initiativeIds: [targetInitiativeId],
        personIds: [],
        nowIso,
      });
    }
    await db.execute(
      `UPDATE todos
       SET status_id = ?, updated_at = ?, completed_at = COALESCE(completed_at, ?)
       WHERE id = ?`,
      [statusId, nowIso, nowIso, todoId],
    );
  } else if (!willComplete && wasComplete) {
    await db.execute(
      `UPDATE todos SET status_id = ?, updated_at = ?, completed_at = NULL WHERE id = ?`,
      [statusId, nowIso, todoId],
    );
  } else {
    await db.execute(
      `UPDATE todos SET status_id = ?, updated_at = ? WHERE id = ?`,
      [statusId, nowIso, todoId],
    );
  }

  return mapTodo(await getTodoRow(db, todoId));
}
