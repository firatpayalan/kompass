# Weekly Digest + Optional LLM Summary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add **Hafta** (week digest by people/initiatives) and **Ayarlar** (optional Claude and/or OpenAI API keys, provider + curated model); cache summaries in SQLite.

**Architecture:** Pure TS week range + note range query + grouping. Summaries in `weekly_summaries` (with `provider`). Keys + `llm_settings.json` on disk; Anthropic **or** OpenAI HTTP in Tauri Rust; React via mockable `llmBridge`. No npm LLM SDKs.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, SQLite (`notesRepo` / new `weeklySummariesRepo`), Tauri 2 Rust commands + `reqwest` (ask user before adding).

## Global Constraints

- No new dependencies without asking the user (especially Cargo `reqwest`).
- Turkish UI copy as in `docs/superpowers/specs/2026-09-06-weekly-digest-claude-design.md`.
- Do not use `window.confirm`.
- Commit only when the user explicitly asks (skip commit steps unless requested).
- Spec: `docs/superpowers/specs/2026-09-06-weekly-digest-claude-design.md`.
- OpenAI = Platform API key only (not ChatGPT Plus). Model pick = curated `<select>` per provider (no free-text in v1).

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/weekRange.ts` | Local Mon–Sun bounds + `week_start` `YYYY-MM-DD` |
| `src/lib/weeklyDigest.ts` | Group notes; strip `dlt-img`; LLM note payload |
| `src/lib/llmModels.ts` | Curated Claude/OpenAI model lists + defaults |
| `src/db/schema.sql` | `weekly_summaries` (`provider`, `model`, …) |
| `src/db/weeklySummariesRepo.ts` | ensure + get + upsert |
| `src/db/notesRepo.ts` | `listNotesInRange` |
| `src/db/connection.ts` / `src/db/appDb.ts` | Wire ensure + AppDb methods |
| `src/lib/llmBridge.ts` | `invoke` wrappers (keys, settings, summarize) |
| `src-tauri/src/llm.rs` (+ `lib.rs`, `Cargo.toml`) | Key files, settings JSON, Anthropic + OpenAI HTTP |
| `src/views/HaftaView.tsx` | Week UI |
| `src/views/AyarlarView.tsx` | Keys + provider + model selects |
| `src/components/Sidebar.tsx`, `CommandPalette.tsx`, `App.tsx` | Nav + routes |
| `src/styles.css` | Minimal layout for Hafta / Ayarlar |
| `tests/weekRange.test.ts`, `tests/weeklyDigest.test.ts`, `tests/llmModels.test.ts`, `tests/notesRepo.test.ts`, `tests/weeklySummariesRepo.test.ts`, `tests/hafta-ayarlar-ui.test.tsx` | Coverage |

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
  - `WeeklySummary = { weekStart, content, provider, model, createdAt }`
  - `ensureWeeklySummariesTable(db)`
  - `getWeeklySummary(db, weekStart)`
  - `upsertWeeklySummary(db, { weekStart, content, provider, model, createdAt })`
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
      provider: "claude",
      model: "claude-test",
      createdAt: "2026-09-08T10:00:00.000Z",
    });
    await upsertWeeklySummary(db, {
      weekStart: "2026-09-07",
      content: "ikinci",
      provider: "openai",
      model: "gpt-4.1",
      createdAt: "2026-09-08T11:00:00.000Z",
    });
    expect(await getWeeklySummary(db, "2026-09-07")).toEqual({
      weekStart: "2026-09-07",
      content: "ikinci",
      provider: "openai",
      model: "gpt-4.1",
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

export type LlmNotePayloadItem = {
  createdAt: string;
  body: string;
  people: string[];
  initiatives: string[];
};

export function buildLlmNotesPayload(
  notes: Note[],
  peopleById: Map<number, Person>,
  initiativesById: Map<number, Initiative>,
): LlmNotePayloadItem[] {
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

- [ ] **Step 3: Add `src/lib/llmModels.ts` + test**

```ts
export type LlmProvider = "claude" | "openai";

export type LlmModelOption = { id: string; label: string };

export const CLAUDE_MODELS: LlmModelOption[] = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { id: "claude-haiku-4-20250414", label: "Claude Haiku 4" },
];

export const OPENAI_MODELS: LlmModelOption[] = [
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "o4-mini", label: "o4-mini" },
];

export function modelsFor(provider: LlmProvider): LlmModelOption[] {
  return provider === "claude" ? CLAUDE_MODELS : OPENAI_MODELS;
}

export function defaultModel(provider: LlmProvider): string {
  return modelsFor(provider)[0].id;
}

/** If model not in provider list, fall back to default. */
export function coerceModel(provider: LlmProvider, model: string): string {
  const allowed = modelsFor(provider).map((m) => m.id);
  return allowed.includes(model) ? model : defaultModel(provider);
}
```

Test: `coerceModel("openai", "claude-sonnet-4-20250514") === "gpt-4.1"`.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/weeklyDigest.test.ts tests/llmModels.test.ts`

---

### Task 4: LLM bridge (TS) + Rust (Claude + OpenAI)

**Ask the user first:** Add Cargo dep `reqwest` (features: `json`, `rustls-tls`, default-features false). Do not add npm packages.

**Files:**
- Create: `src/lib/llmBridge.ts`
- Create: `src-tauri/src/llm.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/Cargo.toml`

**Interfaces:**
- Produces (TS):
  - `hasClaudeApiKey` / `saveClaudeApiKey` / `clearClaudeApiKey`
  - `hasOpenaiApiKey` / `saveOpenaiApiKey` / `clearOpenaiApiKey`
  - `getLlmSettings(): Promise<{ provider: LlmProvider; model: string }>`
  - `setLlmSettings(settings): Promise<void>`
  - `summarizeWeek({ weekStart, notes }): Promise<{ content, provider, model }>`
- Rust reads secrets from disk; frontend never passes raw keys into `summarize_week`.

- [ ] **Step 1: After user approves `reqwest`, update `Cargo.toml`**

```toml
reqwest = { version = "0.12", default-features = false, features = ["json", "rustls-tls"] }
```

- [ ] **Step 2: Implement `src-tauri/src/llm.rs`**

Config dir files:
- `claude_api_key`, `openai_api_key`
- `llm_settings.json` → `{ "provider": "claude"|"openai", "model": "..." }`

Commands: has/save/clear for both keys; get/set settings; `summarize_week(week_start, notes_json)`:
- Load settings; require matching key present
- Shared Turkish prompt (Kişiler / İşler / Dikkat)
- **Claude:** `POST https://api.anthropic.com/v1/messages` (`x-api-key`, `anthropic-version: 2023-06-01`)
- **OpenAI:** `POST https://api.openai.com/v1/chat/completions` (`Authorization: Bearer …`)
- Return `{ content, provider, model }`; 401 → Turkish “API anahtarı geçersiz”

Register all commands in `lib.rs` `invoke_handler`.

- [ ] **Step 3: TS `llmBridge.ts`**

Wrap `invoke` for every command above. Align camelCase args with Tauri v2.

- [ ] **Step 4: `cargo check`**

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
- Consumes: AppDb + injectable `LlmBridge` for tests
- Produces: routes `hafta` | `ayarlar`

- [ ] **Step 1: UI tests (fail first)**

1. `HaftaView` with person-linked note → Kişiler + counts.
2. No keys → no **Özetle**; Ayarlar hint.
3. Claude key + settings → **Özetle** → upsert with `provider: "claude"`.
4. `AyarlarView`: both key fields; provider select enables only providers with keys; changing provider swaps model `<option>`s via `modelsFor`; save settings calls `setLlmSettings`.

- [ ] **Step 2: Implement `AyarlarView`**

- Claude key + OpenAI key (Kaydet / Kaldır each)
- Sağlayıcı select + Model select (from `llmModels.ts`)
- Privacy: “Özetle, not metinlerini seçilen sağlayıcıya (Anthropic veya OpenAI) gönderir.”

- [ ] **Step 3: Implement `HaftaView`**

- Week nav + load range/summary/settings/key flags
- **Özetle** when selected provider has a key; else Ayarlar hint
- Upsert includes `provider` + `model` from summarize result
- Show cached özet + provider/model caption when present

- [ ] **Step 4: Wire navigation** (`hafta`, `ayarlar` in Sidebar + CommandPalette + App)

- [ ] **Step 5: Minimal CSS**

- [ ] **Step 6: `npx vitest run tests/hafta-ayarlar-ui.test.tsx && npm test`** — all PASS

---

### Task 6: Spec self-check + polish

- [ ] Spec coverage: dual keys, provider/model selects, curated lists, OpenAI chat completions path, `provider` on cache.
- [ ] `cargo check` + `npm test` green.
- [ ] Commit only if user asks.

---

## Self-review (plan vs spec)

| Spec item | Task |
|-----------|------|
| Sidebar Hafta + Ayarlar + palette | 5 |
| Week nav Mon–Sun local | 1, 5 |
| Counts + sections both ways | 3, 5 |
| Inbox / deleted excluded | 2, 3 |
| `weekly_summaries` + provider UPSERT | 2, 5 |
| Claude + OpenAI keys, settings JSON | 4, 5 |
| Curated model selects | 3 (`llmModels`), 5 |
| Rust Anthropic + OpenAI + Turkish errors | 4 |
| Strip `dlt-img` | 3, 4 |
| Tests listed in spec | 1–5 |

Out of scope remains: ChatGPT Plus session, free-text model ids, other providers, self-performance digests.
