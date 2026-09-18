# Promote Topic to Initiative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Right-click an initiative topic → **İşe çevir** → create a new initiative (topic stays put) with two trail notes and open the new initiative.

**Architecture:** Add a repo helper `promoteTopicToInitiative` that creates the initiative and two notes in one flow. Wire Initiative detail context menu + ConfirmDialog; App passes `onSelectInitiative` so the detail view can navigate to the new iş.

**Tech Stack:** React + TypeScript, Vitest + Testing Library, SQLite via existing repos (`createInitiative`, `createNote`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-09-18-promote-topic-to-initiative-design.md`
- Turkish copy exactly as in the spec (menu, dialog, note bodies, toast **İş oluşturuldu**).
- Topic stays on the original initiative; existing topic notes untouched.
- Duplicate initiative name → existing `"Bu isimde kayıt var"` (surface via toast).
- Person-detail topics: out of scope (no menu there).
- No new dependencies without asking.
- Commit only when the user explicitly asks (skip commit steps unless requested).

## File map

| File | Responsibility |
|------|----------------|
| `src/db/topicsRepo.ts` (or small new helper next to it) | `promoteTopicToInitiative` |
| `src/db/appDb.ts` | Expose helper on `AppDb` |
| `src/views/InitiativeDetailView.tsx` | Context menu, confirm, call helper, navigate |
| `src/App.tsx` | Pass `onSelectInitiative={openInitiative}` into detail |
| `tests/promote-topic-to-initiative.test.ts` | Repo behavior |
| `tests/promote-topic-to-initiative-ui.test.tsx` | Detail UI flow |

---

### Task 1: Repo `promoteTopicToInitiative`

**Files:**
- Modify: `src/db/topicsRepo.ts` (preferred home) — add `promoteTopicToInitiative`
- Modify: `src/db/appDb.ts` — wire method
- Create: `tests/promote-topic-to-initiative.test.ts`

**Interfaces:**
- Consumes: `createInitiative`, `createNote`, topic row lookup (`listTopicsForInitiative` / select by id)
- Produces:
  ```ts
  export async function promoteTopicToInitiative(
    db: AsyncDb,
    topicId: number,
    nowIso: string,
  ): Promise<Initiative>;
  ```
  - Loads topic; if missing → `"Konu bulunamadı"`
  - If `topic.initiativeId == null` → `"Bu konu bir işe ait değil"` (person topics blocked)
  - Creates initiative with `name: topic.title`, `status: "aktif"`, `nowIso` (via `createInitiative`)
  - Creates note A: body ``Bu konu “${initiative.name}” işine taşınmıştır.`` with `initiativeIds: [topic.initiativeId]`, `topicIds: [topic.id]`
  - Creates note B: body ``“${topic.title}” konusundan taşınmıştır.`` with `initiativeIds: [newInitiative.id]` (no topicIds)
  - Does **not** change `topics.initiative_id`
  - Does **not** modify existing notes on the topic
  - Returns the new `Initiative`
  - Prefer wrapping the whole operation in `db.withTransaction` so a failed second note does not leave a half-done promote (if nested `createInitiative`/`createNote` transactions are awkward with the current queue, still call them sequentially and document; prefer true atomicity when possible)

- [ ] **Step 1: Write failing repo tests**

```ts
// tests/promote-topic-to-initiative.test.ts
import { describe, expect, it } from "vitest";
import { createInitiative } from "../src/db/initiativesRepo";
import { createNote, listNotesForInitiative } from "../src/db/notesRepo";
import {
  createTopic,
  listTopicsWithNotesForInitiative,
  promoteTopicToInitiative,
} from "../src/db/topicsRepo";
import { openTestAsyncDb } from "./helpers"; // use the same open helper as other repo tests (e.g. openTestAsyncDb from topicsRepo.test.ts)

describe("promoteTopicToInitiative", () => {
  it("creates a new initiative and two trail notes without moving the topic", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-18T10:00:00.000Z";
    const parent = await createInitiative(db, {
      name: "Ana İş",
      status: "aktif",
      nowIso,
    });
    const topic = await createTopic(db, {
      initiativeId: parent.id,
      title: "Alt Konu",
      nowIso,
    });
    const existing = await createNote(db, {
      body: "Eski not",
      initiativeIds: [parent.id],
      topicIds: [topic.id],
      nowIso,
    });

    const created = await promoteTopicToInitiative(db, topic.id, nowIso);

    expect(created.name).toBe("Alt Konu");
    expect(created.id).not.toBe(parent.id);

    const topics = await listTopicsWithNotesForInitiative(db, parent.id);
    const stillThere = topics.find((t) => t.id === topic.id);
    expect(stillThere).toBeTruthy();
    expect(stillThere!.notes.map((n) => n.id)).toContain(existing.id);
    expect(
      stillThere!.notes.some((n) =>
        n.body.includes("işine taşınmıştır"),
      ),
    ).toBe(true);

    const newInitiativeNotes = await listNotesForInitiative(db, created.id);
    expect(
      newInitiativeNotes.some((n) =>
        n.body.includes("konusundan taşınmıştır"),
      ),
    ).toBe(true);
    expect(newInitiativeNotes.every((n) => n.topicIds.length === 0)).toBe(true);

    db.close();
  });

  it("rejects person-owned topics", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-18T10:00:00.000Z";
    // createPerson + createTopic({ personId }) following topicsRepo.test.ts
    // expect promoteTopicToInitiative(...).rejects.toThrow("Bu konu bir işe ait değil")
    db.close();
  });

  it("rejects duplicate initiative names", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-18T10:00:00.000Z";
    await createInitiative(db, { name: "Çakışan", status: "aktif", nowIso });
    const parent = await createInitiative(db, {
      name: "Ana",
      status: "aktif",
      nowIso,
    });
    const topic = await createTopic(db, {
      initiativeId: parent.id,
      title: "Çakışan",
      nowIso,
    });
    await expect(
      promoteTopicToInitiative(db, topic.id, nowIso),
    ).rejects.toThrow("Bu isimde kayıt var");
    db.close();
  });
});
```

Fill the person-owned test using the exact `createPerson` / `createTopic` pattern from `tests/topicsRepo.test.ts`. Import `openTestAsyncDb` the same way that file does (do not invent a helper path).

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npm test -- tests/promote-topic-to-initiative.test.ts`

Expected: FAIL — `promoteTopicToInitiative` missing.

- [ ] **Step 3: Implement helper + AppDb**

In `topicsRepo.ts`, implement `promoteTopicToInitiative` as specified. Export types as needed.

In `appDb.ts`:

```ts
promoteTopicToInitiative: (topicId, nowIso) =>
  promoteTopicToInitiative(db, topicId, nowIso),
```

Add to the `AppDb` interface.

Exact note bodies (use curly quotes `“”` as in the spec):

```ts
const topicTrail = `Bu konu “${created.name}” işine taşınmıştır.`;
const initiativeTrail = `“${topic.title}” konusundan taşınmıştır.`;
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- tests/promote-topic-to-initiative.test.ts tests/topicsRepo.test.ts`

- [ ] **Step 5: Commit** (only if user asked)

---

### Task 2: Initiative detail UI + navigate

**Files:**
- Modify: `src/views/InitiativeDetailView.tsx`
- Modify: `src/App.tsx` — `onSelectInitiative={openInitiative}`
- Create: `tests/promote-topic-to-initiative-ui.test.tsx`
- Reuse: `src/components/ConfirmDialog.tsx`, existing `person-label-menu` CSS for the floating menu (same as People/Initiatives list menus)

**Interfaces:**
- Consumes: `db.promoteTopicToInitiative`, `ConfirmDialog`, `onSelectInitiative?: (initiative: Initiative) => void`
- Produces: topic context menu **İşe çevir**

**UI details:**
- State: `topicMenu: { topicId, x, y } | null`, `topicToPromote: TopicWithNotes | null`
- `onContextMenu` on the topic card (header / article) → preventDefault, set menu
- Menu button **İşe çevir** → close menu, set `topicToPromote`
- ConfirmDialog title **İşe çevir**, message with topic title, confirmLabel **İşe çevir**
- On confirm: `await db.promoteTopicToInitiative(id, new Date().toISOString())` → toast **İş oluşturuldu** → `onSelectInitiative(created)` → clear dialog; on error toast `formatError`
- Click-outside / Escape closes menu (follow PeopleView / InitiativesView menu pattern already in the codebase)

- [ ] **Step 1: Write failing UI test**

```tsx
// @vitest-environment jsdom
// Mock db.listTopicsWithNotesForInitiative to return one topic
// Render InitiativeDetailView with onSelectInitiative + onToast
// contextMenu on topic → click İşe çevir → confirm dialog → confirm
// expect promoteTopicToInitiative called; onSelectInitiative called with returned initiative; onToast("İş oluşturuldu")
```

Follow patterns in `tests/move-untopic-to-topic-ui.test.tsx` / initiative detail tests for db mocks. Add `promoteTopicToInitiative` to the Pick type on `InitiativeDetailDb`.

- [ ] **Step 2: Run UI test — expect FAIL**

Run: `npm test -- tests/promote-topic-to-initiative-ui.test.tsx`

- [ ] **Step 3: Implement UI + App wiring**

Add `createInitiative` is **not** required on the view if promote helper encapsulates it — only `promoteTopicToInitiative`.

Wire App:

```tsx
<InitiativeDetailView
  ...
  onSelectInitiative={openInitiative}
/>
```

- [ ] **Step 4: Run tests — expect PASS**

Run:

```bash
npm test -- tests/promote-topic-to-initiative.test.ts tests/promote-topic-to-initiative-ui.test.tsx
```

- [ ] **Step 5: Commit** (only if user asked)

---

## Spec coverage checklist

| Spec item | Task |
|-----------|------|
| Right-click **İşe çevir** on initiative topic | Task 2 |
| Confirm dialog copy | Task 2 |
| New initiative named after topic | Task 1 |
| Topic stays on original initiative | Task 1 |
| Existing notes untouched | Task 1 |
| Topic trail note + initiative trail note | Task 1 |
| Toast + open new initiative | Task 2 |
| Person topics out of scope | Task 1 reject + Task 2 only on initiative detail |
| Duplicate name error | Task 1 |
