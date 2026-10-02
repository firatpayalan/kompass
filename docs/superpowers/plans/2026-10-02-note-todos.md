# Note-linked Todos (Yapılacaklar) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users turn any note into a separate to-do, manage todos on a **Yapılacaklar** page with configurable statuses, navigate back to the source note, and write a completion note on the related initiative when a todo reaches a `counts_as_complete` status; ship as **v0.3.0**.

**Architecture:** New SQLite tables `todo_statuses` + `todos` with `ensureTodosSchema` seeding four builtins. Repo layer owns create-from-note, list/filter, status CRUD, and completion-note side effects. UI adds sidebar **Yapılacaklar**, a `TodosView`, and a **To-do yap** action on note surfaces. Multi-initiative completion uses a picker before calling `updateTodoStatus`.

**Tech Stack:** React 19 + TypeScript, Vitest + Testing Library, SQLite via existing `AsyncDb` / `AppDb` patterns (no new dependencies).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-02-note-todos-design.md`
- Turkish copy exactly as in the spec (toasts, buttons, completion note body prefix `To-do tamamlandı:`)
- One todo per `note_id`; duplicate create → toast **Bu not zaten bir to-do**
- Builtin statuses not deletable; custom delete only when unused
- Completion note only on **initiative** links (not person-only)
- No new npm/Cargo dependencies without asking the user
- Commit only when the user explicitly asks (skip commit steps unless requested)
- Version bump to **0.3.0** is the final task of this plan (do not bump earlier)

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/types.ts` | `TodoStatus`, `Todo`, `TodoListItem` types |
| `src/lib/todoStatuses.ts` | Builtin status seed constants + color reuse |
| `src/db/schema.sql` | `todo_statuses` + `todos` DDL |
| `src/db/todosRepo.ts` | Schema ensure, status CRUD, todo CRUD, completion side effects |
| `src/db/connection.ts` | Call `ensureTodosSchema` |
| `src/db/appDb.ts` | Expose todo APIs on `AppDb` |
| `src/views/TodosView.tsx` | Yapılacaklar list, filters, status change, status admin, Nota git |
| `src/components/TodoInitiativePicker.tsx` | Dialog to pick initiative when completing with 2+ links |
| `src/components/LinkedNotes.tsx` | **To-do yap** button |
| `src/components/NoteList.tsx` | **To-do yap** button |
| `src/views/InboxView.tsx` | **To-do yap** button |
| `src/components/Sidebar.tsx` | `yapilacaklar` nav item |
| `src/components/CommandPalette.tsx` | Command entry |
| `src/App.tsx` | Route `yapilacaklar`, pass navigation helpers |
| `tests/todosRepo.test.ts` | Repo behavior |
| `tests/todos-ui.test.tsx` | Yapılacaklar + create-from-note UI |
| `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock` | Version **0.3.0** |

---

### Task 1: Types, schema, status seed + CRUD

**Files:**
- Create: `src/lib/todoStatuses.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/db/schema.sql`
- Create: `src/db/todosRepo.ts` (status portion first)
- Modify: `src/db/connection.ts`
- Create: `tests/todosRepo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // src/lib/types.ts
  export interface TodoStatus {
    id: number;
    name: string;
    color: string;
    countsAsComplete: boolean;
    sortOrder: number;
    isBuiltin: boolean;
    createdAt: string;
  }

  export interface Todo {
    id: number;
    title: string;
    noteId: number;
    statusId: number;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
  }

  export type TodoListItem = Todo & {
    statusName: string;
    statusColor: string;
    countsAsComplete: boolean;
    noteDeletedAt: string | null;
    initiativeIds: number[];
    personIds: number[];
  };

  // src/lib/todoStatuses.ts
  export const BUILTIN_TODO_STATUSES: ReadonlyArray<{
    name: string;
    color: PersonLabelColor;
    countsAsComplete: boolean;
    sortOrder: number;
  }>;

  // src/db/todosRepo.ts
  export async function ensureTodosSchema(db: AsyncDb): Promise<void>;
  export async function listTodoStatuses(db: AsyncDb): Promise<TodoStatus[]>;
  export async function createTodoStatus(
    db: AsyncDb,
    input: { name: string; color: string; countsAsComplete: boolean; nowIso?: string },
  ): Promise<TodoStatus>;
  export async function deleteTodoStatus(db: AsyncDb, id: number): Promise<void>;
  ```

- [ ] **Step 1: Write failing status tests**

```ts
// tests/todosRepo.test.ts
import { describe, expect, it } from "vitest";
import {
  createTodoStatus,
  deleteTodoStatus,
  ensureTodosSchema,
  listTodoStatuses,
} from "../src/db/todosRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("todosRepo statuses", () => {
  it("seeds four builtin statuses", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const statuses = await listTodoStatuses(db);
    expect(statuses.map((s) => s.name)).toEqual([
      "açık",
      "devam",
      "tamamlandı",
      "tamamlanamadı",
    ]);
    expect(statuses.find((s) => s.name === "tamamlandı")?.countsAsComplete).toBe(true);
    expect(statuses.every((s) => s.isBuiltin)).toBe(true);
    db.close();
  });

  it("creates a custom status and rejects deleting builtins or in-use customs later", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const custom = await createTodoStatus(db, {
      name: "Beklemede",
      color: "amber",
      countsAsComplete: false,
    });
    expect(custom.isBuiltin).toBe(false);
    const builtin = (await listTodoStatuses(db)).find((s) => s.name === "açık")!;
    await expect(deleteTodoStatus(db, builtin.id)).rejects.toThrow(
      "Hazır durum silinemez",
    );
    db.close();
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module/functions missing)**

Run: `npm test -- tests/todosRepo.test.ts`
Expected: FAIL importing `../src/db/todosRepo` or missing exports

- [ ] **Step 3: Implement types, seed const, schema DDL, ensure + status CRUD**

Add to `schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS todo_statuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  color TEXT NOT NULL,
  counts_as_complete INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS todos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  note_id INTEGER NOT NULL UNIQUE REFERENCES notes(id) ON DELETE CASCADE,
  status_id INTEGER NOT NULL REFERENCES todo_statuses(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);
```

Implement `ensureTodosSchema` to `CREATE TABLE IF NOT EXISTS` both tables and `INSERT OR IGNORE` builtins by name. Map rows with `counts_as_complete`/`is_builtin` as booleans. `createTodoStatus` trims name, rejects empty / duplicate; assigns `sort_order = max+1`. `deleteTodoStatus` rejects `is_builtin` or if any `todos.status_id` references it (`"Durum kullanımda"`).

Wire `await ensureTodosSchema(db)` in `connection.ts` after other ensures.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/todosRepo.test.ts`
Expected: PASS

---

### Task 2: Todo create / list / updateTodoStatus + completion note

**Files:**
- Modify: `src/db/todosRepo.ts`
- Modify: `tests/todosRepo.test.ts`
- Modify: `src/db/appDb.ts`

**Interfaces:**
- Produces:
  ```ts
  export async function createTodoFromNote(
    db: AsyncDb,
    noteId: number,
    nowIso?: string,
  ): Promise<Todo>;
  // throws "Bu not zaten bir to-do" | "Not bulunamadı" | "Not boş olamaz"

  export async function listTodos(
    db: AsyncDb,
    filter?: { completion?: "all" | "open" | "done" },
  ): Promise<TodoListItem[]>;

  export async function updateTodoStatus(
    db: AsyncDb,
    todoId: number,
    statusId: number,
    options?: { initiativeId?: number; nowIso?: string },
  ): Promise<Todo>;
  // throws "İş seçimi gerekli" when completing + 2+ initiatives + no initiativeId
  ```

- [ ] **Step 1: Write failing todo behavior tests**

```ts
import { createInitiative } from "../src/db/initiativesRepo";
import { createNote, listNotesForInitiative } from "../src/db/notesRepo";
import {
  createTodoFromNote,
  ensureTodosSchema,
  listTodoStatuses,
  listTodos,
  updateTodoStatus,
} from "../src/db/todosRepo";

it("creates a todo from a note and rejects duplicates", async () => {
  const db = openTestAsyncDb();
  await ensureTodosSchema(db);
  const note = await createNote(db, {
    body: "RFC yaz",
    nowIso: "2026-10-02T10:00:00.000Z",
  });
  const todo = await createTodoFromNote(db, note.id, "2026-10-02T10:01:00.000Z");
  expect(todo.title).toBe("RFC yaz");
  expect(todo.completedAt).toBeNull();
  await expect(createTodoFromNote(db, note.id)).rejects.toThrow(
    "Bu not zaten bir to-do",
  );
  db.close();
});

it("writes a completion note to the single linked initiative", async () => {
  const db = openTestAsyncDb();
  await ensureTodosSchema(db);
  const initiative = await createInitiative(db, {
    name: "Lansman",
    status: "aktif",
    nowIso: "2026-10-02T09:00:00.000Z",
  });
  const note = await createNote(db, {
    body: "Checklist bitir",
    initiativeIds: [initiative.id],
    nowIso: "2026-10-02T10:00:00.000Z",
  });
  const todo = await createTodoFromNote(db, note.id, "2026-10-02T10:01:00.000Z");
  const done = (await listTodoStatuses(db)).find((s) => s.name === "tamamlandı")!;
  const updated = await updateTodoStatus(db, todo.id, done.id, {
    nowIso: "2026-10-02T11:00:00.000Z",
  });
  expect(updated.completedAt).toBe("2026-10-02T11:00:00.000Z");
  const notes = await listNotesForInitiative(db, initiative.id);
  expect(notes.some((n) => n.body.startsWith("To-do tamamlandı:"))).toBe(true);
  // second transition complete→complete must not add another note
  await updateTodoStatus(db, todo.id, done.id, {
    nowIso: "2026-10-02T12:00:00.000Z",
  });
  const notesAfter = await listNotesForInitiative(db, initiative.id);
  expect(notesAfter.filter((n) => n.body.startsWith("To-do tamamlandı:")).length).toBe(1);
  db.close();
});

it("requires initiativeId when completing with multiple linked initiatives", async () => {
  const db = openTestAsyncDb();
  await ensureTodosSchema(db);
  const a = await createInitiative(db, { name: "A", status: "aktif", nowIso: "2026-10-02T09:00:00.000Z" });
  const b = await createInitiative(db, { name: "B", status: "aktif", nowIso: "2026-10-02T09:01:00.000Z" });
  const note = await createNote(db, {
    body: "Çoklu iş",
    initiativeIds: [a.id, b.id],
    nowIso: "2026-10-02T10:00:00.000Z",
  });
  const todo = await createTodoFromNote(db, note.id, "2026-10-02T10:01:00.000Z");
  const done = (await listTodoStatuses(db)).find((s) => s.name === "tamamlandı")!;
  await expect(updateTodoStatus(db, todo.id, done.id)).rejects.toThrow(
    "İş seçimi gerekli",
  );
  const updated = await updateTodoStatus(db, todo.id, done.id, {
    initiativeId: b.id,
    nowIso: "2026-10-02T11:00:00.000Z",
  });
  expect(updated.completedAt).toBeTruthy();
  const notesB = await listNotesForInitiative(db, b.id);
  expect(notesB.some((n) => n.body.includes("Çoklu iş"))).toBe(true);
  db.close();
});

it("completes with zero initiatives without writing a note", async () => {
  const db = openTestAsyncDb();
  await ensureTodosSchema(db);
  const note = await createNote(db, {
    body: "Inbox işi",
    nowIso: "2026-10-02T10:00:00.000Z",
  });
  const todo = await createTodoFromNote(db, note.id);
  const done = (await listTodoStatuses(db)).find((s) => s.name === "tamamlandı")!;
  const updated = await updateTodoStatus(db, todo.id, done.id);
  expect(updated.completedAt).toBeTruthy();
  expect(await listTodos(db, { completion: "done" })).toHaveLength(1);
  db.close();
});
```

Also add test: delete custom status in use → `"Durum kullanımda"`.

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- tests/todosRepo.test.ts`
Expected: FAIL on missing `createTodoFromNote` / `updateTodoStatus`

- [ ] **Step 3: Implement todo functions**

`createTodoFromNote`: load note via `getNote`; reject missing/empty body; if row exists for `note_id` throw duplicate; status = builtin **açık**; `title = note.body.trim()`; insert.

`listTodos`: join statuses + note `deleted_at`; attach `initiativeIds`/`personIds` via existing link helpers or small selects; filter by `counts_as_complete` for open/done; order `updated_at DESC, id DESC`.

`updateTodoStatus`:
1. Load todo + old status + new status
2. `wasComplete = old.countsAsComplete`; `willComplete = new.countsAsComplete`
3. Update `status_id`, `updated_at`
4. If `willComplete && !wasComplete`: set `completed_at` if null; load note initiative ids:
   - length 0 → done (no createNote)
   - length 1 → `createNote({ body: \`To-do tamamlandı: “${truncate(title)}”\`, initiativeIds: [id], personIds: [] })`
   - length ≥ 2 → if `!options?.initiativeId` throw `"İş seçimi gerekli"`; else createNote on chosen id (validate id ∈ list)
5. If `!willComplete && wasComplete`: set `completed_at = NULL`
6. Return updated todo

Truncate helper: first ~120 chars of title for the completion body.

Wire all methods on `AppDb` in `appDb.ts`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/todosRepo.test.ts`
Expected: PASS

---

### Task 3: Yapılacaklar page + sidebar routing

**Files:**
- Create: `src/views/TodosView.tsx`
- Create: `src/components/TodoInitiativePicker.tsx`
- Modify: `src/components/Sidebar.tsx` — add `"yapilacaklar"` to `View` + nav item (after **Notlar**)
- Modify: `src/components/CommandPalette.tsx` — add command
- Modify: `src/App.tsx` — render `TodosView`
- Create: `tests/todos-ui.test.tsx`

**Interfaces:**
- Consumes: `listTodos`, `listTodoStatuses`, `updateTodoStatus`, `createTodoStatus`, `deleteTodoStatus`, `getNote`, `listInitiatives` (for picker labels)
- Produces: `TodosView` with props `{ db?, onToast?, onOpenNote: (noteId: number) => void }`

- [ ] **Step 1: Write failing UI test for list + status change**

```tsx
// tests/todos-ui.test.tsx
it("lists todos and updates status for a single-initiative note", async () => {
  const listTodos = vi.fn().mockResolvedValue([
    {
      id: 1,
      title: "RFC yaz",
      noteId: 9,
      statusId: 1,
      statusName: "açık",
      statusColor: "sky",
      countsAsComplete: false,
      createdAt: "2026-10-02T10:00:00.000Z",
      updatedAt: "2026-10-02T10:00:00.000Z",
      completedAt: null,
      noteDeletedAt: null,
      initiativeIds: [2],
      personIds: [],
    },
  ]);
  const listTodoStatuses = vi.fn().mockResolvedValue([
    { id: 1, name: "açık", color: "sky", countsAsComplete: false, sortOrder: 0, isBuiltin: true, createdAt: "…" },
    { id: 3, name: "tamamlandı", color: "lime", countsAsComplete: true, sortOrder: 2, isBuiltin: true, createdAt: "…" },
  ]);
  const updateTodoStatus = vi.fn().mockResolvedValue({});
  // render TodosView with mocks; change status select to tamamlandı
  // expect updateTodoStatus called with (1, 3, undefined or {})
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/todos-ui.test.tsx`
Expected: FAIL (missing view / route)

- [ ] **Step 3: Implement TodosView + picker + navigation wiring**

`TodosView`:
- Load todos + statuses on mount
- Filter chips: Tümü / Açık / Tamamlananlar → remaps to `listTodos` filter
- Row: title, `<select>` of statuses (or button menu), **Nota git**, time
- On status change: call `updateTodoStatus`; if error message is **İş seçimi gerekli**, open `TodoInitiativePicker` with initiative ids/names, then retry with `initiativeId`
- On zero-initiative complete: repo succeeds; show toast **Bağlı iş yok; durum kaydedildi, işe not yazılmadı** when `initiativeIds.length === 0` and new status counts as complete (UI can check before/after)
- Status admin: form name + color swatches + checkbox **Tamamlandı say** + add; list customs with Sil

`TodoInitiativePicker`: ConfirmDialog-like modal listing initiatives as radio/buttons; confirm/cancel.

`App.tsx` `onOpenNote`:
```ts
async function openNoteFromTodo(noteId: number) {
  const note = await appDb.getNote(noteId);
  if (!note || note.deletedAt) {
    showToast("Kaynak not arşivde");
    return;
  }
  if (note.initiativeIds[0]) {
    const initiative = (await appDb.listInitiatives()).find((i) => i.id === note.initiativeIds[0]);
    if (initiative) openInitiative(initiative);
    else showToast("İş bulunamadı");
    return;
  }
  if (note.personIds[0]) {
    const person = (await appDb.listPeople()).find((p) => p.id === note.personIds[0]);
    if (person) openPerson(person);
    else showToast("Kişi bulunamadı");
    return;
  }
  setActiveView("notlar");
}
```

Update any tests that mock full `App` / sidebar view unions if TypeScript breaks (`task15-ui`, etc.) by adding `yapilacaklar` where needed.

- [ ] **Step 4: Run UI + full related tests — expect PASS**

Run: `npm test -- tests/todos-ui.test.tsx tests/task15-ui.test.tsx`
Expected: PASS

---

### Task 4: “To-do yap” on note surfaces

**Files:**
- Modify: `src/components/LinkedNotes.tsx` — optional `onCreateTodo?: (noteId: number) => Promise<void>`
- Modify: `src/components/NoteList.tsx` — same
- Modify: `src/views/InboxView.tsx`
- Modify: `src/views/PersonDetailView.tsx`, `src/views/InitiativeDetailView.tsx`, `src/views/NotesView.tsx` — wire `createTodoFromNote` + toast
- Modify: `tests/todos-ui.test.tsx` — add create-from-note case (PersonDetail or NotesView)
- Modify: existing LinkedNotes/NoteList tests only if props required (keep optional)

**Interfaces:**
- Consumes: `db.createTodoFromNote(noteId)`
- Button label: **To-do yap**
- Toasts: **Yapılacaklara eklendi** / **Bu not zaten bir to-do** (surface `formatError` / `error.message`)

- [ ] **Step 1: Write failing UI test**

```tsx
it("creates a todo from a linked note", async () => {
  const createTodoFromNote = vi.fn().mockResolvedValue({ id: 1 });
  // render PersonDetailView with untopic note + createTodoFromNote
  // click To-do yap
  // expect createTodoFromNote(note.id) and toast Yapılacaklara eklendi
});
```

- [ ] **Step 2: Run — expect FAIL (no button)**

Run: `npm test -- tests/todos-ui.test.tsx`
Expected: FAIL cannot find **To-do yap**

- [ ] **Step 3: Add button + handlers**

In `LinkedNotes` meta actions next to **Düzenle**:
```tsx
{onCreateTodo ? (
  <button type="button" onClick={() => void onCreateTodo(note.id)}>
    To-do yap
  </button>
) : null}
```

Same pattern on `NoteList` and Inbox actions. Handlers:

```ts
const createTodo = async (noteId: number) => {
  try {
    await db.createTodoFromNote(noteId);
    onToast("Yapılacaklara eklendi");
  } catch (error) {
    onToast(error instanceof Error ? error.message : "To-do eklenemedi");
  }
};
```

Extend detail/Notes/Inbox `Pick<>` types with `createTodoFromNote`.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/todos-ui.test.tsx tests/linked-note-reminders-ui.test.tsx tests/initiative-topics-ui.test.tsx tests/inbox-ui.test.tsx`
Expected: PASS

---

### Task 5: Version bump to v0.3.0

**Files:**
- Modify: `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`

- [ ] **Step 1: Set version fields to `0.3.0`**

```bash
# package.json + tauri.conf.json "version": "0.3.0"
# Cargo.toml version = "0.3.0"
# cd src-tauri && cargo update -p daily-leadership-tool --precise 0.3.0
```

- [ ] **Step 2: Run full suite**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 3: Verify version label**

Run: `node -e "console.log(require('./package.json').version)"`
Expected: `0.3.0`

Do **not** `gh release` unless the user asks to push/release.

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Separate todos + status catalog + builtins | Task 1 |
| create from note, no duplicate | Task 2 + 4 |
| Yapılacaklar page + filters + status admin | Task 3 |
| Completion note 0/1/many initiatives | Task 2 + 3 |
| No second completion note | Task 2 |
| Nota git + archived toast | Task 3 |
| To-do yap on LinkedNotes / Notes / Inbox | Task 4 |
| v0.3.0 | Task 5 |

## Placeholder / consistency review

- No TBD steps; error strings fixed to match spec
- `updateTodoStatus` signature consistent across Task 2–3
- Builtin names: `açık`, `devam`, `tamamlandı`, `tamamlanamadı`
