# Weekly Digest + Optional Claude Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add **Hafta** (week digest by people/initiatives) and **Ayarlar** (optional Claude API key); cache Claude summaries in SQLite.

**Architecture:** Pure TS week range + note range query + grouping. Summaries in `weekly_summaries`. Claude key file + Anthropic HTTP live in Tauri Rust commands; React calls them via a thin `claudeBridge` (mockable in Vitest). No npm Anthropic SDK.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, SQLite (`notesRepo` / new `weeklySummariesRepo`), Tauri 2 Rust commands + `reqwest` (ask user before adding).

## Global Constraints

- No new dependencies without asking the user (especially Cargo `reqwest`).
- Turkish UI copy as in `docs/superpowers/specs/2026-09-06-weekly-digest-claude-design.md`.
- Do not use `window.confirm`.
- Commit only when the user explicitly asks (skip commit steps unless requested).
- Spec: `docs/superpowers/specs/2026-09-06-weekly-digest-claude-design.md`.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/weekRange.ts` | Local Mon–Sun bounds + `week_start` `YYYY-MM-DD` |
| `src/lib/weeklyDigest.ts` | Group notes into person/initiative sections; strip `dlt-img` for payload |
| `src/db/schema.sql` | `weekly_summaries` table |
| `src/db/weeklySummariesRepo.ts` | ensure + get + upsert |
| `src/db/notesRepo.ts` | `listNotesInRange` |
| `src/db/connection.ts` / `src/db/appDb.ts` | Wire ensure + AppDb methods |
| `src/lib/claudeBridge.ts` | `invoke` wrappers (key + summarize) |
| `src-tauri/src/claude.rs` (+ `lib.rs`, `Cargo.toml`) | Key file + Anthropic Messages call |
| `src/views/HaftaView.tsx` | Week UI |
| `src/views/AyarlarView.tsx` | API key save/clear |
| `src/components/Sidebar.tsx`, `CommandPalette.tsx`, `App.tsx` | Nav + routes |
| `src/styles.css` | Minimal layout for Hafta / Ayarlar |
| `tests/weekRange.test.ts`, `tests/weeklyDigest.test.ts`, `tests/notesRepo.test.ts`, `tests/weeklySummariesRepo.test.ts`, `tests/hafta-ayarlar-ui.test.tsx` | Coverage |

---

### Task 1: Week range helpers

**Files:**
- Create: `src/lib/weekRange.ts`
- Create: `tests/weekRange.test.ts`

**Interfaces:**
- Produces:
  - `getWeekRange(anchor: Date): { weekStart: string; startIso: string; endIso: string }`
  - `shiftWeek(weekStart: string, deltaWeeks: number): string`
  - `formatWeekLabel(weekStart: string): string` (tr-TR display)

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import { getWeekRange, shiftWeek } from "../src/lib/weekRange";

describe("weekRange", () => {
  it("returns Monday-local week containing the anchor", () => {
    // Wednesday 2026-09-09 local — construct with local Y/M/D
    const anchor = new Date(2026, 8, 9, 15, 30, 0);
    const range = getWeekRange(anchor);
    expect(range.weekStart).toBe("2026-09-07");
    expect(range.startIso).toBe(new Date(2026, 8, 7, 0, 0, 0, 0).toISOString());
    expect(range.endIso).toBe(new Date(2026, 8, 14, 0, 0, 0, 0).toISOString());
  });

  it("shifts week_start by whole weeks", () => {
    expect(shiftWeek("2026-09-07", -1)).toBe("2026-08-31");
    expect(shiftWeek("2026-09-07", 1)).toBe("2026-09-14");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/weekRange.test.ts`  
Expected: FAIL (module not found)

- [ ] **Step 3: Implement `src/lib/weekRange.ts`**

```ts
function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function toYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Monday = 0 … Sunday = 6 in our Monday-first week. */
function mondayOnOrBefore(d: Date): Date {
  const day = startOfLocalDay(d);
  const jsDay = day.getDay(); // 0 Sun … 6 Sat
  const offset = jsDay === 0 ? 6 : jsDay - 1;
  day.setDate(day.getDate() - offset);
  return day;
}

export function getWeekRange(anchor: Date): {
  weekStart: string;
  startIso: string;
  endIso: string;
} {
  const monday = mondayOnOrBefore(anchor);
  const next = new Date(monday);
  next.setDate(next.getDate() + 7);
  return {
    weekStart: toYmd(monday),
    startIso: monday.toISOString(),
    endIso: next.toISOString(),
  };
}

export function shiftWeek(weekStart: string, deltaWeeks: number): string {
  const d = parseYmd(weekStart);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return toYmd(d);
}

export function formatWeekLabel(weekStart: string): string {
  const start = parseYmd(weekStart);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "short",
    year: "numeric",
  };
  return `${start.toLocaleDateString("tr-TR", opts)} – ${end.toLocaleDateString("tr-TR", opts)}`;
}

export function rangeFromWeekStart(weekStart: string): {
  weekStart: string;
  startIso: string;
  endIso: string;
} {
  return getWeekRange(parseYmd(weekStart));
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/weekRange.test.ts`

---

### Task 2: `listNotesInRange` + `weekly_summaries`

**Files:**
- Modify: `src/db/schema.sql`
- Modify: `src/db/notesRepo.ts`
- Create: `src/db/weeklySummariesRepo.ts`
- Modify: `src/db/connection.ts`
- Modify: `src/db/appDb.ts`
- Modify: `tests/notesRepo.test.ts`
- Create: `tests/weeklySummariesRepo.test.ts`
- Modify (if TS requires): full `AppDb` mocks in `tests/final-review-fixes.test.tsx`, `tests/task15-ui.test.tsx`

**Interfaces:**
- Produces:
  - `listNotesInRange(db, startIso, endIso): Promise<Note[]>`
  - `WeeklySummary = { weekStart, content, model, createdAt }`
  - `ensureWeeklySummariesTable(db)`
  - `getWeeklySummary(db, weekStart)`
  - `upsertWeeklySummary(db, { weekStart, content, model, createdAt })`
  - AppDb methods mirroring the above (bound)

- [ ] **Step 1: Failing notes range test**

Append to `tests/notesRepo.test.ts`:

```ts
it("lists notes in a half-open created_at range and skips deleted", async () => {
  const db = openTestAsyncDb();
  const person = await createPerson(db, {
    name: "Ali",
    nowIso: "2026-09-01T00:00:00.000Z",
  });
  const inRange = await createNote(db, {
    body: "içerde",
    personIds: [person.id],
    nowIso: "2026-09-08T12:00:00.000Z",
  });
  await createNote(db, {
    body: "önce",
    personIds: [person.id],
    nowIso: "2026-09-06T23:59:59.000Z",
  });
  await createNote(db, {
    body: "sonra",
    personIds: [person.id],
    nowIso: "2026-09-14T00:00:00.000Z",
  });
  const deleted = await createNote(db, {
    body: "silindi",
    personIds: [person.id],
    nowIso: "2026-09-09T10:00:00.000Z",
  });
  await softDeleteNote(db, deleted.id, "2026-09-09T11:00:00.000Z");

  const notes = await listNotesInRange(
    db,
    "2026-09-07T00:00:00.000Z",
    "2026-09-14T00:00:00.000Z",
  );
  expect(notes.map((n) => n.id)).toEqual([inRange.id]);
  db.close();
});
```

Import `listNotesInRange`, `softDeleteNote` as needed.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/notesRepo.test.ts`  
Expected: FAIL (`listNotesInRange` missing)

- [ ] **Step 3: Implement `listNotesInRange` in `notesRepo.ts`**

```ts
export async function listNotesInRange(
  db: AsyncDb,
  startIso: string,
  endIso: string,
): Promise<Note[]> {
  const rows = await db.select<NoteRow>(
    `SELECT id, body, created_at, updated_at, deleted_at
     FROM notes
     WHERE deleted_at IS NULL
       AND created_at >= ?
       AND created_at < ?
     ORDER BY created_at DESC, id DESC`,
    [startIso, endIso],
  );
  return mapNoteRows(db, rows);
}
```

(`mapNoteRows` / `NoteRow` are already in this file.)

- [ ] **Step 4: Weekly summaries tests + implementation**

`tests/weeklySummariesRepo.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ensureWeeklySummariesTable,
  getWeeklySummary,
  upsertWeeklySummary,
} from "../src/db/weeklySummariesRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("weeklySummariesRepo", () => {
  it("upserts summary by week_start", async () => {
    const db = openTestAsyncDb();
    await ensureWeeklySummariesTable(db);
    await upsertWeeklySummary(db, {
      weekStart: "2026-09-07",
      content: "ilk",
      model: "claude-test",
      createdAt: "2026-09-08T10:00:00.000Z",
    });
    await upsertWeeklySummary(db, {
      weekStart: "2026-09-07",
      content: "ikinci",
      model: "claude-test",
      createdAt: "2026-09-08T11:00:00.000Z",
    });
    expect(await getWeeklySummary(db, "2026-09-07")).toEqual({
      weekStart: "2026-09-07",
      content: "ikinci",
      model: "claude-test",
      createdAt: "2026-09-08T11:00:00.000Z",
    });
    expect(await getWeeklySummary(db, "2026-08-31")).toBeNull();
    db.close();
  });
});
```

`src/db/weeklySummariesRepo.ts`:

```ts
import type { AsyncDb } from "./asyncDb";

export type WeeklySummary = {
  weekStart: string;
  content: string;
  model: string;
  createdAt: string;
};

type Row = {
  week_start: string;
  content: string;
  model: string;
  created_at: string;
};

export async function ensureWeeklySummariesTable(db: AsyncDb): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS weekly_summaries (
      week_start TEXT PRIMARY KEY,
      content TEXT NOT NULL,
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
    `SELECT week_start, content, model, created_at
     FROM weekly_summaries WHERE week_start = ?`,
    [weekStart],
  );
  const row = rows[0];
  if (!row) return null;
  return {
    weekStart: row.week_start,
    content: row.content,
    model: row.model,
    createdAt: row.created_at,
  };
}

export async function upsertWeeklySummary(
  db: AsyncDb,
  input: WeeklySummary,
): Promise<void> {
  await db.execute(
    `INSERT INTO weekly_summaries (week_start, content, model, created_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(week_start) DO UPDATE SET
       content = excluded.content,
       model = excluded.model,
       created_at = excluded.created_at`,
    [input.weekStart, input.content, input.model, input.createdAt],
  );
}
```

Add the same `CREATE TABLE` block to `src/db/schema.sql` (near other tables).

In `connection.ts`: import + `await ensureWeeklySummariesTable(db)` after schema apply (order with other ensures is fine).

Wire `listNotesInRange`, `getWeeklySummary`, `upsertWeeklySummary` on `AppDb` / `createAppDb`. Add `vi.fn()` stubs on full AppDb test mocks if required.

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/notesRepo.test.ts tests/weeklySummariesRepo.test.ts`  
Expected: PASS

---

### Task 3: Grouping + Claude payload helpers

**Files:**
- Create: `src/lib/weeklyDigest.ts`
- Create: `tests/weeklyDigest.test.ts`

**Interfaces:**
- Consumes: `Note`, `Person`, `Initiative` from `src/lib/types`
- Produces:
  - `groupNotesForWeek(notes, people, initiatives) → { peopleSections, initiativeSections, noteCount, personCount, initiativeCount }`
  - `stripNoteImagesForLlm(body: string): string`
  - `buildClaudeNotesPayload(...)` for the Rust command

- [ ] **Step 1: Failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  groupNotesForWeek,
  stripNoteImagesForLlm,
} from "../src/lib/weeklyDigest";
import type { Initiative, Note, Person } from "../src/lib/types";

const baseNote = (partial: Partial<Note> & Pick<Note, "id" | "body">): Note => ({
  createdAt: "2026-09-08T10:00:00.000Z",
  updatedAt: "2026-09-08T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [],
  initiativeIds: [],
  topicIds: [],
  nextReminderDueAt: null,
  ...partial,
});

describe("weeklyDigest", () => {
  it("groups into both sections when note has person and initiative", () => {
    const people = [{ id: 1, name: "Ayşe" } as Person];
    const initiatives = [{ id: 2, name: "Atlas" } as Initiative];
    const notes = [
      baseNote({ id: 10, body: "hem", personIds: [1], initiativeIds: [2] }),
      baseNote({ id: 11, body: "inbox" }),
    ];
    const g = groupNotesForWeek(notes, people, initiatives);
    expect(g.noteCount).toBe(1);
    expect(g.personCount).toBe(1);
    expect(g.initiativeCount).toBe(1);
    expect(g.peopleSections[0].notes.map((n) => n.id)).toEqual([10]);
    expect(g.initiativeSections[0].notes.map((n) => n.id)).toEqual([10]);
  });

  it("strips dlt-img markers", () => {
    expect(
      stripNoteImagesForLlm("metin ![görsel](dlt-img:abc) son"),
    ).toBe("metin  son");
  });
});
```

(Adjust `Person` / `Initiative` casts to satisfy required fields in `types` — copy a minimal valid object from existing tests.)

- [ ] **Step 2: Implement `weeklyDigest.ts`**

```ts
import type { Initiative, Note, Person } from "./types";

export type DigestSection<T> = {
  entity: T;
  notes: Note[];
};

export type WeekDigest = {
  peopleSections: DigestSection<Person>[];
  initiativeSections: DigestSection<Initiative>[];
  noteCount: number;
  personCount: number;
  initiativeCount: number;
};

export function stripNoteImagesForLlm(body: string): string {
  return body.replace(/!\[[^\]]*\]\(dlt-img:[^)]+\)/g, "").replace(/  +/g, " ").trim();
}

export function groupNotesForWeek(
  notes: Note[],
  people: Person[],
  initiatives: Initiative[],
): WeekDigest {
  const linked = notes.filter(
    (n) => n.personIds.length > 0 || n.initiativeIds.length > 0,
  );
  const peopleById = new Map(people.map((p) => [p.id, p]));
  const initiativesById = new Map(initiatives.map((i) => [i.id, i]));

  const peopleSections: DigestSection<Person>[] = [];
  for (const person of people) {
    const personNotes = linked.filter((n) => n.personIds.includes(person.id));
    if (personNotes.length > 0) {
      peopleSections.push({ entity: person, notes: personNotes });
    }
  }

  const initiativeSections: DigestSection<Initiative>[] = [];
  for (const initiative of initiatives) {
    const initiativeNotes = linked.filter((n) =>
      n.initiativeIds.includes(initiative.id),
    );
    if (initiativeNotes.length > 0) {
      initiativeSections.push({ entity: initiative, notes: initiativeNotes });
    }
  }

  return {
    peopleSections,
    initiativeSections,
    noteCount: linked.length,
    personCount: peopleSections.length,
    initiativeCount: initiativeSections.length,
  };
}

export type ClaudeNotePayloadItem = {
  createdAt: string;
  body: string;
  people: string[];
  initiatives: string[];
};

export function buildClaudeNotesPayload(
  notes: Note[],
  peopleById: Map<number, Person>,
  initiativesById: Map<number, Initiative>,
): ClaudeNotePayloadItem[] {
  return notes
    .filter((n) => n.personIds.length > 0 || n.initiativeIds.length > 0)
    .map((n) => ({
      createdAt: n.createdAt,
      body: stripNoteImagesForLlm(n.body),
      people: n.personIds
        .map((id) => peopleById.get(id)?.name)
        .filter((name): name is string => Boolean(name)),
      initiatives: n.initiativeIds
        .map((id) => initiativesById.get(id)?.name)
        .filter((name): name is string => Boolean(name)),
    }));
}
```

- [ ] **Step 3: Run — expect PASS**

Run: `npx vitest run tests/weeklyDigest.test.ts`

---

### Task 4: Claude bridge (TS) + Rust commands

**Ask the user first:** Add Cargo deps `reqwest` (features: `json`, `rustls-tls`, disable default tls) and ensure `tokio` is available via Tauri. Do not add npm packages.

**Files:**
- Create: `src/lib/claudeBridge.ts`
- Create: `src-tauri/src/claude.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`
- Create: `tests/claudeBridge.test.ts` (optional thin mock test)

**Interfaces:**
- Produces (TS):
  - `hasClaudeApiKey(): Promise<boolean>`
  - `saveClaudeApiKey(key: string): Promise<void>`
  - `clearClaudeApiKey(): Promise<void>`
  - `summarizeWeek(input: { weekStart: string; notes: ClaudeNotePayloadItem[] }): Promise<{ content: string; model: string }>`
- Produces (Rust commands with same snake_case names for `invoke`)

- [ ] **Step 1: After user approves `reqwest`, update `Cargo.toml`**

```toml
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
```

Keep existing `serde` / `serde_json`.

- [ ] **Step 2: Implement `src-tauri/src/claude.rs`**

Responsibilities:
- Key path: `app.path().app_config_dir()?.join("claude_api_key")`
- `has_claude_api_key` → file exists and non-empty after trim
- `save_claude_api_key(key: String)` → create dir, write trimmed key; reject empty
- `clear_claude_api_key` → remove file if present
- `summarize_week(week_start: String, notes_json: String)` → read key from file (not from frontend arg — safer); POST Anthropic Messages:
  - URL `https://api.anthropic.com/v1/messages`
  - Headers: `x-api-key`, `anthropic-version: 2023-06-01`, `content-type: application/json`
  - Model constant e.g. `claude-sonnet-4-20250514` (pin in one `const`)
  - System/user prompt in Turkish: haftalık liderlik özeti; bölümler Kişiler / İşler / Dikkat; only use provided notes
  - Parse `content[0].text` from response
  - Map HTTP 401 → Err("Claude API anahtarı geçersiz")
  - Other errors → Err with short Turkish message

Register in `lib.rs`:

```rust
mod claude;

tauri::Builder::default()
  // …
  .invoke_handler(tauri::generate_handler![
    claude::has_claude_api_key,
    claude::save_claude_api_key,
    claude::clear_claude_api_key,
    claude::summarize_week,
  ])
```

Enable path resolver if needed (`tauri` feature `protocol-asset` not required; use `app.path()` from `tauri::Manager` + `tauri::path::BaseDirectory` / `PathResolver`).

- [ ] **Step 3: TS bridge**

`src/lib/claudeBridge.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import type { ClaudeNotePayloadItem } from "./weeklyDigest";

export async function hasClaudeApiKey(): Promise<boolean> {
  return invoke<boolean>("has_claude_api_key");
}

export async function saveClaudeApiKey(key: string): Promise<void> {
  await invoke("save_claude_api_key", { key });
}

export async function clearClaudeApiKey(): Promise<void> {
  await invoke("clear_claude_api_key");
}

export async function summarizeWeek(input: {
  weekStart: string;
  notes: ClaudeNotePayloadItem[];
}): Promise<{ content: string; model: string }> {
  return invoke("summarize_week", {
    weekStart: input.weekStart,
    notesJson: JSON.stringify(input.notes),
  });
}
```

(Match Rust arg names with serde rename if needed — Tauri passes camelCase from JS by default in v2; align deliberately.)

- [ ] **Step 4: Manual smoke (dev)**

With `npm run tauri dev`: Ayarlar not built yet — optional `cargo check` in `src-tauri`.  
Run: `cd src-tauri && cargo check`  
Expected: success after deps resolve.

---

### Task 5: Ayarlar + Hafta views + navigation

**Files:**
- Create: `src/views/AyarlarView.tsx`
- Create: `src/views/HaftaView.tsx`
- Modify: `src/components/Sidebar.tsx`
- Modify: `src/components/CommandPalette.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`
- Create: `tests/hafta-ayarlar-ui.test.tsx`

**Interfaces:**
- Consumes: AppDb range/summary methods; injectable `claudeBridge` for tests
- Produces: working sidebar routes `hafta` | `ayarlar`

- [ ] **Step 1: UI tests (fail first)**

`tests/hafta-ayarlar-ui.test.tsx` — follow patterns from `tests/task13-ui.test.tsx` / Bugün tests:

1. Render `HaftaView` with mock db returning one person-linked note in range; assert “Kişiler”, note body, counts.
2. `hasClaudeApiKey` mock `false` → no “Claude ile özetle” button; see Ayarlar hint text.
3. `hasClaudeApiKey` mock `true` → button present; click → `summarizeWeek` called → `upsertWeeklySummary` → Özet text shown.
4. `AyarlarView`: save calls `saveClaudeApiKey`; after save shows “kayıtlı” (not raw key).

Inject bridge via props:

```ts
type ClaudeBridge = {
  hasClaudeApiKey: () => Promise<boolean>;
  saveClaudeApiKey: (key: string) => Promise<void>;
  clearClaudeApiKey: () => Promise<void>;
  summarizeWeek: typeof summarizeWeek;
};
```

Default props use real `claudeBridge` module exports.

- [ ] **Step 2: Implement `AyarlarView`**

- Title: Ayarlar
- Label: Claude API anahtarı (opsiyonel)
- Password/text input + **Kaydet** / **Kaldır**
- Privacy line: “Özetle, not metinlerini Anthropic’e gönderir.”
- On load: `hasClaudeApiKey` → show “Anahtar kayıtlı” vs empty form

- [ ] **Step 3: Implement `HaftaView`**

- State: `weekStart` from `getWeekRange(new Date()).weekStart`
- Load: `rangeFromWeekStart` → `listNotesInRange` + `listPeople` + `listInitiatives` + `getWeeklySummary` + `hasClaudeApiKey`
- Header: ◀ ▶ + `formatWeekLabel`
- Counts line
- Cached **Özet** `<pre>` or paragraphs
- Summarize button or Ayarlar hint
- On summarize success: upsert then reload summary; on error toast Turkish message; do not upsert
- Sections Kişiler / İşler with buttons opening person/initiative via props `onOpenPerson` / `onOpenInitiative`

- [ ] **Step 4: Wire navigation**

`Sidebar.tsx` — extend `View` / `SidebarView` with `"hafta" | "ayarlar"`; insert items after İşler (or before Arama):

```ts
{ view: "hafta", label: "Hafta" },
{ view: "ayarlar", label: "Ayarlar" },
```

`CommandPalette.tsx` — same labels in `viewCommands`.

`App.tsx` — cases for `hafta` / `ayarlar` rendering the new views with `onToast`, open person/initiative handlers.

- [ ] **Step 5: Minimal CSS**

Reuse existing list/section patterns from Bugün; add only what is needed (week nav row, summary block). Avoid new design system.

- [ ] **Step 6: Run UI + full suite**

Run: `npx vitest run tests/hafta-ayarlar-ui.test.tsx && npm test`  
Expected: all PASS

---

### Task 6: Spec self-check + polish

- [ ] Confirm every spec bullet has a task deliverable (nav, range, groups both, inbox excluded, key file not SQLite, UPSERT, privacy copy, image strip).
- [ ] `cargo check` + `npm test` green.
- [ ] Commit only if user asks; if pushing, include design already on `main` and this feature together only when requested.

---

## Self-review (plan vs spec)

| Spec item | Task |
|-----------|------|
| Sidebar Hafta + Ayarlar + palette | 5 |
| Week nav Mon–Sun local | 1, 5 |
| Counts + sections both ways | 3, 5 |
| Inbox / deleted excluded | 2, 3 |
| `weekly_summaries` cache UPSERT | 2, 5 |
| Key file + optional summarize | 4, 5 |
| Rust Anthropic + Turkish errors | 4 |
| Strip `dlt-img` | 3, 4 payload |
| Tests listed in spec | 1–5 |

No OpenAI / self-performance / scheduled digest in plan (out of scope).
