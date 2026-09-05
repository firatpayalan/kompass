# Linked-Note Reminder Urgency Colors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tint LinkedNotes cards light red when the note’s earliest open reminder is overdue, or yellow when due within 0–3 local calendar days.

**Architecture:** Batch-load `MIN(due_at)` for open note reminders inside `mapNoteRows` onto `Note.nextReminderDueAt`. A pure `reminderUrgency(dueAt, now)` helper drives CSS modifier classes on each LinkedNotes `<li>`.

**Tech Stack:** React + TypeScript, Vitest, existing `reminders` table.

## Global Constraints

- No new dependencies without asking.
- Local calendar-day comparison (ignore time-of-day).
- Overdue → light red; `0 ≤ daysUntil ≤ 3` → yellow; else default.
- Earliest open (`done = 0`) reminder only.
- Commit only when the user asks.
- Spec: `docs/superpowers/specs/2026-09-06-linked-note-reminder-colors-design.md`
- Do not push `requirements.md`.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/types.ts` | `Note.nextReminderDueAt` |
| `src/lib/reminderUrgency.ts` | Pure urgency helper |
| `src/db/notesRepo.ts` | Batch attach next due in `mapNoteRows` |
| `src/components/LinkedNotes.tsx` | Apply class on `<li>` |
| `src/styles.css` | `.linked-note-list__item--overdue` / `--soon` |
| `tests/reminderUrgency.test.ts` | Helper cases |
| `tests/notesRepo.test.ts` | nextReminderDueAt mapping |
| `tests/linked-note-reminder-colors-ui.test.tsx` | LinkedNotes class |

---

### Task 1: Data + urgency helper

**Files:**
- Create: `src/lib/reminderUrgency.ts`
- Create: `tests/reminderUrgency.test.ts`
- Modify: `src/lib/types.ts`
- Modify: `src/db/notesRepo.ts`
- Modify: `tests/notesRepo.test.ts`

**Interfaces:**
- `Note.nextReminderDueAt: string | null`
- `export type ReminderUrgency = "overdue" | "soon"`
- `export function reminderUrgency(dueAt: string | null | undefined, now: Date = new Date()): ReminderUrgency | null`

- [ ] **Step 1: Write helper tests**

```ts
// tests/reminderUrgency.test.ts
import { describe, expect, it } from "vitest";
import { reminderUrgency } from "../src/lib/reminderUrgency";

const noon = (y: number, m: number, d: number) => new Date(y, m, d, 12);

describe("reminderUrgency", () => {
  it("returns null without a due date", () => {
    expect(reminderUrgency(null, noon(2026, 8, 6))).toBeNull();
    expect(reminderUrgency(undefined, noon(2026, 8, 6))).toBeNull();
  });

  it("marks overdue when due day is before today", () => {
    expect(
      reminderUrgency(new Date(2026, 8, 5, 23, 59).toISOString(), noon(2026, 8, 6)),
    ).toBe("overdue");
  });

  it("marks soon for today through +3 days", () => {
    const now = noon(2026, 8, 6);
    expect(reminderUrgency(new Date(2026, 8, 6, 8).toISOString(), now)).toBe("soon");
    expect(reminderUrgency(new Date(2026, 8, 9, 18).toISOString(), now)).toBe("soon");
  });

  it("returns null when more than 3 days out", () => {
    expect(
      reminderUrgency(new Date(2026, 8, 10, 0).toISOString(), noon(2026, 8, 6)),
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run — FAIL**

`npx vitest run tests/reminderUrgency.test.ts`

- [ ] **Step 3: Implement helper**

```ts
// src/lib/reminderUrgency.ts
export type ReminderUrgency = "overdue" | "soon";

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole local days from today to due date: negative = overdue. */
export function reminderUrgency(
  dueAt: string | null | undefined,
  now: Date = new Date(),
): ReminderUrgency | null {
  if (!dueAt) return null;
  const due = startOfLocalDay(new Date(dueAt));
  const today = startOfLocalDay(now);
  const days =
    Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return null;
}
```

- [ ] **Step 4: Note type + mapNoteRows**

Add to `Note`:

```ts
nextReminderDueAt: string | null;
```

In `mapNoteRows`, after collecting `noteIds`, query:

```sql
SELECT target_id AS note_id, MIN(due_at) AS due_at
FROM reminders
WHERE done = 0
  AND target_type = 'note'
  AND target_id IN (...)
GROUP BY target_id
```

Map into `nextReminderDueAt: dueMap.get(row.id) ?? null`.

Update **all** test fixtures / objectContaining note literals that construct full `Note` objects to include `nextReminderDueAt: null` (or expect.any) — grep `as Note` / `Note = {` / `topicIds: []` fixtures.

Add repo test: create note + open reminder → `getNote` / list includes `nextReminderDueAt`; done reminder ignored; earliest of two wins.

- [ ] **Step 5: Run**

`npx vitest run tests/reminderUrgency.test.ts tests/notesRepo.test.ts`

Then `npm test` and fix fixture type errors until green.

- [ ] **Step 6: Commit only if asked**

---

### Task 2: LinkedNotes styling

**Files:**
- Modify: `src/components/LinkedNotes.tsx`
- Modify: `src/styles.css`
- Create: `tests/linked-note-reminder-colors-ui.test.tsx`

**Interfaces:**
- Consumes `reminderUrgency` + `note.nextReminderDueAt`

- [ ] **Step 1: Failing UI test**

```tsx
// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import LinkedNotes from "../src/components/LinkedNotes";
import type { Note } from "../src/lib/types";

afterEach(cleanup);

const base: Note = {
  id: 1,
  body: "Mail grubu olusturma",
  createdAt: "2026-09-06T01:00:00.000Z",
  updatedAt: "2026-09-06T01:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [],
  initiativeIds: [],
  topicIds: [],
  nextReminderDueAt: null,
};

describe("LinkedNotes reminder colors", () => {
  it("applies overdue class when reminder is past", () => {
    const { container } = render(
      <LinkedNotes
        loading={false}
        notes={[{ ...base, nextReminderDueAt: "2026-09-01T10:00:00.000Z" }]}
        now={() => new Date(2026, 8, 6, 12)}
      />,
    );
    expect(container.querySelector(".linked-note-list__item--overdue")).toBeTruthy();
  });

  it("applies soon class when due within 3 days", () => {
    const { container } = render(
      <LinkedNotes
        loading={false}
        notes={[{ ...base, nextReminderDueAt: "2026-09-08T10:00:00.000Z" }]}
        now={() => new Date(2026, 8, 6, 12)}
      />,
    );
    expect(container.querySelector(".linked-note-list__item--soon")).toBeTruthy();
  });
});
```

Add optional `now?: () => Date` prop to LinkedNotes (default `() => new Date()`) for testability — do not plumb through parents.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement UI + CSS**

On each `<li>`:

```tsx
const urgency = reminderUrgency(note.nextReminderDueAt, now());
const className = [
  "linked-note-list__item",
  urgency === "overdue" ? "linked-note-list__item--overdue" : null,
  urgency === "soon" ? "linked-note-list__item--soon" : null,
].filter(Boolean).join(" ");
```

CSS (subtle):

```css
.linked-note-list__item--overdue {
  background: #fde8e8;
  border-color: #f0b4b4;
}
.linked-note-list__item--soon {
  background: #fff6d8;
  border-color: #e8d48a;
}
```

Keep default `.linked-note-list li` rules; modifiers override background/border.

- [ ] **Step 4: Full suite**

`npm test` → all PASS

- [ ] **Step 5: Commit only if asked**

---

## Spec coverage

| Spec | Task |
|------|------|
| nextReminderDueAt batch | 1 |
| Day math overdue/soon | 1 |
| Card tint LinkedNotes | 2 |
| Helper + UI tests | 1–2 |
