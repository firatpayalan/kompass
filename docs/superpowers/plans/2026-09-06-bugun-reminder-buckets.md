# Bugün Reminder Buckets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split Bugün reminders into **Gecikenler**, **Hatırlatmalar** (today only), and **Yaklaşanlar** (+7 days) without overlapping, while keeping notifications for overdue + today.

**Architecture:** Add `listOverdueReminders` and `listUpcomingReminders`; narrow `listDueRemindersForBugun` to the local calendar day. `useReminderTicker` loads all three buckets, notifies on overdue∪today, and exposes three arrays to `BugunView`. Shared SQL/title join helper avoids duplication.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, SQLite via `remindersRepo`.

## Global Constraints

- No new dependencies without asking the user.
- Turkish section titles exactly: **Gecikenler**, **Hatırlatmalar**, **Yaklaşanlar**.
- Empty copy: **Geciken hatırlatma yok.** / **Bugün için hatırlatma yok.** / **Yaklaşan hatırlatma yok.**
- Do not use `window.confirm`.
- Commit only when the user explicitly asks (skip commit steps unless requested).
- Spec: `docs/superpowers/specs/2026-09-06-bugun-reminder-buckets-design.md`
- Out of scope: initiative due dates, Son notlar changes, English titles, schema changes.

## File map

| File | Responsibility |
|------|----------------|
| `src/db/remindersRepo.ts` | Day-boundary helpers + three list queries |
| `src/db/appDb.ts` | Expose new list methods |
| `src/hooks/useReminderTicker.ts` | Load three buckets; notify overdue∪today |
| `src/views/BugunView.tsx` | Render three sections |
| `tests/remindersRepo.test.ts` | Bucket boundary tests |
| `tests/task14-ui.test.tsx` (+/or new UI test) | Three headings + complete overdue |
| `tests/final-review-fixes.test.tsx`, `tests/task15-ui.test.tsx` | Mock new AppDb methods if required |

---

### Task 1: Reminder list queries (overdue / today / upcoming)

**Files:**
- Modify: `src/db/remindersRepo.ts`
- Modify: `src/db/appDb.ts`
- Modify: `tests/remindersRepo.test.ts`
- Modify (if needed): `tests/final-review-fixes.test.tsx`, `tests/task15-ui.test.tsx`

**Interfaces:**
- Produces:
  - `listOverdueReminders(db, now: Date): Promise<Array<Reminder & { title: string }>>`
  - `listDueRemindersForBugun(db, now)` — **today only** (local start ≤ due_at ≤ local end)
  - `listUpcomingReminders(db, now)` — tomorrow 00:00 ≤ due_at ≤ end of (today + 7 days)
- Local day helpers (export or keep private in repo file):

```ts
function startOfLocalDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}
function endOfLocalDay(now: Date): Date {
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );
}
```

- [ ] **Step 1: Rewrite / extend failing repo tests**

In `tests/remindersRepo.test.ts`:

1. Rename/update the old “through the end of the local day” test so **today-only** excludes tomorrow (already does) **and** excludes yesterday overdue:

```ts
it("lists unfinished reminders due today only with titles", async () => {
  const db = openTestAsyncDb();
  const now = new Date(2026, 8, 5, 12);
  // ... create note + initiative as today ...
  await createReminder(..., dueAt: new Date(2026, 8, 4, 18)); // yesterday — NOT in today list
  await createReminder(..., dueAt: new Date(2026, 8, 6, 9)); // tomorrow — NOT in today list
  // today reminders remain as before
  expect(await listDueRemindersForBugun(db, now)).toEqual([/* today only */]);
  db.close();
});
```

2. Add:

```ts
it("buckets overdue vs upcoming around local day boundaries", async () => {
  const db = openTestAsyncDb();
  const now = new Date(2026, 8, 5, 12); // 5 Sep 2026 local
  const note = await createNote(db, { body: "Not", nowIso: now.toISOString() });

  const overdue = await createReminder(db, {
    targetType: "note",
    targetId: note.id,
    dueAt: new Date(2026, 8, 4, 23, 59, 59, 999).toISOString(),
    period: "once",
    nowIso: now.toISOString(),
  });
  const today = await createReminder(db, {
    targetType: "note",
    targetId: note.id,
    dueAt: new Date(2026, 8, 5, 0, 0, 0, 0).toISOString(),
    period: "once",
    nowIso: now.toISOString(),
  });
  const tomorrow = await createReminder(db, {
    targetType: "note",
    targetId: note.id,
    dueAt: new Date(2026, 8, 6, 9).toISOString(),
    period: "once",
    nowIso: now.toISOString(),
  });
  const day7 = await createReminder(db, {
    targetType: "note",
    targetId: note.id,
    dueAt: new Date(2026, 8, 12, 23, 59, 59, 999).toISOString(), // today+7 end
    period: "once",
    nowIso: now.toISOString(),
  });
  await createReminder(db, {
    targetType: "note",
    targetId: note.id,
    dueAt: new Date(2026, 8, 13, 0, 0, 0, 0).toISOString(), // day+8 — excluded
    period: "once",
    nowIso: now.toISOString(),
  });

  expect(await listOverdueReminders(db, now)).toEqual([
    expect.objectContaining({ id: overdue.id }),
  ]);
  expect(await listDueRemindersForBugun(db, now)).toEqual([
    expect.objectContaining({ id: today.id }),
  ]);
  expect((await listUpcomingReminders(db, now)).map((r) => r.id)).toEqual([
    tomorrow.id,
    day7.id,
  ]);
  db.close();
});
```

Import `listOverdueReminders`, `listUpcomingReminders`.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/remindersRepo.test.ts`

Expected: FAIL (missing functions / today list still includes overdue)

- [ ] **Step 3: Implement queries**

In `src/db/remindersRepo.ts`, extract shared select + filters into a helper, e.g.:

```ts
async function listRemindersInRange(
  db: AsyncDb,
  dueAtMinExclusiveOrInclusive: { min?: string; minInclusive?: boolean; maxInclusive: string },
): Promise<Array<Reminder & { title: string }>>
```

Or three thin wrappers with clear SQL:

- Overdue: `due_at < startOfLocalDay(now).toISOString()`
- Today: `due_at >= start` AND `due_at <= end`
- Upcoming: `due_at >= startOfLocalDay(tomorrow)` AND `due_at <= endOfLocalDay(today+7)`

Keep the same `CASE` title expression and note/initiative existence filters as current `listDueRemindersForBugun`.

**Important:** After this change, `listDueRemindersForBugun` must **not** return overdue items.

- [ ] **Step 4: Wire AppDb**

Add to `AppDb` + `createAppDb`:

```ts
listOverdueReminders(now: Date): Promise<Array<Reminder & { title: string }>>;
listUpcomingReminders(now: Date): Promise<Array<Reminder & { title: string }>>;
```

Keep `listDueRemindersForBugun`. Add `vi.fn().mockResolvedValue([])` to full AppDb mocks in `final-review-fixes.test.tsx` and `task15-ui.test.tsx`.

- [ ] **Step 5: Run repo + mock-related tests**

Run: `npx vitest run tests/remindersRepo.test.ts tests/final-review-fixes.test.tsx tests/task15-ui.test.tsx`

Expected: PASS

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add src/db/remindersRepo.ts src/db/appDb.ts tests/remindersRepo.test.ts tests/final-review-fixes.test.tsx tests/task15-ui.test.tsx
git commit -m "$(cat <<'EOF'
Split reminder queries into overdue, today, and upcoming buckets.

EOF
)"
```

---

### Task 2: Ticker + Bugün UI three sections

**Files:**
- Modify: `src/hooks/useReminderTicker.ts`
- Modify: `src/views/BugunView.tsx`
- Modify: `tests/task14-ui.test.tsx`
- Create (optional if cleaner): `tests/bugun-reminder-buckets-ui.test.tsx`

**Interfaces:**
- Consumes: the three list methods from Task 1
- `ReminderTicker` produces:

```ts
export type ReminderTicker = {
  completeReminder: (reminder: BugunReminder) => Promise<void>;
  loadFailed: boolean;
  loading: boolean;
  permissionDenied: boolean;
  refresh: () => Promise<void>;
  overdueReminders: BugunReminder[];
  reminders: BugunReminder[]; // today only
  upcomingReminders: BugunReminder[];
};
```

- [ ] **Step 1: Write failing UI tests**

Extend `tests/task14-ui.test.tsx` (or new file) harness `createDb` to include:

```ts
listOverdueReminders: vi.fn().mockResolvedValue([]),
listUpcomingReminders: vi.fn().mockResolvedValue([]),
```

Add test:

```tsx
it("shows overdue, today, and upcoming reminder sections", async () => {
  const overdue = {
    ...dueReminder,
    id: 1,
    title: "Geciken iş",
    dueAt: "2026-09-04T10:00:00.000Z",
  };
  const today = {
    ...dueReminder,
    id: 2,
    title: "Bugünkü iş",
    dueAt: "2026-09-05T10:00:00.000Z",
  };
  const upcoming = {
    ...dueReminder,
    id: 3,
    title: "Yaklaşan iş",
    dueAt: "2026-09-08T10:00:00.000Z",
  };
  const advanceOrCompleteReminder = vi.fn().mockResolvedValue(undefined);
  const listOverdueReminders = vi
    .fn()
    .mockResolvedValueOnce([overdue])
    .mockResolvedValue([]);
  const listDueRemindersForBugun = vi.fn().mockResolvedValue([today]);
  const listUpcomingReminders = vi.fn().mockResolvedValue([upcoming]);

  render(
    <BugunHarness
      db={createDb({
        advanceOrCompleteReminder,
        listOverdueReminders,
        listDueRemindersForBugun,
        listUpcomingReminders,
      })}
      now={() => new Date(2026, 8, 5, 12)}
      notify={vi.fn().mockResolvedValue(true)}
    />,
  );

  expect(await screen.findByRole("heading", { name: "Gecikenler" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Hatırlatmalar" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Yaklaşanlar" })).toBeTruthy();
  expect(screen.getByText("Geciken iş")).toBeTruthy();
  expect(screen.getByText("Bugünkü iş")).toBeTruthy();
  expect(screen.getByText("Yaklaşan iş")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Tamamla: Geciken iş" }));
  await waitFor(() => {
    expect(advanceOrCompleteReminder).toHaveBeenCalled();
    expect(screen.queryByText("Geciken iş")).toBeNull();
  });
});
```

Update existing task14 tests that only mocked `listDueRemindersForBugun` so they also mock the two new methods (empty arrays). Ticker notify tests that expected a single list call may need to expect overdue+today fetches.

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/task14-ui.test.tsx`

Expected: FAIL (missing headings / methods)

- [ ] **Step 3: Update useReminderTicker**

1. Expand `ReminderTickerDb` Pick to include `listOverdueReminders` | `listDueRemindersForBugun` | `listUpcomingReminders`.
2. State: `overdueReminders`, `reminders` (today), `upcomingReminders`.
3. `refresh`:

```ts
const [overdue, today, upcoming] = await Promise.all([
  db.listOverdueReminders(current),
  db.listDueRemindersForBugun(current),
  db.listUpcomingReminders(current),
]);
setOverdueReminders(overdue);
setReminders(today);
setUpcomingReminders(upcoming);

const forNotify = [...overdue, ...today];
// existing notify loop over forNotify (skip future dueAt > now — overdue/today due in future today still skip until due)
```

4. Return the three arrays from the hook.

- [ ] **Step 4: Update BugunView**

Replace single Hatırlatmalar block with three sections in order. Extract a tiny inner helper or map to avoid triple-copy:

```tsx
function ReminderSection({
  headingId,
  title,
  empty,
  loading,
  loadFailed,
  items,
  onComplete,
}: { ... }) { /* existing list markup */ }
```

Wire:

- Gecikenler ← `ticker.overdueReminders`
- Hatırlatmalar ← `ticker.reminders`
- Yaklaşanlar ← `ticker.upcomingReminders`

Reuse `completeReminder` for all. Loading/loadFailed: show once per section or share ticker loading flags (same `loading` / `loadFailed` for all is OK).

- [ ] **Step 5: Fix notify tests in task14 / final-review**

Any test asserting `listDueRemindersForBugun` call counts must also account for `listOverdueReminders` + `listUpcomingReminders` being called each refresh. Prefer asserting notify still fires for overdue+today items.

- [ ] **Step 6: Full suite**

Run: `npm test`

Expected: all PASS

- [ ] **Step 7: Commit (only if user asked)**

```bash
git add src/hooks/useReminderTicker.ts src/views/BugunView.tsx tests/task14-ui.test.tsx tests/bugun-reminder-buckets-ui.test.tsx
git commit -m "$(cat <<'EOF'
Show overdue, today, and upcoming reminders on Bugün.

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Three non-overlapping buckets | Task 1 |
| Turkish titles + empty copy | Task 2 |
| Tamamla refreshes lists | Task 2 |
| Today-only `listDueRemindersForBugun` | Task 1 |
| Notify overdue + today | Task 2 |
| Son notlar unchanged | Task 2 (no edits) |
| Boundary repo tests | Task 1 |
| UI three headings + complete overdue | Task 2 |
