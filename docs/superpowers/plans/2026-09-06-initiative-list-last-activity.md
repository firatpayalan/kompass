# Initiative List Last Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show each initiative’s last linked-note activity on **İşler → İş listesi** as relative Turkish time (minute precision), with status always on the far right.

**Architecture:** Derive `lastActivityAt` in SQL (`MAX` of active linked notes’ `updated_at`, else `created_at`). Add a pure `formatRelativeTr` helper. Render a fixed activity column between the name and the status badge in `InitiativesView`.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, SQLite via `initiativesRepo`.

## Global Constraints

- No new dependencies without asking the user.
- Turkish UI copy as specified in the design doc.
- Do not use `window.confirm`.
- Commit only when the user explicitly asks (skip commit steps unless requested).
- Spec: `docs/superpowers/specs/2026-09-06-initiative-list-last-activity-design.md`

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/formatRelativeTr.ts` | Pure relative Turkish time formatter |
| `tests/formatRelativeTr.test.ts` | Formatter unit cases |
| `src/lib/types.ts` | Add `lastActivityAt` to `Initiative` |
| `src/db/initiativesRepo.ts` | Select/map `last_activity_at` on all initiative reads |
| `tests/initiativesRepo.test.ts` | Activity derivation cases + update existing expectations |
| `src/views/InitiativesView.tsx` | Show relative activity; status trailing |
| `src/styles.css` | Heading grid: name \| activity \| status |
| `tests/initiative-list-activity-ui.test.tsx` | List shows relative text; status order |
| Multiple `tests/*.tsx` fixtures | Add `lastActivityAt` so `Initiative` literals type-check |

---

### Task 1: `formatRelativeTr` helper

**Files:**
- Create: `src/lib/formatRelativeTr.ts`
- Create: `tests/formatRelativeTr.test.ts`

**Interfaces:**
- Consumes: none
- Produces: `formatRelativeTr(iso: string, now?: Date): string`

- [ ] **Step 1: Write the failing tests**

Create `tests/formatRelativeTr.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatRelativeTr } from "../src/lib/formatRelativeTr";

describe("formatRelativeTr", () => {
  const now = new Date("2026-09-06T12:00:00.000Z");

  it("returns az önce under one minute", () => {
    expect(formatRelativeTr("2026-09-06T11:59:30.000Z", now)).toBe("az önce");
  });

  it("returns minutes", () => {
    expect(formatRelativeTr("2026-09-06T11:59:00.000Z", now)).toBe(
      "1 dakika önce",
    );
    expect(formatRelativeTr("2026-09-06T11:48:00.000Z", now)).toBe(
      "12 dakika önce",
    );
  });

  it("returns hours", () => {
    expect(formatRelativeTr("2026-09-06T11:00:00.000Z", now)).toBe(
      "1 saat önce",
    );
    expect(formatRelativeTr("2026-09-06T07:00:00.000Z", now)).toBe(
      "5 saat önce",
    );
  });

  it("returns days under a week", () => {
    expect(formatRelativeTr("2026-09-05T12:00:00.000Z", now)).toBe(
      "1 gün önce",
    );
    expect(formatRelativeTr("2026-09-03T12:00:00.000Z", now)).toBe(
      "3 gün önce",
    );
  });

  it("returns short date at seven days or more", () => {
    const label = formatRelativeTr("2026-08-30T12:00:00.000Z", now);
    expect(label).toMatch(/30/);
    expect(label).toMatch(/2026/);
    expect(label).not.toMatch(/önce/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/formatRelativeTr.test.ts`

Expected: FAIL (module not found / export missing)

- [ ] **Step 3: Implement the helper**

Create `src/lib/formatRelativeTr.ts`:

```ts
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function formatRelativeTr(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffMs = Math.max(0, now.getTime() - then);

  if (diffMs < MINUTE_MS) return "az önce";

  const minutes = Math.floor(diffMs / MINUTE_MS);
  if (minutes < 60) {
    return minutes === 1 ? "1 dakika önce" : `${minutes} dakika önce`;
  }

  const hours = Math.floor(diffMs / HOUR_MS);
  if (hours < 24) {
    return hours === 1 ? "1 saat önce" : `${hours} saat önce`;
  }

  const days = Math.floor(diffMs / DAY_MS);
  if (days < 7) {
    return days === 1 ? "1 gün önce" : `${days} gün önce`;
  }

  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/formatRelativeTr.test.ts`

Expected: PASS

- [ ] **Step 5: Commit only if the user asked**

---

### Task 2: Derive `lastActivityAt` in `initiativesRepo`

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/db/initiativesRepo.ts`
- Modify: `tests/initiativesRepo.test.ts`
- Modify: every test fixture that constructs an `Initiative` literal (add `lastActivityAt`, typically equal to `createdAt`)

**Interfaces:**
- Consumes: existing note / `note_initiatives` tables
- Produces: `Initiative.lastActivityAt: string` on all repo returns

- [ ] **Step 1: Write failing repo tests**

Append to `tests/initiativesRepo.test.ts`:

```ts
it("uses createdAt as lastActivityAt when there are no linked notes", async () => {
  const db = openTestAsyncDb();
  const nowIso = "2026-09-05T10:00:00.000Z";
  const initiative = await createInitiative(db, {
    name: "Boş",
    status: "aktif",
    nowIso,
  });
  expect(initiative.lastActivityAt).toBe(nowIso);
  expect((await listInitiatives(db))[0].lastActivityAt).toBe(nowIso);
  db.close();
});

it("uses max active linked note updatedAt as lastActivityAt", async () => {
  const db = openTestAsyncDb();
  const createdAt = "2026-09-05T10:00:00.000Z";
  const initiative = await createInitiative(db, {
    name: "Aktif iş",
    status: "aktif",
    nowIso: createdAt,
  });
  const older = await createNote(db, {
    body: "Eski",
    nowIso: "2026-09-05T11:00:00.000Z",
  });
  const newer = await createNote(db, {
    body: "Yeni",
    nowIso: "2026-09-05T12:00:00.000Z",
  });
  await linkNoteToInitiatives(db, older.id, [initiative.id]);
  await linkNoteToInitiatives(db, newer.id, [initiative.id]);

  const [listed] = await listInitiatives(db);
  expect(listed.lastActivityAt).toBe("2026-09-05T12:00:00.000Z");
  db.close();
});

it("ignores soft-deleted linked notes for lastActivityAt", async () => {
  const db = openTestAsyncDb();
  const createdAt = "2026-09-05T10:00:00.000Z";
  const initiative = await createInitiative(db, {
    name: "Silinen notlu",
    status: "aktif",
    nowIso: createdAt,
  });
  const active = await createNote(db, {
    body: "Aktif",
    nowIso: "2026-09-05T11:00:00.000Z",
  });
  const deleted = await createNote(db, {
    body: "Silinmiş",
    nowIso: "2026-09-05T13:00:00.000Z",
  });
  await softDeleteNote(db, deleted.id, "2026-09-05T14:00:00.000Z");
  await linkNoteToInitiatives(db, active.id, [initiative.id]);
  await linkNoteToInitiatives(db, deleted.id, [initiative.id]);

  const [listed] = await listInitiatives(db);
  expect(listed.lastActivityAt).toBe("2026-09-05T11:00:00.000Z");
  db.close();
});
```

Also update the existing `creates and lists initiatives` / `updates only supplied…` expectations to include `lastActivityAt: nowIso` (or equal to `createdAt`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/initiativesRepo.test.ts`

Expected: FAIL on missing `lastActivityAt` / wrong value

- [ ] **Step 3: Add type field**

In `src/lib/types.ts`, on `Initiative`:

```ts
export interface Initiative {
  id: number;
  name: string;
  status: InitiativeStatus;
  blockerSummary: string | null;
  createdAt: string;
  lastActivityAt: string;
  sortOrder: number;
  archivedAt: string | null;
}
```

- [ ] **Step 4: Implement SQL + mapping in `initiativesRepo.ts`**

Update `InitiativeRow` and column selection:

```ts
type InitiativeRow = {
  id: number;
  name: string;
  status: InitiativeStatus;
  blocker_summary: string | null;
  created_at: string;
  last_activity_at: string;
  sort_order: number;
  archived_at: string | null;
};

const LAST_ACTIVITY_SQL = `COALESCE(
  (
    SELECT MAX(notes.updated_at)
    FROM note_initiatives
    INNER JOIN notes ON notes.id = note_initiatives.note_id
    WHERE note_initiatives.initiative_id = initiatives.id
      AND notes.deleted_at IS NULL
  ),
  initiatives.created_at
)`;

const INITIATIVE_COLUMNS = `id, name, status, blocker_summary, created_at,
  ${LAST_ACTIVITY_SQL} AS last_activity_at,
  sort_order, archived_at`;
```

In `mapInitiative`:

```ts
lastActivityAt: row.last_activity_at,
```

Keep `INSERT … RETURNING ${INITIATIVE_COLUMNS}` and all `SELECT ${INITIATIVE_COLUMNS}` / `UPDATE … RETURNING` paths using this expression so create/update/list/get/restore stay consistent.

Note: `UPDATE initiatives SET sort_order` / `archived_at` paths that re-read via `getInitiative` inherit the expression automatically.

- [ ] **Step 5: Fix fixtures**

Add `lastActivityAt: <same as createdAt>` (or a sensible ISO) to every `Initiative` object literal in tests until `tsc` / vitest typecheck is clean. Common files from repo search: `tests/task13-ui.test.tsx`, `tests/final-review-fixes.test.tsx`, `tests/initiatives-archive-ui.test.tsx`, `tests/inbox-ui.test.tsx`, `tests/task15-ui.test.tsx`, `tests/notes-links-ui.test.tsx`, `tests/initiative-note-tags-ui.test.tsx`, and any others that fail.

- [ ] **Step 6: Run repo tests**

Run: `npx vitest run tests/initiativesRepo.test.ts`

Expected: PASS

- [ ] **Step 7: Commit only if the user asked**

---

### Task 3: Show activity on İş listesi (status far right)

**Files:**
- Modify: `src/views/InitiativesView.tsx`
- Modify: `src/styles.css`
- Create: `tests/initiative-list-activity-ui.test.tsx`

**Interfaces:**
- Consumes: `Initiative.lastActivityAt`, `formatRelativeTr`
- Produces: list row UI with activity column left of status

- [ ] **Step 1: Write the failing UI test**

Create `tests/initiative-list-activity-ui.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import InitiativesView from "../src/views/InitiativesView";
import type { Initiative } from "../src/lib/types";

const initiative: Initiative = {
  id: 1,
  name: "Pulse 2026 H2",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  lastActivityAt: "2026-09-06T11:48:00.000Z",
  sortOrder: 0,
  archivedAt: null,
};

describe("initiative list last activity", () => {
  it("shows relative activity left of status", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-06T12:00:00.000Z"));

    render(
      <InitiativesView
        db={{
          createInitiative: vi.fn(),
          createNote: vi.fn(),
          listInitiatives: vi.fn().mockResolvedValue([initiative]),
          reorderInitiatives: vi.fn(),
          archiveInitiative: vi.fn(),
        }}
        onToast={vi.fn()}
      />,
    );

    expect(await screen.findByText("Pulse 2026 H2")).toBeInTheDocument();
    expect(screen.getByText("12 dakika önce")).toBeInTheDocument();

    const open = screen.getByRole("button", { name: "Pulse 2026 H2" });
    const activity = open.querySelector("time");
    const status = open.querySelector(".status");
    expect(activity).not.toBeNull();
    expect(status).not.toBeNull();
    expect(
      Boolean(
        activity &&
          status &&
          Boolean(
            activity.compareDocumentPosition(status) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ),
      ),
    ).toBe(true);

    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run UI test to verify it fails**

Run: `npx vitest run tests/initiative-list-activity-ui.test.tsx`

Expected: FAIL (text not found)

- [ ] **Step 3: Update CSS — only entity-list heading**

In `src/styles.css`, split shared rule so detail headings stay flex, list headings become a 3-column grid:

```css
.detail-view__heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.entity-list__heading {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(7.5rem, auto) auto;
  align-items: center;
  gap: 1rem;
}

.entity-list__activity {
  color: #64748b;
  font-size: 0.85rem;
  font-weight: 500;
  text-align: right;
  white-space: nowrap;
}

.entity-list__activity time {
  color: inherit;
}
```

Remove `.entity-list__heading` from the old combined flex rule if both were listed together.

- [ ] **Step 4: Wire `InitiativesView`**

Import `formatRelativeTr`. Inside the open button heading:

```tsx
<span className="entity-list__heading">
  <strong>{initiative.name}</strong>
  <span className="entity-list__activity">
    <time
      dateTime={initiative.lastActivityAt}
      title={new Date(initiative.lastActivityAt).toLocaleString("tr-TR")}
    >
      {formatRelativeTr(initiative.lastActivityAt)}
    </time>
  </span>
  <span className={`status status--${initiative.status}`}>
    {statusLabels[initiative.status]}
  </span>
</span>
```

Keep blocker summary below the heading as today.

- [ ] **Step 5: Run UI + full suite**

Run:

```bash
npx vitest run tests/initiative-list-activity-ui.test.tsx tests/formatRelativeTr.test.ts tests/initiativesRepo.test.ts
npm test
```

Expected: all PASS

- [ ] **Step 6: Commit only if the user asked**

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `lastActivityAt` from max active note `updated_at` | Task 2 |
| Fallback to `createdAt` | Task 2 |
| Ignore soft-deleted notes | Task 2 |
| Relative TR minute precision + ≥7d short date | Task 1 |
| Tooltip full `toLocaleString("tr-TR")` | Task 3 |
| No live ticking | Task 3 (render-only) |
| Layout: activity then status far right | Task 3 |
| No reorder-by-activity / archive list / field-edit activity | Out of scope — no tasks |

## Self-review notes

- No placeholders; interfaces named consistently (`lastActivityAt` / `last_activity_at` / `formatRelativeTr`).
- `detail-view__heading` intentionally left as flex so person/initiative detail headers are unchanged.
- Fixture sweep in Task 2 prevents type breakage across the suite.
