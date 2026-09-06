# Initiative Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Multi-tag initiatives with a separate `initiative_tags` catalog, chip editor on detail, and AND filter on the initiatives list.

**Architecture:** Mirror `topicTagsRepo` / `TopicTagsEditor`. New `initiativeTagsRepo` + schema tables; hydrate `Initiative.tags` in `initiativesRepo` list/get/create/update; reuse `TopicTagsEditor` on detail; client-side AND filter helper + catalog chips on `InitiativesView`.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, SQLite via existing repos/`AsyncDb`.

## Global Constraints

- No new dependencies without asking the user.
- Turkish UI copy (Etiket ekle…, Tümü, filter empty state).
- Do not use `window.confirm` — `TopicTagsEditor` already uses in-app confirm.
- Commit only when the user explicitly asks (skip commit steps unless requested).
- Spec: `docs/superpowers/specs/2026-09-06-initiative-tags-design.md`
- Catalog must stay separate from `person_labels`, `topic_tags`, and note `tags`.

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/types.ts` | `InitiativeTag`; `Initiative.tags` |
| `src/db/schema.sql` | `initiative_tags`, `initiative_tag_links` for fresh DBs |
| `src/db/initiativeTagsRepo.ts` | Schema ensure + CRUD/link API |
| `src/db/connection.ts` | Call `ensureInitiativeTagsSchema` on connect |
| `src/db/initiativesRepo.ts` | Hydrate `tags` on list/get/create/update/restore |
| `src/db/appDb.ts` | Expose initiative tag methods |
| `src/lib/initiativeTagFilter.ts` | AND match helper for list filter |
| `src/views/InitiativeDetailView.tsx` | Chip editor under details form |
| `src/views/InitiativesView.tsx` | Row chips + catalog multi-filter |
| `src/styles.css` | Compact filter row / list chips if needed |
| `tests/initiativeTagsRepo.test.ts` | Repo behavior |
| `tests/initiativeTagFilter.test.ts` | AND filter helper |
| `tests/initiative-tags-ui.test.tsx` | Detail editor + list filter UI |
| Existing UI tests with full `AppDb` mocks | Add new method stubs when TypeScript requires |

---

### Task 1: Types + `initiativeTagsRepo` + schema

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/db/schema.sql` (after `topic_tag_links` block)
- Create: `src/db/initiativeTagsRepo.ts`
- Modify: `src/db/connection.ts`
- Test: `tests/initiativeTagsRepo.test.ts`

**Interfaces:**
- Produces:
  - `InitiativeTag { id, name, color, createdAt }`
  - `Initiative.tags: InitiativeTag[]` (type-only until Task 2 hydrates)
  - `ensureInitiativeTagsSchema(db)`
  - `listTagsForInitiative(db, initiativeId): Promise<InitiativeTag[]>`
  - `listInitiativeTags(db): Promise<InitiativeTag[]>`
  - `addTagToInitiative(db, initiativeId, input: { name, color, nowIso? }): Promise<InitiativeTag>`
  - `linkTagToInitiative(db, initiativeId, tagId): Promise<InitiativeTag>`
  - `updateInitiativeTag(db, id, patch: { name?, color? }): Promise<InitiativeTag>`
  - `deleteInitiativeTag(db, id): Promise<void>`
  - `removeTagFromInitiative(db, initiativeId, tagId): Promise<void>`

- [ ] **Step 1: Write the failing repo test**

Create `tests/initiativeTagsRepo.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { createInitiative, listInitiatives } from "../src/db/initiativesRepo";
import {
  addTagToInitiative,
  deleteInitiativeTag,
  ensureInitiativeTagsSchema,
  linkTagToInitiative,
  listInitiativeTags,
  listTagsForInitiative,
  removeTagFromInitiative,
  updateInitiativeTag,
} from "../src/db/initiativeTagsRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("initiativeTagsRepo", () => {
  it("adds multiple tags to an initiative and lists them", async () => {
    const db = openTestAsyncDb();
    await ensureInitiativeTagsSchema(db);
    const initiative = await createInitiative(db, {
      name: "Atlas",
      status: "aktif",
      nowIso: "2026-09-06T10:00:00.000Z",
    });

    await addTagToInitiative(db, initiative.id, {
      name: "acil",
      color: "rose",
    });
    await addTagToInitiative(db, initiative.id, {
      name: "q3",
      color: "teal",
    });

    const tags = await listTagsForInitiative(db, initiative.id);
    expect(tags.map((tag) => tag.name)).toEqual(["acil", "q3"]);
    const catalog = await listInitiativeTags(db);
    expect(catalog).toHaveLength(2);
    db.close();
  });

  it("updates and deletes an initiative tag", async () => {
    const db = openTestAsyncDb();
    await ensureInitiativeTagsSchema(db);
    const initiative = await createInitiative(db, {
      name: "Beta",
      status: "aktif",
      nowIso: "2026-09-06T10:00:00.000Z",
    });
    const tag = await addTagToInitiative(db, initiative.id, {
      name: "eski",
      color: "slate",
    });

    const updated = await updateInitiativeTag(db, tag.id, {
      name: "yeni",
      color: "indigo",
    });
    expect(updated).toEqual(
      expect.objectContaining({ name: "yeni", color: "indigo" }),
    );

    await deleteInitiativeTag(db, tag.id);
    expect(await listTagsForInitiative(db, initiative.id)).toEqual([]);
    db.close();
  });

  it("links an existing catalog tag onto another initiative and unlinks", async () => {
    const db = openTestAsyncDb();
    await ensureInitiativeTagsSchema(db);
    const first = await createInitiative(db, {
      name: "Bir",
      status: "aktif",
      nowIso: "2026-09-06T10:00:00.000Z",
    });
    const second = await createInitiative(db, {
      name: "Iki",
      status: "aktif",
      nowIso: "2026-09-06T10:01:00.000Z",
    });
    const tag = await addTagToInitiative(db, first.id, {
      name: "ortak",
      color: "amber",
    });

    await linkTagToInitiative(db, second.id, tag.id);
    expect(
      (await listTagsForInitiative(db, second.id)).map((item) => item.name),
    ).toEqual(["ortak"]);
    expect(await listInitiativeTags(db)).toHaveLength(1);

    await removeTagFromInitiative(db, second.id, tag.id);
    expect(await listTagsForInitiative(db, second.id)).toEqual([]);
    expect(await listTagsForInitiative(db, first.id)).toHaveLength(1);
    db.close();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/initiativeTagsRepo.test.ts`

Expected: FAIL — module `initiativeTagsRepo` / exports missing (or tables missing).

- [ ] **Step 3: Add types**

In `src/lib/types.ts`, after `TopicTag`:

```ts
export interface InitiativeTag {
  id: number;
  name: string;
  color: string;
  createdAt: string;
}
```

On `Initiative`, add:

```ts
  tags: InitiativeTag[];
```

- [ ] **Step 4: Add schema tables**

In `src/db/schema.sql`, immediately after the `topic_tag_links` table:

```sql
CREATE TABLE IF NOT EXISTS initiative_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  color TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS initiative_tag_links (
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  tag_id INTEGER NOT NULL REFERENCES initiative_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (initiative_id, tag_id)
);
```

- [ ] **Step 5: Implement `initiativeTagsRepo.ts`**

Create `src/db/initiativeTagsRepo.ts` by copying `src/db/topicTagsRepo.ts` and renaming:

- Tables: `initiative_tags`, `initiative_tag_links`
- Columns: `initiative_id` instead of `topic_id`
- Types: `InitiativeTag`, `AddInitiativeTagInput`, `UpdateInitiativeTagPatch`
- Functions: `ensureInitiativeTagsSchema`, `listTagsForInitiative`, `listInitiativeTags`, `getInitiativeTag`, `findInitiativeTagByName`, `linkTagToInitiative`, `addTagToInitiative`, `updateInitiativeTag`, `deleteInitiativeTag`, `removeTagFromInitiative`

Keep the same Turkish errors (`Etiket adı boş olamaz`, `Geçersiz renk`, `Etiket bulunamadı`, `Bu isimde etiket var`) and create-or-get + color update behavior as `addTagToTopic`.

- [ ] **Step 6: Wire ensure on connect**

In `src/db/connection.ts`:

```ts
import { ensureInitiativeTagsSchema } from "./initiativeTagsRepo";
```

After `ensureTopicTagsSchema(db)`:

```ts
  await ensureInitiativeTagsSchema(db);
```

- [ ] **Step 7: Temporary `tags: []` on mapInitiative so the repo compiles**

In `src/db/initiativesRepo.ts` `mapInitiative`, add `tags: []` until Task 2 hydrates. Fix any TypeScript errors in tests that construct `Initiative` objects by adding `tags: []`.

- [ ] **Step 8: Run tests to verify they pass**

Run: `npm test -- tests/initiativeTagsRepo.test.ts`

Expected: PASS

- [ ] **Step 9: Commit (only if user asked)**

```bash
git add src/lib/types.ts src/db/schema.sql src/db/initiativeTagsRepo.ts src/db/connection.ts src/db/initiativesRepo.ts tests/initiativeTagsRepo.test.ts
git commit -m "Add initiative tags catalog and link tables."
```

---

### Task 2: Hydrate `Initiative.tags` + AppDb methods

**Files:**
- Modify: `src/db/initiativesRepo.ts`
- Modify: `src/db/appDb.ts`
- Modify: `tests/initiativeTagsRepo.test.ts` (assert list includes tags)
- Modify as needed: UI tests that mock `AppDb` (add stubs for new methods)

**Interfaces:**
- Consumes: `listTagsForInitiative` and tag mutators from Task 1
- Produces:
  - `listInitiatives` / `getInitiative` / `createInitiative` / `updateInitiative` / `restoreInitiative` return `tags`
  - `AppDb.listInitiativeTags(): Promise<InitiativeTag[]>`
  - `AppDb.addTagToInitiative(initiativeId, input): Promise<InitiativeTag>`
  - `AppDb.linkTagToInitiative(initiativeId, tagId): Promise<InitiativeTag>`
  - `AppDb.updateInitiativeTag(id, patch): Promise<InitiativeTag>`
  - `AppDb.deleteInitiativeTag(id): Promise<void>`
  - `AppDb.removeTagFromInitiative(initiativeId, tagId): Promise<void>`

- [ ] **Step 1: Extend repo test for hydration**

Append to `tests/initiativeTagsRepo.test.ts`:

```ts
  it("listInitiatives includes tags on each initiative", async () => {
    const db = openTestAsyncDb();
    await ensureInitiativeTagsSchema(db);
    const initiative = await createInitiative(db, {
      name: "Gamma",
      status: "aktif",
      nowIso: "2026-09-06T11:00:00.000Z",
    });
    await addTagToInitiative(db, initiative.id, {
      name: "platform",
      color: "sky",
    });

    const listed = await listInitiatives(db);
    const row = listed.find((item) => item.id === initiative.id)!;
    expect(row.tags.map((tag) => tag.name)).toEqual(["platform"]);
    db.close();
  });
```

- [ ] **Step 2: Run test — expect FAIL** (tags still `[]` on list)

Run: `npm test -- tests/initiativeTagsRepo.test.ts -t "listInitiatives includes"`

Expected: FAIL — `tags` empty.

- [ ] **Step 3: Hydrate tags in `initiativesRepo.ts`**

```ts
import { listTagsForInitiative } from "./initiativeTagsRepo";
```

Add helper:

```ts
async function withTags(
  db: AsyncDb,
  initiative: Initiative,
): Promise<Initiative> {
  return {
    ...initiative,
    tags: await listTagsForInitiative(db, initiative.id),
  };
}
```

- Keep `mapInitiative` returning `tags: []` as the row mapper.
- After every successful read that returns an `Initiative` or `Initiative[]`, call `withTags`:
  - `getInitiative` (internal): `return row ? withTags(db, mapInitiative(row)) : null`
  - `listInitiatives` / `listArchivedInitiatives`: `Promise.all(rows.map((row) => withTags(db, mapInitiative(row))))`
  - `createInitiative`: after `mapInitiative(...)`, `return withTags(tx, mapped)` (or `{ ...mapped, tags: [] }` since new)
  - `updateInitiative` / `restoreInitiative`: ensure returned value goes through `getInitiative` / `withTags`

- [ ] **Step 4: Wire AppDb**

In `src/db/appDb.ts`:

Import from `./initiativeTagsRepo`:

```ts
  addTagToInitiative,
  deleteInitiativeTag,
  linkTagToInitiative,
  listInitiativeTags,
  removeTagFromInitiative,
  updateInitiativeTag,
  type AddInitiativeTagInput,
  type UpdateInitiativeTagPatch,
```

Import type `InitiativeTag` from types.

On `AppDb` interface (near topic tag methods):

```ts
  addTagToInitiative(
    initiativeId: number,
    input: AddInitiativeTagInput,
  ): Promise<InitiativeTag>;
  linkTagToInitiative(
    initiativeId: number,
    tagId: number,
  ): Promise<InitiativeTag>;
  listInitiativeTags(): Promise<InitiativeTag[]>;
  updateInitiativeTag(
    id: number,
    patch: UpdateInitiativeTagPatch,
  ): Promise<InitiativeTag>;
  deleteInitiativeTag(id: number): Promise<void>;
  removeTagFromInitiative(
    initiativeId: number,
    tagId: number,
  ): Promise<void>;
```

In `createAppDb`:

```ts
    addTagToInitiative: (initiativeId, input) =>
      addTagToInitiative(db, initiativeId, input),
    linkTagToInitiative: (initiativeId, tagId) =>
      linkTagToInitiative(db, initiativeId, tagId),
    listInitiativeTags: () => listInitiativeTags(db),
    updateInitiativeTag: (id, patch) => updateInitiativeTag(db, id, patch),
    deleteInitiativeTag: (id) => deleteInitiativeTag(db, id),
    removeTagFromInitiative: (initiativeId, tagId) =>
      removeTagFromInitiative(db, initiativeId, tagId),
```

- [ ] **Step 5: Fix AppDb mocks in UI tests**

Grep for `addTagToTopic: vi.fn()` and add alongside (where a full `AppDb` object is required):

```ts
addTagToInitiative: vi.fn(),
linkTagToInitiative: vi.fn(),
listInitiativeTags: vi.fn(async () => []),
updateInitiativeTag: vi.fn(),
deleteInitiativeTag: vi.fn(),
removeTagFromInitiative: vi.fn(),
```

Also add `tags: []` (or realistic tags) anywhere tests construct bare `Initiative` literals.

- [ ] **Step 6: Run targeted + typecheck-sensitive tests**

Run: `npm test -- tests/initiativeTagsRepo.test.ts`

Expected: PASS

Run: `npm test` if time allows, or at least files that failed typecheck when mocks were incomplete.

- [ ] **Step 7: Commit (only if user asked)**

```bash
git add src/db/initiativesRepo.ts src/db/appDb.ts tests/initiativeTagsRepo.test.ts tests/
git commit -m "Hydrate initiative tags on list and expose AppDb APIs."
```

---

### Task 3: Initiative detail chip editor

**Files:**
- Modify: `src/views/InitiativeDetailView.tsx`
- Test: `tests/initiative-tags-ui.test.tsx` (create; detail cases first)

**Interfaces:**
- Consumes: AppDb tag methods from Task 2; `TopicTagsEditor`
- Produces: Editable tags under the details form

- [ ] **Step 1: Write failing UI test (detail)**

Create `tests/initiative-tags-ui.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import InitiativeDetailView from "../src/views/InitiativeDetailView";
import type { Initiative, InitiativeTag } from "../src/lib/types";

afterEach(() => {
  cleanup();
});

const baseInitiative: Initiative = {
  id: 1,
  name: "Atlas",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-06T10:00:00.000Z",
  lastActivityAt: "2026-09-06T10:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
  tags: [],
};

describe("initiative tags UI", () => {
  it("adds a tag on initiative detail", async () => {
    const created: InitiativeTag = {
      id: 9,
      name: "acil",
      color: "rose",
      createdAt: "2026-09-06T10:05:00.000Z",
    };
    const addTagToInitiative = vi.fn(async () => created);
    const listInitiativeTags = vi.fn(async () => [] as InitiativeTag[]);

    render(
      <InitiativeDetailView
        db={
          {
            listNotesForInitiative: vi.fn(async () => []),
            listTopicsWithNotesForInitiative: vi.fn(async () => ({
              topics: [],
              untopicNotes: [],
            })),
            listNoteTags: vi.fn(async () => []),
            listTopicTags: vi.fn(async () => []),
            listInitiativeTags,
            addTagToInitiative,
            linkTagToInitiative: vi.fn(),
            updateInitiativeTag: vi.fn(),
            deleteInitiativeTag: vi.fn(),
            removeTagFromInitiative: vi.fn(),
            updateInitiative: vi.fn(async () => ({
              ...baseInitiative,
              tags: [created],
            })),
            createReminder: vi.fn(),
            createNote: vi.fn(),
            createTopic: vi.fn(),
            updateNote: vi.fn(),
            softDeleteNote: vi.fn(),
            addTagToNote: vi.fn(),
            linkTagToNote: vi.fn(),
            updateNoteTag: vi.fn(),
            deleteNoteTag: vi.fn(),
            addTagToTopic: vi.fn(),
            linkTagToTopic: vi.fn(),
            updateTopicTag: vi.fn(),
            deleteTopicTag: vi.fn(),
            linkNoteToTopics: vi.fn(),
          } as never
        }
        initiative={baseInitiative}
        onBack={() => undefined}
        onToast={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(listInitiativeTags).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText("Etiket ekle…"), {
      target: { value: "acil" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));

    await waitFor(() => {
      expect(addTagToInitiative).toHaveBeenCalledWith(1, {
        name: "acil",
        color: expect.any(String),
      });
    });
  });
});
```

Adjust the `db` mock to match whatever `InitiativeDetailView` already requires (copy from `tests/final-review-fixes.test.tsx` / `tests/initiative-note-tags-ui.test.tsx` and add the initiative-tag methods). If the placeholder text differs when multiple editors exist on the page (topic tags), scope with a heading/label or `colorInputName` unique query — prefer `getAllByPlaceholderText` and pick the initiative editor, or add `aria-label="İş etiketi ekle"` only if needed for disambiguation.

- [ ] **Step 2: Run test — expect FAIL**

Run: `npm test -- tests/initiative-tags-ui.test.tsx`

Expected: FAIL — no initiative tag editor / `listInitiativeTags` unused.

- [ ] **Step 3: Wire detail UI**

In `InitiativeDetailView.tsx`:

1. Extend `InitiativeDetailDb` Pick with:
   - `listInitiativeTags`, `addTagToInitiative`, `linkTagToInitiative`, `updateInitiativeTag`, `deleteInitiativeTag`, `removeTagFromInitiative`
2. State: `initiativeTagCatalog` loaded with `db.listInitiativeTags()` in the existing load effect (or parallel with topic/note catalogs).
3. After the details `<div className="entity-form">…</div>` (before `ReminderForm`), render:

```tsx
      <div className="person-label-editor">
        <p className="person-label-picker__title">Etiketler</p>
        <TopicTagsEditor
          catalog={initiativeTagCatalog}
          colorInputName="initiative-tag-color"
          onAdd={async (name, color) => {
            await db.addTagToInitiative(current.id, { name, color });
            await load();
          }}
          onLinkExisting={async (tagId) => {
            await db.linkTagToInitiative(current.id, tagId);
            await load();
          }}
          onUpdate={async (tagId, patch) => {
            await db.updateInitiativeTag(tagId, patch);
            await load();
          }}
          onDelete={async (tagId) => {
            await db.deleteInitiativeTag(tagId);
            await load();
          }}
          onToast={onToast}
          tags={current.tags}
        />
      </div>
```

4. Ensure `load()` / `onInitiativeUpdated` paths keep `current.tags` from `updateInitiative` or by reloading list — if detail only uses local `current` from props + `updateInitiative`, after tag mutations call a reload that sets `current` from a fresh `listInitiatives` find **or** re-fetch tags via updating local state:

Simplest reliable approach after each tag mutation:

```ts
const tags = await list from initiative — prefer:
const refreshed = (await /* if no getInitiative on AppDb */)
```

Since AppDb may not expose `getInitiative`, after tag ops:

```ts
const listed = await db.listInitiatives(); // only if on AppDb Pick
```

Better: extend Pick with nothing extra — after `addTagToInitiative` returns the tag, set local state:

```ts
setCurrent((prev) => ({
  ...prev,
  tags: /* merge returned tag into prev.tags unique by id */,
}));
```

And refresh catalog: `setInitiativeTagCatalog(await db.listInitiativeTags())`.

Or add `listInitiatives` to the detail db pick solely for reload. Prefer: after mutation, `onInitiativeUpdated` if parent holds selection — check `App.tsx`. If parent passes `selectedInitiative`, call `onInitiativeUpdated` with `{ ...current, tags: nextTags }` after reconstructing tags from `add`/`delete`/`listTags` pattern.

Practical minimal approach used elsewhere for topics: `await load()` where `load` reloads topics/notes. Extend `load` to also:

```ts
const catalog = await db.listInitiativeTags();
setInitiativeTagCatalog(catalog);
```

And for initiative tags on `current`, either:
- Parent refreshes selected initiative from `listInitiatives` after toast callbacks, **or**
- Detail keeps `tags` in local state initialized from `initiative.tags` and updates after each mutation.

Implement local `tags` state synced from `initiative.tags` via effect, update after mutations, and pass `tags={tags}` to the editor. When `updateInitiative` saves details, merge returned initiative (includes tags).

- [ ] **Step 4: Run UI test — expect PASS**

Run: `npm test -- tests/initiative-tags-ui.test.tsx`

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add src/views/InitiativeDetailView.tsx tests/initiative-tags-ui.test.tsx
git commit -m "Add initiative tag editor on detail view."
```

---

### Task 4: List chips + AND filter

**Files:**
- Create: `src/lib/initiativeTagFilter.ts`
- Test: `tests/initiativeTagFilter.test.ts`
- Modify: `src/views/InitiativesView.tsx`
- Modify: `src/styles.css` (minimal filter toolbar)
- Modify: `tests/initiative-tags-ui.test.tsx` (list cases)

**Interfaces:**
- Produces: `initiativeMatchesTagFilter(initiative, selectedTagIds): boolean`
- Consumes: `listInitiatives` with `tags`; `listInitiativeTags` on list view

- [ ] **Step 1: Write filter unit tests**

Create `tests/initiativeTagFilter.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { initiativeMatchesTagFilter } from "../src/lib/initiativeTagFilter";

describe("initiativeMatchesTagFilter", () => {
  const initiative = {
    tags: [
      { id: 1, name: "acil" },
      { id: 2, name: "q3" },
    ],
  };

  it("matches all when no filter selected", () => {
    expect(initiativeMatchesTagFilter(initiative, [])).toBe(true);
  });

  it("requires all selected tags (AND)", () => {
    expect(initiativeMatchesTagFilter(initiative, [1])).toBe(true);
    expect(initiativeMatchesTagFilter(initiative, [1, 2])).toBe(true);
    expect(initiativeMatchesTagFilter(initiative, [1, 3])).toBe(false);
    expect(initiativeMatchesTagFilter(initiative, [3])).toBe(false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**, then implement:

Create `src/lib/initiativeTagFilter.ts`:

```ts
export function initiativeMatchesTagFilter(
  initiative: { tags: Array<{ id: number }> },
  selectedTagIds: number[],
): boolean {
  if (selectedTagIds.length === 0) {
    return true;
  }
  const owned = new Set(initiative.tags.map((tag) => tag.id));
  return selectedTagIds.every((id) => owned.has(id));
}
```

Run: `npm test -- tests/initiativeTagFilter.test.ts` — Expected: PASS

- [ ] **Step 3: Write failing list UI test**

Append to `tests/initiative-tags-ui.test.tsx`:

```tsx
import InitiativesView from "../src/views/InitiativesView";

  it("filters initiatives list by selected tags with AND", async () => {
    const initiatives: Initiative[] = [
      {
        ...baseInitiative,
        id: 1,
        name: "Sadece acil",
        tags: [
          {
            id: 1,
            name: "acil",
            color: "rose",
            createdAt: "2026-09-06T10:00:00.000Z",
          },
        ],
      },
      {
        ...baseInitiative,
        id: 2,
        name: "Acil ve q3",
        tags: [
          {
            id: 1,
            name: "acil",
            color: "rose",
            createdAt: "2026-09-06T10:00:00.000Z",
          },
          {
            id: 2,
            name: "q3",
            color: "teal",
            createdAt: "2026-09-06T10:00:00.000Z",
          },
        ],
      },
    ];

    render(
      <InitiativesView
        db={
          {
            listInitiatives: vi.fn(async () => initiatives),
            listInitiativeTags: vi.fn(async () => [
              {
                id: 1,
                name: "acil",
                color: "rose",
                createdAt: "2026-09-06T10:00:00.000Z",
              },
              {
                id: 2,
                name: "q3",
                color: "teal",
                createdAt: "2026-09-06T10:00:00.000Z",
              },
            ]),
            createInitiative: vi.fn(),
            createNote: vi.fn(),
            reorderInitiatives: vi.fn(),
            archiveInitiative: vi.fn(),
          } as never
        }
      />,
    );

    await screen.findByRole("button", { name: "Sadece acil" });

    fireEvent.click(screen.getByRole("button", { name: "acil" }));
    fireEvent.click(screen.getByRole("button", { name: "q3" }));

    expect(screen.queryByRole("button", { name: "Sadece acil" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Acil ve q3" }),
    ).toBeInTheDocument();
  });
```

Note: filter chip buttons must be distinguishable from row open buttons — use `aria-pressed` filter chips labeled by tag name in a `group` with `aria-label="Etiket filtresi"`, and query within that group:

```tsx
const filter = screen.getByRole("group", { name: "Etiket filtresi" });
fireEvent.click(within(filter).getByRole("button", { name: "acil" }));
```

Update the test accordingly. Include a **Tümü** button that clears selection.

- [ ] **Step 4: Run list UI test — expect FAIL**

- [ ] **Step 5: Implement list UI**

In `InitiativesView.tsx`:

1. Extend db Pick: `listInitiativeTags`
2. State: `catalog`, `selectedTagIds: number[]`
3. Load catalog in `loadInitiatives` or parallel effect
4. `const visible = initiatives.filter((item) => initiativeMatchesTagFilter(item, selectedTagIds))`
5. Above `<h2>İş listesi</h2>` (or between header and list):

```tsx
      {catalog.length > 0 ? (
        <div
          className="initiative-tag-filter"
          role="group"
          aria-label="Etiket filtresi"
        >
          <button
            aria-pressed={selectedTagIds.length === 0}
            onClick={() => setSelectedTagIds([])}
            type="button"
          >
            Tümü
          </button>
          {catalog.map((tag) => {
            const pressed = selectedTagIds.includes(tag.id);
            return (
              <button
                aria-pressed={pressed}
                className={`person-label-chip person-label--${tag.color}${
                  pressed ? " person-label-chip--selected" : ""
                }`}
                key={tag.id}
                onClick={() => {
                  setSelectedTagIds((prev) =>
                    prev.includes(tag.id)
                      ? prev.filter((id) => id !== tag.id)
                      : [...prev, tag.id],
                  );
                }}
                type="button"
              >
                {tag.name}
              </button>
            );
          })}
        </div>
      ) : null}
```

6. On each row, under the heading (inside the open button or beside it), show read-only badges:

```tsx
                {initiative.tags.length > 0 ? (
                  <span className="initiative-list__tags">
                    {initiative.tags.map((tag) => (
                      <span
                        className={`person-label-badge person-label--${tag.color}`}
                        key={tag.id}
                      >
                        {tag.name}
                      </span>
                    ))}
                  </span>
                ) : null}
```

7. Empty states:
   - `initiatives.length === 0` → existing “Henüz iş yok.”
   - `initiatives.length > 0 && visible.length === 0` → “Bu etiketlere uyan iş yok.”
   - Else render `visible.map(...)`

8. CSS in `src/styles.css`:

```css
.initiative-tag-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
  margin: 0 0 1rem;
}

.initiative-list__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.35rem;
}
```

- [ ] **Step 6: Run UI + filter tests**

Run: `npm test -- tests/initiativeTagFilter.test.ts tests/initiative-tags-ui.test.tsx`

Expected: PASS

Run: `npm test`

Expected: PASS (fix any remaining `Initiative` / AppDb mock gaps)

- [ ] **Step 7: Commit (only if user asked)**

```bash
git add src/lib/initiativeTagFilter.ts src/views/InitiativesView.tsx src/styles.css tests/initiativeTagFilter.test.ts tests/initiative-tags-ui.test.tsx
git commit -m "Show initiative tag chips and AND filter on list."
```

---

## Spec coverage self-review

| Spec item | Task |
|-----------|------|
| `initiative_tags` / `initiative_tag_links` + migration | Task 1 |
| `Initiative.tags` | Tasks 1–2 |
| `listInitiativeTags`, add/update/delete/remove APIs | Tasks 1–2 |
| Tags on `listInitiatives` / get paths | Task 2 |
| Detail chip editor (TopicTagsEditor pattern) | Task 3 |
| List read-only chips | Task 4 |
| Multi-select AND filter + Tümü + empty state | Task 4 |
| Out of scope (shared catalogs, SQL filter, OR) | Not implemented |

## Placeholder / consistency check

- Names aligned: `addTagToInitiative`, `listInitiativeTags`, `InitiativeTag`, AND helper `initiativeMatchesTagFilter`.
- No TBD / “similar to Task N” without concrete code.
- Commits gated on user request per repo preference.
