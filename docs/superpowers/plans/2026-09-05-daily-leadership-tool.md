# Daily Leadership Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local-first macOS desktop app (Tauri + React) for an EM to capture tagged notes, link them to people/initiatives, search them, soft-delete to Silinenler, and get in-app + OS reminders.

**Architecture:** React UI talks to a thin TypeScript domain layer (tags, reminder scheduling, drafts). Persistence is SQLite via `@tauri-apps/plugin-sql` with the same schema exercised in Node by `better-sqlite3` in unit tests. Notifications use `@tauri-apps/plugin-notification`. All UI copy is Turkish.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vite, Vitest, `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-notification`, `better-sqlite3` (test-only), CSS modules or plain CSS (no UI kit required).

## Global Constraints

- UI language: Turkish only (MVP)
- Data: local SQLite only; no cloud/sync
- Soft-delete notes → Silinenler; permanent delete requires confirm
- Soft-deleted notes’ reminders hidden from Bugün and do not fire notifications
- In-app shortcuts only (MVP); no global hotkeys
- Reminder scheduler runs while the app is open
- Ask the user before adding any dependency not listed in this plan
- Target platform: macOS first
- Prerequisite: install Rust stable + Xcode CLT before Task 1 if missing (`rustc` / `cargo` must work)

---

## File structure

```
package.json
vite.config.ts
vitest.config.ts
tsconfig.json
index.html
src/
  main.tsx
  App.tsx
  styles.css
  lib/
    types.ts                 # shared domain types
    tags.ts                  # parseHashtags
    reminders.ts             # nextDueAt, isDue
    drafts.ts                # in-memory draft buffer on save failure
  db/
    schema.sql               # canonical schema + FTS
    connection.ts            # open DB (Tauri plugin vs better-sqlite3 test shim)
    notesRepo.ts
    peopleRepo.ts
    initiativesRepo.ts
    remindersRepo.ts
    searchRepo.ts
  components/
    Sidebar.tsx
    Toast.tsx
    QuickNoteModal.tsx
    CommandPalette.tsx
    ConfirmDialog.tsx
    NoteList.tsx
    NoteEditor.tsx
    PersonForm.tsx
    InitiativeForm.tsx
    ReminderForm.tsx
  views/
    BugunView.tsx
    NotesView.tsx
    PeopleView.tsx
    PersonDetailView.tsx
    InitiativesView.tsx
    InitiativeDetailView.tsx
    SearchView.tsx
    TrashView.tsx
  hooks/
    useAppShortcuts.ts
    useReminderTicker.ts
  notifications/
    notify.ts
src-tauri/
  Cargo.toml
  tauri.conf.json
  capabilities/default.json
  src/lib.rs
  src/main.rs
src/db/schema.sql            # (same file; copied or read for migrations)
tests/
  tags.test.ts
  reminders.test.ts
  drafts.test.ts
  notesRepo.test.ts
  peopleRepo.test.ts
  initiativesRepo.test.ts
  remindersRepo.test.ts
  searchRepo.test.ts
  softDelete.test.ts
```

---

### Task 1: Scaffold Tauri + React + Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src-tauri/**` (via `npm create tauri-app` or manual equivalent)
- Create: `README.md` with run instructions in Turkish/English short form

**Interfaces:**
- Consumes: none
- Produces: runnable `npm run dev` / `npm run tauri dev` skeleton; `npm test` runs Vitest

- [ ] **Step 1: Verify Rust toolchain**

Run: `rustc --version && cargo --version`

Expected: version lines. If missing, install via https://rustup.rs then re-run.

- [ ] **Step 2: Ask user before installing npm packages**

List intended packages to the user and wait for approval:

- Runtime: `@tauri-apps/api`, `@tauri-apps/plugin-sql`, `@tauri-apps/plugin-notification`, `react`, `react-dom`
- Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@testing-library/react`, `jsdom`, `better-sqlite3`, `@types/better-sqlite3`, `@types/react`, `@types/react-dom`

Only proceed after approval.

- [ ] **Step 3: Scaffold the app**

Prefer:

```bash
npm create tauri-app@latest . -- --template react-ts --manager npm --yes
```

If the directory is non-empty, scaffold into a temp folder and move files, or create files manually matching Tauri 2 + React + TS + Vite. Ensure `src-tauri/tauri.conf.json` product name is `Daily Leadership Tool` / identifier `com.dailyleadership.tool`.

- [ ] **Step 4: Add Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
```

Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 5: Smoke UI**

Replace `src/App.tsx` with a Turkish placeholder:

```tsx
export default function App() {
  return <main><h1>Daily Leadership Tool</h1><p>Hazırlanıyor…</p></main>;
}
```

- [ ] **Step 6: Verify**

Run: `npm test` — Expected: 0 tests or pass  
Run: `npm run build` — Expected: success  
(Optional if Rust ready): `npm run tauri build` may be slow; `npm run tauri dev` smoke is enough.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Tauri React app with Vitest"
```

---

### Task 2: Domain types + tag parsing (TDD)

**Files:**
- Create: `src/lib/types.ts`, `src/lib/tags.ts`
- Test: `tests/tags.test.ts`

**Interfaces:**
- Consumes: none
- Produces:
  - `parseHashtags(body: string): string[]` — unique, lowercased, without `#`, keeps letters/digits/`-`/`_`/`:` (so `1:1` works)
  - Types: `Note`, `Person`, `Initiative`, `Reminder`, `InitiativeStatus`, `ReminderPeriod`

- [ ] **Step 1: Write failing tests**

```ts
// tests/tags.test.ts
import { describe, it, expect } from "vitest";
import { parseHashtags } from "../src/lib/tags";

describe("parseHashtags", () => {
  it("extracts unique lowercased tags", () => {
    expect(parseHashtags("Ali ile #1:1 ve #Geri-Bildirim #1:1")).toEqual([
      "1:1",
      "geri-bildirim",
    ]);
  });

  it("returns empty for no tags", () => {
    expect(parseHashtags("sadece metin")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/tags.test.ts`  
Expected: FAIL (module not found or function missing)

- [ ] **Step 3: Implement**

```ts
// src/lib/tags.ts
export function parseHashtags(body: string): string[] {
  const matches = body.match(/#[\p{L}\p{N}_:-]+/gu) ?? [];
  const normalized = matches.map((m) => m.slice(1).toLocaleLowerCase("tr-TR"));
  return [...new Set(normalized)];
}
```

```ts
// src/lib/types.ts
export type InitiativeStatus = "aktif" | "beklemede" | "bitti";
export type ReminderPeriod = "once" | "daily" | "weekly" | "monthly";
export type ReminderTargetType = "note" | "initiative";

export interface Person {
  id: number;
  name: string;
  roleOrNotes: string | null;
  createdAt: string;
}

export interface Initiative {
  id: number;
  name: string;
  status: InitiativeStatus;
  blockerSummary: string | null;
  createdAt: string;
}

export interface Note {
  id: number;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  tags: string[];
  personIds: number[];
  initiativeIds: number[];
}

export interface Reminder {
  id: number;
  targetType: ReminderTargetType;
  targetId: number;
  dueAt: string;
  period: ReminderPeriod;
  done: boolean;
  createdAt: string;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- tests/tags.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts src/lib/tags.ts tests/tags.test.ts
git commit -m "feat: add domain types and hashtag parsing"
```

---

### Task 3: Reminder scheduling helpers (TDD)

**Files:**
- Create: `src/lib/reminders.ts`
- Test: `tests/reminders.test.ts`

**Interfaces:**
- Consumes: `ReminderPeriod` from `src/lib/types.ts`
- Produces:
  - `isDue(dueAtIso: string, now: Date): boolean`
  - `nextDueAt(dueAtIso: string, period: ReminderPeriod, now: Date): string | null` — for `once` returns `null` after due; for recurring advances until `> now`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, it, expect } from "vitest";
import { isDue, nextDueAt } from "../src/lib/reminders";

describe("isDue", () => {
  it("is true when dueAt <= now", () => {
    expect(isDue("2026-09-05T10:00:00.000Z", new Date("2026-09-05T11:00:00.000Z"))).toBe(true);
  });
  it("is false when dueAt > now", () => {
    expect(isDue("2026-09-05T12:00:00.000Z", new Date("2026-09-05T11:00:00.000Z"))).toBe(false);
  });
});

describe("nextDueAt", () => {
  it("returns null for once after due", () => {
    expect(
      nextDueAt("2026-09-01T10:00:00.000Z", "once", new Date("2026-09-05T10:00:00.000Z")),
    ).toBeNull();
  });
  it("advances daily until after now", () => {
    const next = nextDueAt(
      "2026-09-01T10:00:00.000Z",
      "daily",
      new Date("2026-09-05T09:00:00.000Z"),
    );
    expect(next).toBe("2026-09-05T10:00:00.000Z");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/reminders.test.ts`

- [ ] **Step 3: Implement**

```ts
import type { ReminderPeriod } from "./types";

export function isDue(dueAtIso: string, now: Date): boolean {
  return new Date(dueAtIso).getTime() <= now.getTime();
}

function addPeriod(d: Date, period: ReminderPeriod): Date {
  const n = new Date(d);
  if (period === "daily") n.setUTCDate(n.getUTCDate() + 1);
  else if (period === "weekly") n.setUTCDate(n.getUTCDate() + 7);
  else if (period === "monthly") n.setUTCMonth(n.getUTCMonth() + 1);
  return n;
}

export function nextDueAt(
  dueAtIso: string,
  period: ReminderPeriod,
  now: Date,
): string | null {
  if (period === "once") {
    return isDue(dueAtIso, now) ? null : dueAtIso;
  }
  let cursor = new Date(dueAtIso);
  // If still in the future, keep current due
  if (cursor.getTime() > now.getTime()) return cursor.toISOString();
  while (cursor.getTime() <= now.getTime()) {
    cursor = addPeriod(cursor, period);
  }
  return cursor.toISOString();
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/reminders.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/reminders.ts tests/reminders.test.ts
git commit -m "feat: add reminder due and next-due helpers"
```

---

### Task 4: Draft buffer on save failure (TDD)

**Files:**
- Create: `src/lib/drafts.ts`
- Test: `tests/drafts.test.ts`

**Interfaces:**
- Produces: `DraftStore` with `saveDraft(body: string): void`, `getDraft(): string | null`, `clearDraft(): void`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from "vitest";
import { createDraftStore } from "../src/lib/drafts";

describe("createDraftStore", () => {
  it("stores and clears a draft", () => {
    const d = createDraftStore();
    expect(d.getDraft()).toBeNull();
    d.saveDraft("yarım not");
    expect(d.getDraft()).toBe("yarım not");
    d.clearDraft();
    expect(d.getDraft()).toBeNull();
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

```ts
export function createDraftStore() {
  let draft: string | null = null;
  return {
    saveDraft(body: string) {
      draft = body;
    },
    getDraft() {
      return draft;
    },
    clearDraft() {
      draft = null;
    },
  };
}

export type DraftStore = ReturnType<typeof createDraftStore>;
```

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/lib/drafts.ts tests/drafts.test.ts
git commit -m "feat: add in-memory note draft store"
```

---

### Task 5: SQLite schema + test DB helper

**Files:**
- Create: `src/db/schema.sql`, `src/db/testDb.ts`
- Modify: enable SQL plugin in `src-tauri` (`Cargo.toml`, `lib.rs`, `capabilities/default.json`)

**Interfaces:**
- Produces: `openTestDb(): Database` using `better-sqlite3` with schema applied; schema file is source of truth for Tauri migrations

- [ ] **Step 1: Write schema**

```sql
-- src/db/schema.sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS people (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  role_or_notes TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS initiatives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  status TEXT NOT NULL CHECK (status IN ('aktif', 'beklemede', 'bitti')),
  blocker_summary TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS note_tags (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE TABLE IF NOT EXISTS note_people (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, person_id)
);

CREATE TABLE IF NOT EXISTS note_initiatives (
  note_id INTEGER NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, initiative_id)
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  target_type TEXT NOT NULL CHECK (target_type IN ('note', 'initiative')),
  target_id INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('once', 'daily', 'weekly', 'monthly')),
  done INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  body,
  content='notes',
  content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, body) VALUES (new.id, new.body);
END;
CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, body) VALUES('delete', old.id, old.body);
END;
CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, body) VALUES('delete', old.id, old.body);
  INSERT INTO notes_fts(rowid, body) VALUES (new.id, new.body);
END;
```

- [ ] **Step 2: Test DB helper**

```ts
// src/db/testDb.ts
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export function openTestDb() {
  const db = new Database(":memory:");
  const schema = fs.readFileSync(
    path.join(__dirname, "schema.sql"),
    "utf8",
  );
  db.exec(schema);
  return db;
}
```

If `__dirname` is awkward under Vitest ESM, use `fileURLToPath` + `import.meta.url`.

- [ ] **Step 3: Wire Tauri SQL plugin**

Follow Tauri 2 docs for `@tauri-apps/plugin-sql`:

- Add `tauri-plugin-sql` to `src-tauri/Cargo.toml` with `sqlite` feature
- Register in `src-tauri/src/lib.rs`
- Allow `sql:default` + sqlite scope in capabilities
- On app start (Task 6+), run `schema.sql` statements if tables missing

- [ ] **Step 4: Tiny smoke test that schema loads**

```ts
// tests/schema.test.ts
import { describe, it, expect } from "vitest";
import { openTestDb } from "../src/db/testDb";

describe("schema", () => {
  it("creates notes table", () => {
    const db = openTestDb();
    const row = db.prepare("SELECT name FROM sqlite_master WHERE name='notes'").get();
    expect(row).toBeTruthy();
  });
});
```

Run: `npm test -- tests/schema.test.ts` — PASS

- [ ] **Step 5: Commit**

```bash
git add src/db src-tauri tests/schema.test.ts
git commit -m "feat: add SQLite schema and test database helper"
```

---

### Task 6: Notes repository — create, list, soft-delete, restore, purge

**Files:**
- Create: `src/db/notesRepo.ts`
- Test: `tests/notesRepo.test.ts`, `tests/softDelete.test.ts`

**Interfaces:**
- Consumes: `openTestDb`, `parseHashtags`, `Note`
- Produces (same signatures for app + tests; tests pass `better-sqlite3` db; app wraps plugin):

```ts
export type SqlDb = {
  prepare(sql: string): { run: (...args: unknown[]) => unknown; all: (...args: unknown[]) => unknown[]; get: (...args: unknown[]) => unknown };
  exec(sql: string): void;
};

createNote(db, input: { body: string; personIds?: number[]; initiativeIds?: number[]; nowIso?: string }): Note
listActiveNotes(db): Note[]
listDeletedNotes(db): Note[]
softDeleteNote(db, id: number, nowIso: string): void
restoreNote(db, id: number): void
permanentlyDeleteNote(db, id: number): void
getNote(db, id: number): Note | null
```

Empty `body.trim()` must throw `Error("Not boş olamaz")`.

- [ ] **Step 1: Failing tests**

```ts
import { describe, it, expect } from "vitest";
import { openTestDb } from "../src/db/testDb";
import {
  createNote,
  listActiveNotes,
  listDeletedNotes,
  softDeleteNote,
  restoreNote,
  permanentlyDeleteNote,
} from "../src/db/notesRepo";

describe("notesRepo", () => {
  it("rejects empty body", () => {
    const db = openTestDb();
    expect(() => createNote(db, { body: "  " })).toThrow("Not boş olamaz");
  });

  it("creates note with tags from body", () => {
    const db = openTestDb();
    const note = createNote(db, {
      body: "Toplantı #aksiyon",
      nowIso: "2026-09-05T10:00:00.000Z",
    });
    expect(note.tags).toContain("aksiyon");
    expect(listActiveNotes(db)).toHaveLength(1);
  });

  it("soft deletes, restores, and purges", () => {
    const db = openTestDb();
    const note = createNote(db, { body: "silinecek", nowIso: "2026-09-05T10:00:00.000Z" });
    softDeleteNote(db, note.id, "2026-09-05T11:00:00.000Z");
    expect(listActiveNotes(db)).toHaveLength(0);
    expect(listDeletedNotes(db)).toHaveLength(1);
    restoreNote(db, note.id);
    expect(listActiveNotes(db)).toHaveLength(1);
    softDeleteNote(db, note.id, "2026-09-05T12:00:00.000Z");
    permanentlyDeleteNote(db, note.id);
    expect(listDeletedNotes(db)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement `notesRepo.ts`**

Implement using prepared statements: insert note, upsert tags via `INSERT OR IGNORE`, link `note_tags`, map rows to `Note` including tags arrays via join queries. Soft delete sets `deleted_at`; restore clears it; permanent delete `DELETE FROM notes WHERE id=?`.

Keep the implementation in one file (~150–200 lines). Do not skip tag linking.

- [ ] **Step 4: Run — PASS**

Run: `npm test -- tests/notesRepo.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/db/notesRepo.ts tests/notesRepo.test.ts
git commit -m "feat: notes repository with soft delete and tags"
```

---

### Task 7: People + initiatives repos and note links

**Files:**
- Create: `src/db/peopleRepo.ts`, `src/db/initiativesRepo.ts`
- Modify: `src/db/notesRepo.ts` (link helpers if not already complete)
- Test: `tests/peopleRepo.test.ts`, `tests/initiativesRepo.test.ts`

**Interfaces:**
- Produces:

```ts
createPerson(db, { name, roleOrNotes?, nowIso }): Person
listPeople(db): Person[]
findPersonByName(db, name: string): Person | null
deletePerson(db, id: number): void // unlinks note_people only; notes remain

createInitiative(db, { name, status, blockerSummary?, nowIso }): Initiative
listInitiatives(db): Initiative[]
updateInitiative(db, id, patch): Initiative
deleteInitiative(db, id: number): void // unlinks only

linkNoteToPeople(db, noteId, personIds: number[]): void
linkNoteToInitiatives(db, noteId, initiativeIds: number[]): void
listNotesForPerson(db, personId: number): Note[] // active only
listNotesForInitiative(db, initiativeId: number): Note[]
```

Duplicate names: `createPerson` / `createInitiative` if `find*ByName` hits, throw `Error("Bu isimde kayıt var")` — UI will offer existing later.

- [ ] **Step 1: Write failing tests** covering create, duplicate throw, delete unlinks but note remains, `listNotesForPerson` returns linked active notes only.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement repos**

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit**

```bash
git add src/db/peopleRepo.ts src/db/initiativesRepo.ts src/db/notesRepo.ts tests/peopleRepo.test.ts tests/initiativesRepo.test.ts
git commit -m "feat: people and initiatives with note linking"
```

---

### Task 8: Reminders repo + hide when note soft-deleted

**Files:**
- Create: `src/db/remindersRepo.ts`
- Test: `tests/remindersRepo.test.ts`

**Interfaces:**
- Produces:

```ts
createReminder(db, input: {
  targetType: ReminderTargetType;
  targetId: number;
  dueAt: string;
  period: ReminderPeriod;
  nowIso: string;
}): Reminder

listDueRemindersForBugun(db, now: Date): Array<Reminder & { title: string }>
// title = note body snippet or initiative name
// Exclude reminders whose target note has deleted_at IS NOT NULL
// Exclude done=1
// Include where due_at <= nowIso OR (for display) due today — MVP: due_at <= end of local day

markReminderDone(db, id: number): void
advanceOrCompleteReminder(db, reminder: Reminder, now: Date): void
// uses nextDueAt; if null -> mark done; else update due_at
```

- [ ] **Step 1: Failing tests** including “soft-deleted note’s reminder excluded from Bugün list”.

- [ ] **Step 2–4: Implement until PASS**

- [ ] **Step 5: Commit**

```bash
git add src/db/remindersRepo.ts tests/remindersRepo.test.ts
git commit -m "feat: reminders repo with soft-delete exclusion"
```

---

### Task 9: FTS search (active notes by default)

**Files:**
- Create: `src/db/searchRepo.ts`
- Test: `tests/searchRepo.test.ts`

**Interfaces:**
- Produces: `searchNotes(db, query: string, opts?: { includeDeleted?: boolean }): Note[]`

Search matches note body via `notes_fts` and also notes that have a tag name `LIKE` query or linked person/initiative name match (simple SQL `OR` is fine).

- [ ] **Step 1: Failing test** — create notes, soft-delete one, search finds only active; with `includeDeleted: true` finds deleted too.

- [ ] **Step 2–4: Implement until PASS**

- [ ] **Step 5: Commit**

```bash
git add src/db/searchRepo.ts tests/searchRepo.test.ts
git commit -m "feat: full-text and related search for notes"
```

---

### Task 10: App DB connection (Tauri) + bootstrap

**Files:**
- Create: `src/db/connection.ts`, `src/db/appDb.ts`
- Modify: `src/main.tsx` to init DB before render

**Interfaces:**
- Produces: `initAppDb(): Promise<void>`, `getDb(): AppDb` where `AppDb` exposes the same repo functions bound to the live connection (adapter mapping plugin-sql async API to the sync better-sqlite3-shaped helpers **or** make repos async).

**Decision locked here:** Make all repo functions `async` and accept an `AsyncDb` interface:

```ts
export interface AsyncDb {
  execute(sql: string, bindValues?: unknown[]): Promise<void>;
  select<T>(sql: string, bindValues?: unknown[]): Promise<T[]>;
}
```

Refactor repos from Tasks 6–9 to async if they were sync — keep tests working via a `better-sqlite3` async wrapper in `src/db/testDb.ts`:

```ts
export function openTestAsyncDb(): AsyncDb {
  const db = openTestDb();
  return {
    async execute(sql, bind = []) {
      db.prepare(sql).run(...bind);
    },
    async select(sql, bind = []) {
      return db.prepare(sql).all(...bind) as never[];
    },
  };
}
```

Prefer doing this refactor inside this task with tests still green (`npm test`).

- [ ] **Step 1: Introduce `AsyncDb` + wrapper; update repos and tests**

- [ ] **Step 2: Implement Tauri `connection.ts` using `Database.load('sqlite:leadership.db')` and run schema**

- [ ] **Step 3: `npm test` PASS; manual `tauri dev` opens without SQL errors**

- [ ] **Step 4: Commit**

```bash
git add src/db src/main.tsx tests
git commit -m "feat: async DB layer and Tauri SQLite bootstrap"
```

---

### Task 11: Shell UI — Sidebar + routing views

**Files:**
- Create: `src/components/Sidebar.tsx`, `src/views/*.tsx` stubs, modify `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Produces: view state union `'bugun' | 'notlar' | 'kisiler' | 'isler' | 'arama' | 'silinenler' | 'kisi:' | 'is:'`

Sidebar labels (exact Turkish):

- Bugün  
- Notlar  
- Kişiler  
- İşler  
- Arama  
- Silinenler  

- [ ] **Step 1: Implement Sidebar + App state switcher rendering stub headings for each view**

- [ ] **Step 2: Manual check in browser/Vite — all nav items switch**

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx src/components/Sidebar.tsx src/views src/styles.css
git commit -m "feat: sidebar shell and view routing"
```

---

### Task 12: Notes UI + QuickNoteModal (`Cmd+N`)

**Files:**
- Create: `src/components/QuickNoteModal.tsx`, `src/components/NoteList.tsx`, `src/components/NoteEditor.tsx`, `src/components/Toast.tsx`, `src/components/ReminderForm.tsx`
- Modify: `src/views/NotesView.tsx`, `src/hooks/useAppShortcuts.ts`, `src/App.tsx`

**Behavior:**
- `Cmd+N` opens modal with textarea (autofocus), optional multi-select people/initiatives, optional reminder fields
- Save calls `createNote` + optional `createReminder`; on throw save draft via `DraftStore` and show toast “Kayıt başarısız; taslak korundu”
- Empty body: toast “Not boş olamaz”
- NotesView lists active notes; click to edit body; soft-delete button “Sil” → soft delete

- [ ] **Step 1: Implement components wired to appDb**

- [ ] **Step 2: Manual — create note with `#etiket`, see in list**

- [ ] **Step 3: Commit**

```bash
git add src/components src/views/NotesView.tsx src/hooks/useAppShortcuts.ts src/App.tsx
git commit -m "feat: quick note capture and notes list"
```

---

### Task 13: People + Initiatives UI

**Files:**
- Create: `src/components/PersonForm.tsx`, `src/components/InitiativeForm.tsx`
- Modify: people/initiative views

**Behavior:**
- List + “Ekle” forms
- Duplicate name → toast + select existing
- Detail pages show linked notes chronologically
- Initiative fields: status select (`aktif`/`beklemede`/`bitti`), blocker summary

- [ ] **Step 1: Implement**

- [ ] **Step 2: Manual — create person, link from note, see on detail**

- [ ] **Step 3: Commit**

```bash
git add src/components/PersonForm.tsx src/components/InitiativeForm.tsx src/views
git commit -m "feat: people and initiatives screens"
```

---

### Task 14: Bugün view + reminder ticker + OS notifications

**Files:**
- Create: `src/notifications/notify.ts`, `src/hooks/useReminderTicker.ts`
- Modify: `src/views/BugunView.tsx`, `src-tauri` notification plugin permissions

**Behavior:**
- Bugün shows due reminders + recent active notes (last 10)
- Every 60s (and on focus), `listDueRemindersForBugun`; for newly due ids not yet notified this session, call notification
- If permission denied: show one-time inline banner “Bildirim izni yok; Bugün paneli çalışmaya devam eder”
- Completing a reminder calls `advanceOrCompleteReminder`

```ts
// src/notifications/notify.ts
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export async function ensureNotifyPermission(): Promise<boolean> {
  let granted = await isPermissionGranted();
  if (!granted) {
    const p = await requestPermission();
    granted = p === "granted";
  }
  return granted;
}

export async function notifyReminder(title: string, body: string): Promise<void> {
  const ok = await ensureNotifyPermission();
  if (!ok) return;
  sendNotification({ title, body });
}
```

- [ ] **Step 1: Implement ticker + Bugün UI**

- [ ] **Step 2: Manual — create reminder due now, see panel + notification (or banner)**

- [ ] **Step 3: Commit**

```bash
git add src/notifications src/hooks/useReminderTicker.ts src/views/BugunView.tsx src-tauri
git commit -m "feat: Bugün panel and OS reminder notifications"
```

---

### Task 15: Search + Command palette + remaining shortcuts

**Files:**
- Create: `src/components/CommandPalette.tsx`
- Modify: `src/views/SearchView.tsx`, `src/hooks/useAppShortcuts.ts`

**Shortcuts (exact):**

| Key | Action |
|-----|--------|
| `Cmd+N` | Quick note |
| `Cmd+K` | Command palette |
| `Cmd+F` | Go to Arama view and focus input |
| `Cmd+1` | Bugün |
| `Cmd+2` | Notlar |
| `Cmd+3` | Kişiler |
| `Cmd+4` | İşler |
| `Esc` | Close modal/palette |

Command palette commands (Turkish): “Hızlı not”, “Bugün”, “Notlar”, “Kişiler”, “İşler”, “Arama”, “Silinenler”, plus jump-to-person/initiative by name filter.

- [ ] **Step 1: Implement**

- [ ] **Step 2: Manual shortcut tour**

- [ ] **Step 3: Commit**

```bash
git add src/components/CommandPalette.tsx src/views/SearchView.tsx src/hooks/useAppShortcuts.ts
git commit -m "feat: search, command palette, and keyboard shortcuts"
```

---

### Task 16: Silinenler UI + confirm permanent delete

**Files:**
- Create: `src/components/ConfirmDialog.tsx`
- Modify: `src/views/TrashView.tsx`

**Behavior:**
- List `listDeletedNotes`
- “Geri yükle” → `restoreNote`
- “Kalıcı sil” → ConfirmDialog text: “Bu not kalıcı olarak silinecek. Emin misiniz?” → `permanentlyDeleteNote`

- [ ] **Step 1: Implement**

- [ ] **Step 2: Manual soft-delete → restore → purge**

- [ ] **Step 3: Commit**

```bash
git add src/components/ConfirmDialog.tsx src/views/TrashView.tsx
git commit -m "feat: Silinenler with restore and permanent delete"
```

---

### Task 17: End-to-end verification + README polish

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run full test suite**

Run: `npm test`  
Expected: all PASS

- [ ] **Step 2: Manual checklist (macOS, `tauri dev`)**

1. Cmd+N note with `#1:1`, link person, reminder  
2. Bugün shows reminder; notification or permission banner  
3. Person detail shows note  
4. Initiative status/blocker editable  
5. Search finds note  
6. Soft delete → Silinenler → restore; purge with confirm  
7. Cmd+1..4, Cmd+K, Cmd+F, Esc  

- [ ] **Step 3: README** — prerequisites (Rust, Node), `npm install`, `npm test`, `npm run tauri dev`

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: add run and verification instructions"
```

---

## Spec coverage (self-review)

| Spec item | Task(s) |
|-----------|---------|
| Tauri + React desktop | 1, 10 |
| Local SQLite + FTS | 5, 9, 10 |
| Freeform notes + tags | 2, 6, 12 |
| People / Initiatives first-class + links | 7, 13 |
| Reminders panel + OS notify | 3, 8, 14 |
| Soft delete / Silinenler | 6, 16 |
| Search | 9, 15 |
| Shortcuts | 12, 15 |
| Turkish UI | 11–16 |
| Draft on save failure | 4, 12 |
| Empty note rejected | 6, 12 |
| Duplicate person/initiative warn | 7, 13 |
| Delete person unlinks only | 7 |
| Soft-deleted reminders suppressed | 8, 14 |
| AI / period goals | Explicitly out of plan (Phase 2) |

No TBD placeholders remain. Repo APIs are async after Task 10; implementers of Tasks 6–9 may start sync and convert in Task 10, or write async from Task 6 using `openTestAsyncDb` immediately (preferred if doing tasks linearly in one pass).
