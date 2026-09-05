# Move Untopic Notes to Topics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On person detail, move **Konusuz notlar** into an existing topic via inline select + **Taşı**.

**Architecture:** Expose existing `linkNoteToTopics` on `AppDb`. Extend `LinkedNotes` with optional topic move props. Wire only the untopic section in `PersonDetailView` so topic-card notes stay unchanged. Hide move UI when `topics.length === 0`.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, SQLite via existing repos.

## Global Constraints

- No new dependencies without asking the user.
- Turkish UI copy as specified in the design doc.
- Do not use `window.confirm` (in-app patterns only; this feature has no confirm dialog).
- Commit only when the user explicitly asks (skip commit steps unless requested).
- Spec: `docs/superpowers/specs/2026-09-06-move-untopic-notes-to-topics-design.md`

## File map

| File | Responsibility |
|------|----------------|
| `src/db/notesRepo.ts` | Already has `linkNoteToTopics` — no logic change |
| `src/db/appDb.ts` | Expose `linkNoteToTopics` on `AppDb` / `createAppDb` |
| `src/components/LinkedNotes.tsx` | Optional per-note topic select + Taşı |
| `src/views/PersonDetailView.tsx` | Pass topic options + call `linkNoteToTopics`, reload, expand |
| `src/styles.css` | Compact row for select + Taşı in linked notes |
| `tests/notesRepo.test.ts` | Cover `linkNoteToTopics` |
| `tests/move-untopic-to-topic-ui.test.tsx` | Person detail move / hide UI |
| `tests/final-review-fixes.test.tsx`, `tests/task15-ui.test.tsx` | Add `linkNoteToTopics` mock on full `AppDb` helpers if TypeScript requires it |

---

### Task 1: Expose `linkNoteToTopics` on AppDb

**Files:**
- Modify: `src/db/appDb.ts`
- Modify: `tests/notesRepo.test.ts`
- Modify (if needed): `tests/final-review-fixes.test.tsx`, `tests/task15-ui.test.tsx`

**Interfaces:**
- Consumes: `linkNoteToTopics(db, noteId, topicIds)` from `notesRepo`
- Produces: `AppDb.linkNoteToTopics(noteId: number, topicIds: number[]): Promise<void>`

- [ ] **Step 1: Write the failing repo test**

Append to `tests/notesRepo.test.ts` (imports: `linkNoteToTopics`, `createPerson`, `createTopic` as needed — follow existing patterns in that file / `topicsRepo.test.ts`):

```ts
it("links an untopic note to a topic", async () => {
  const db = openTestAsyncDb();
  const nowIso = "2026-09-06T10:00:00.000Z";
  const person = await createPerson(db, { name: "Ayşe", nowIso });
  const topic = await createTopic(db, {
    personId: person.id,
    title: "1:1",
    nowIso,
  });
  const note = await createNote(db, {
    body: "Konusuz not",
    personIds: [person.id],
    nowIso,
  });

  expect(note.topicIds).toEqual([]);
  await linkNoteToTopics(db, note.id, [topic.id]);

  expect(await getNote(db, note.id)).toEqual(
    expect.objectContaining({
      id: note.id,
      topicIds: [topic.id],
      personIds: [person.id],
    }),
  );
  db.close();
});
```

Ensure imports include `linkNoteToTopics`, `createPerson` (from peopleRepo), `createTopic` (from topicsRepo), `getNote`, `createNote`, `openTestAsyncDb`.

- [ ] **Step 2: Run test to verify it passes against existing repo**

Run: `npx vitest run tests/notesRepo.test.ts`

Expected: PASS (repo already implements `linkNoteToTopics`). If FAIL, fix `notesRepo` only as needed — do not change schema.

- [ ] **Step 3: Wire AppDb**

In `src/db/appDb.ts`:

1. Add `linkNoteToTopics` to the import from `./notesRepo` (alongside `createNote`, `updateNote`, etc.).
2. On `AppDb` type, after `linkNoteToInitiatives`:

```ts
linkNoteToTopics(noteId: number, topicIds: number[]): Promise<void>;
```

3. In `createAppDb`, after `linkNoteToInitiatives`:

```ts
linkNoteToTopics: (noteId, topicIds) =>
  linkNoteToTopics(db, noteId, topicIds),
```

4. In any full `AppDb` test mocks (`final-review-fixes.test.tsx`, `task15-ui.test.tsx`), add:

```ts
linkNoteToTopics: vi.fn(),
```

- [ ] **Step 4: Typecheck / tests**

Run: `npx vitest run tests/notesRepo.test.ts tests/final-review-fixes.test.tsx tests/task15-ui.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add src/db/appDb.ts tests/notesRepo.test.ts tests/final-review-fixes.test.tsx tests/task15-ui.test.tsx
git commit -m "$(cat <<'EOF'
Expose linkNoteToTopics on AppDb for assigning notes to topics.

EOF
)"
```

---

### Task 2: LinkedNotes move UI + PersonDetailView wiring

**Files:**
- Modify: `src/components/LinkedNotes.tsx`
- Modify: `src/views/PersonDetailView.tsx`
- Modify: `src/styles.css`
- Create: `tests/move-untopic-to-topic-ui.test.tsx`

**Interfaces:**
- Consumes: `AppDb.linkNoteToTopics(noteId, topicIds)`
- Produces on `LinkedNotes`:
  - `topicOptions?: { id: number; title: string }[]`
  - `onMoveToTopic?: (noteId: number, topicId: number) => Promise<void>`
- Move controls render only when `topicOptions?.length` and `onMoveToTopic` are both set

- [ ] **Step 1: Write the failing UI tests**

Create `tests/move-untopic-to-topic-ui.test.tsx`:

```tsx
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppDb } from "../src/db/appDb";
import type { Note, Person } from "../src/lib/types";
import type { TopicWithNotes } from "../src/db/topicsRepo";
import PersonDetailView from "../src/views/PersonDetailView";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "tayfun",
  roleOrNotes: null,
  createdAt: "2026-09-06T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const topic: TopicWithNotes = {
  id: 10,
  personId: 1,
  title: "Faruk mentorluk",
  createdAt: "2026-09-06T09:00:00.000Z",
  tags: [],
  notes: [],
};

const untopicNote: Note = {
  id: 20,
  body: "faruk haftaya az calisacagini tayfuna soyledi",
  createdAt: "2026-09-06T10:00:00.000Z",
  updatedAt: "2026-09-06T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [1],
  initiativeIds: [],
  topicIds: [],
};

function baseDb(overrides: Partial<AppDb> = {}) {
  return {
    createNote: vi.fn(),
    createTopic: vi.fn(),
    listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
      topics: [topic],
      untopicNotes: [untopicNote],
    }),
    updateNote: vi.fn(),
    softDeleteNote: vi.fn(),
    updateTopic: vi.fn(),
    updatePerson: vi.fn(),
    listPersonLabels: vi.fn().mockResolvedValue([]),
    createPersonLabel: vi.fn(),
    updatePersonLabel: vi.fn(),
    deletePersonLabel: vi.fn(),
    addTagToTopic: vi.fn(),
    linkTagToTopic: vi.fn(),
    listTopicTags: vi.fn().mockResolvedValue([]),
    updateTopicTag: vi.fn(),
    deleteTopicTag: vi.fn(),
    addTagToNote: vi.fn(),
    linkTagToNote: vi.fn(),
    listNoteTags: vi.fn().mockResolvedValue([]),
    updateNoteTag: vi.fn(),
    deleteNoteTag: vi.fn(),
    linkNoteToTopics: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AppDb;
}

describe("move untopic notes to topics", () => {
  it("moves an untopic note into the selected topic", async () => {
    const linkNoteToTopics = vi.fn().mockResolvedValue(undefined);
    const listTopicsWithNotesForPerson = vi
      .fn()
      .mockResolvedValueOnce({
        topics: [topic],
        untopicNotes: [untopicNote],
      })
      .mockResolvedValue({
        topics: [
          {
            ...topic,
            notes: [{ ...untopicNote, topicIds: [topic.id] }],
          },
        ],
        untopicNotes: [],
      });
    const onToast = vi.fn();

    render(
      <PersonDetailView
        db={baseDb({ linkNoteToTopics, listTopicsWithNotesForPerson })}
        onBack={vi.fn()}
        onToast={onToast}
        person={person}
      />,
    );

    const untopic = await screen.findByRole("list", { name: "Konusuz notlar" });
    const select = within(untopic).getByLabelText("Konuya taşı");
    fireEvent.change(select, { target: { value: String(topic.id) } });
    fireEvent.click(within(untopic).getByRole("button", { name: "Taşı" }));

    await waitFor(() => {
      expect(linkNoteToTopics).toHaveBeenCalledWith(untopicNote.id, [topic.id]);
      expect(onToast).toHaveBeenCalledWith("Nota konu bağlandı");
    });

    expect(screen.queryByRole("list", { name: "Konusuz notlar" })).toBeNull();
    expect(await screen.findByText(untopicNote.body)).toBeTruthy();
  });

  it("hides move controls when the person has no topics", async () => {
    render(
      <PersonDetailView
        db={baseDb({
          listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
            topics: [],
            untopicNotes: [untopicNote],
          }),
        })}
        onBack={vi.fn()}
        person={person}
      />,
    );

    expect(await screen.findByText(untopicNote.body)).toBeTruthy();
    expect(screen.queryByLabelText("Konuya taşı")).toBeNull();
    expect(screen.queryByRole("button", { name: "Taşı" })).toBeNull();
  });

  it("toasts when Taşı is clicked without a topic", async () => {
    const linkNoteToTopics = vi.fn();
    const onToast = vi.fn();

    render(
      <PersonDetailView
        db={baseDb({ linkNoteToTopics })}
        onBack={vi.fn()}
        onToast={onToast}
        person={person}
      />,
    );

    const untopic = await screen.findByRole("list", { name: "Konusuz notlar" });
    fireEvent.click(within(untopic).getByRole("button", { name: "Taşı" }));

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Konu seçin");
    });
    expect(linkNoteToTopics).not.toHaveBeenCalled();
  });
});
```

If `TopicWithNotes` shape differs (extra fields), match `topicsRepo.ts` / existing `task13-ui.test.tsx` fixtures exactly.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/move-untopic-to-topic-ui.test.tsx`

Expected: FAIL (missing `linkNoteToTopics` on view / no “Konuya taşı” control)

- [ ] **Step 3: Extend LinkedNotes**

In `src/components/LinkedNotes.tsx`:

1. Add props:

```ts
topicOptions?: { id: number; title: string }[];
onMoveToTopic?: (noteId: number, topicId: number) => Promise<void>;
```

2. Destructure them; track per-note selection + moving id:

```ts
const [moveTopicByNote, setMoveTopicByNote] = useState<Record<number, string>>(
  {},
);
const [movingId, setMovingId] = useState<number | null>(null);
const canMove = Boolean(topicOptions && topicOptions.length > 0 && onMoveToTopic);
```

3. Inside the non-editing branch, after the meta row (or inside `linked-note-meta` actions), when `canMove`:

```tsx
<div className="linked-note-move">
  <label>
    Konuya taşı
    <select
      onChange={(event) =>
        setMoveTopicByNote((prev) => ({
          ...prev,
          [note.id]: event.target.value,
        }))
      }
      value={moveTopicByNote[note.id] ?? ""}
    >
      <option value="">Konu seç…</option>
      {topicOptions!.map((topic) => (
        <option key={topic.id} value={topic.id}>
          {topic.title}
        </option>
      ))}
    </select>
  </label>
  <button
    disabled={movingId === note.id}
    onClick={() => {
      void (async () => {
        const raw = moveTopicByNote[note.id] ?? "";
        const topicId = Number(raw);
        if (!raw || Number.isNaN(topicId)) {
          onToast("Konu seçin");
          return;
        }
        setMovingId(note.id);
        try {
          await onMoveToTopic?.(note.id, topicId);
        } finally {
          setMovingId(null);
        }
      })();
    }}
    type="button"
  >
    {movingId === note.id ? "Taşınıyor…" : "Taşı"}
  </button>
</div>
```

Keep “Düzenle” as-is. Do not show move UI when `topicOptions` is empty/omitted.

- [ ] **Step 4: Wire PersonDetailView**

1. Add `"linkNoteToTopics"` to `PersonDetailDb` Pick.
2. Add handler:

```ts
const moveNoteToTopic = async (noteId: number, topicId: number) => {
  try {
    await db.linkNoteToTopics(noteId, [topicId]);
    onToast("Nota konu bağlandı");
    setExpandedTopicIds((prev) => new Set(prev).add(topicId));
    await loadDetail();
  } catch {
    onToast("Nota konu bağlanamadı");
  }
};
```

(`loadDetail` is the existing reload callback — use the same function name already in the file.)

3. On the **Konusuz notlar** `LinkedNotes` only:

```tsx
<LinkedNotes
  emptyLabel="Konusuz not yok."
  label="Konusuz notlar"
  loading={false}
  notes={untopicNotes}
  onArchiveNote={archiveNote}
  onUpdateNote={updateNote}
  onMoveToTopic={topics.length > 0 ? moveNoteToTopic : undefined}
  topicOptions={
    topics.length > 0
      ? topics.map((t) => ({ id: t.id, title: t.title }))
      : undefined
  }
  {...noteTagHandlers}
/>
```

Do **not** pass these props to topic-card `LinkedNotes`.

- [ ] **Step 5: Minimal CSS**

Append to `src/styles.css` near `.linked-note-meta`:

```css
.linked-note-move {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: flex-end;
  margin-top: 0.5rem;
}

.linked-note-move label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: #5a6b7d;
  flex: 1 1 12rem;
}

.linked-note-move select {
  padding: 0.35rem 0.5rem;
  border: 1px solid #c9d3df;
  border-radius: 0.45rem;
  background: #ffffff;
}
```

- [ ] **Step 6: Run UI tests**

Run: `npx vitest run tests/move-untopic-to-topic-ui.test.tsx`

Expected: PASS

- [ ] **Step 7: Full suite**

Run: `npm test`

Expected: all tests PASS

- [ ] **Step 8: Commit (only if user asked)**

```bash
git add src/components/LinkedNotes.tsx src/views/PersonDetailView.tsx src/styles.css tests/move-untopic-to-topic-ui.test.tsx
git commit -m "$(cat <<'EOF'
Allow moving untopic person notes into an existing topic.

EOF
)"
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Inline select + Taşı when topics exist | Task 2 |
| Hide move UI when no topics | Task 2 |
| Toast “Konu seçin” if empty | Task 2 |
| `linkNoteToTopics(noteId, [topicId])` | Task 1 + 2 |
| Toast “Nota konu bağlandı”, reload, expand topic | Task 2 |
| Person link unchanged | Task 1 repo assertion |
| No schema change / out of scope items | N/A (not implemented) |
| AppDb expose | Task 1 |
