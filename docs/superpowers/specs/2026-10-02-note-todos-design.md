# Note-linked todos (Yapılacaklar)

## Goal

Turn any note into a separate **to-do** item, manage all to-dos on a dedicated **Yapılacaklar** page with configurable statuses, navigate back to the source note, and when a to-do reaches a “counts as complete” status, append a completion note on the related initiative (iş).

## Decisions

- Separate `todos` row linked to a note (not a flag on `notes`)
- Built-in statuses plus user-defined statuses; each status has optional `counts_as_complete`
- Completion note targets the source note’s linked initiative: one → auto; many → picker; none → warn, still save status
- UI: **To-do yap** on note cards + sidebar **Yapılacaklar**
- App version for this release: **v0.3.0**

## Data model

### `todo_statuses`

| Column | Notes |
| --- | --- |
| `id` | PK |
| `name` | NOT NULL, unique NOCASE |
| `color` | label color token (reuse person/topic tag color vocabulary) |
| `counts_as_complete` | INTEGER 0/1 |
| `sort_order` | INTEGER |
| `is_builtin` | INTEGER 0/1; builtin rows cannot be deleted |
| `created_at` | TEXT ISO |

**Seed (builtin):**

| name | counts_as_complete |
| --- | --- |
| açık | 0 |
| devam | 0 |
| tamamlandı | 1 |
| tamamlanamadı | 0 |

Users may add custom statuses (name + color + counts_as_complete). Custom statuses may be deleted only when no todo uses them (otherwise reject with a clear error). Builtin statuses cannot be deleted; renaming builtin is out of scope (keep names stable).

### `todos`

| Column | Notes |
| --- | --- |
| `id` | PK |
| `title` | Copy of note body at create time (trimmed); not kept in sync with later note edits |
| `note_id` | NOT NULL FK → `notes(id)` ON DELETE CASCADE |
| `status_id` | NOT NULL FK → `todo_statuses(id)` |
| `created_at` | TEXT ISO |
| `updated_at` | TEXT ISO |
| `completed_at` | TEXT NULL; set the first time status becomes `counts_as_complete`; cleared if moved back to a non-complete status |

Unique active-todo constraint: at most one todo per `note_id` (enforce in app; optional unique index on `note_id`).

Migration via `ensureTodosSchema` (create tables + seed builtins if missing), wired from `connection.ts` like other ensures.

## Behavior

### Create from note (“To-do yap”)

Available on note actions in:

- Initiative detail / person detail (`LinkedNotes`)
- Notes list (`NoteList` / note actions)
- Inbox note actions

Flow:

1. If a todo already exists for `note_id` → toast **Bu not zaten bir to-do** (do not create another).
2. Else create todo with `title = note.body.trim()`, status = builtin **açık**, toast **Yapılacaklara eklendi**.

### Yapılacaklar page

- Sidebar item **Yapılacaklar** (and command palette entry).
- List all todos (newest first or by `updated_at` desc).
- Simple filter chips: **Tümü** / **Açık** (not counts_as_complete) / **Tamamlananlar** (counts_as_complete).
- Each row: title, status control (change status), **Nota git**, timestamps.
- Status management section (on the same page or a lightweight sub-panel): list statuses, add custom, delete unused custom.

### Status change → completion note

When `updateTodoStatus` moves a todo from a non-complete status to a `counts_as_complete` status:

1. Set `completed_at` if it was null.
2. Resolve target initiative(s) from the source note’s `note_initiatives`:
   - **1 initiative:** `createNote` on that initiative (no topic unless we later choose otherwise): body like `To-do tamamlandı: “{todo.title}”` (truncate title if very long).
   - **0 initiatives:** keep status change; toast **Bağlı iş yok; durum kaydedildi, işe not yazılmadı**.
   - **2+ initiatives:** show picker dialog; on confirm write the note to the chosen initiative. Cancel picker → revert status change or leave pending (prefer: do not apply status until initiative chosen).
3. Moving again between two complete statuses must **not** write a second completion note.
4. Moving from complete → non-complete clears `completed_at`; no automatic “reopened” note (YAGNI).
5. Moving non-complete → non-complete: status only.

### Nota git

Navigate to the source note’s context:

- Prefer initiative detail if the note has initiative links (if multiple, use first or the same picker pattern — prefer first linked initiative for navigation simplicity).
- Else person detail if person-linked.
- Else Notes view / Inbox if unlinked.
- If note is soft-deleted/archived: toast **Kaynak not arşivde**; do not crash.

Expand topic / scroll-to-note is best-effort (reuse Bugün reminder navigation patterns where practical).

## API (AppDb)

- `listTodoStatuses(): Promise<TodoStatus[]>`
- `createTodoStatus(input): Promise<TodoStatus>`
- `deleteTodoStatus(id): Promise<void>` — reject builtin or in-use
- `createTodoFromNote(noteId, nowIso?): Promise<Todo>`
- `listTodos(filter?: { completion?: "all" | "open" | "done" }): Promise<TodoListItem[]>`  
  (`TodoListItem` includes status fields + note deleted flag as needed for UI)
- `updateTodoStatus(todoId, statusId, options?: { initiativeId?: number }): Promise<Todo>`  
  — performs completion-note side effect when applicable

## Out of scope

- Standalone todos with no source note
- Syncing todo title when the note body changes
- Due dates / reminders on todos (use existing note reminders)
- Drag-reorder of todos
- Renaming or recoloring builtin statuses
- Writing completion notes onto person-only notes’ “person feed” (only initiatives)

## Version

Bump app to **0.3.0** (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` / lock) and ship GitHub release **v0.3.0** with this feature.

## Tests

- Repo: schema/seed; create from note; reject duplicate; status → completion note for single initiative; no note when zero initiatives; no duplicate completion note on re-set; custom status with counts_as_complete; cannot delete builtin / in-use custom
- UI: To-do yap on a note; Yapılacaklar list + status change; multi-initiative picker; Nota git; status admin add/delete
