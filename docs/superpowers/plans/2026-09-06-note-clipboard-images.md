# Note Clipboard Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Paste clipboard images into note bodies; store binaries in `note_images` and render markers as images when viewing.

**Architecture:** SQLite `note_images` table + body markers `![görsel](dlt-img:<uuid>)`. Shared `NoteBodyField` (paste) and `NoteBodyView` (render). Wire all note editors/views; no new dependencies.

**Tech Stack:** React + TypeScript, Vitest, SQLite via AppDb.

## Global Constraints

- No new dependencies without asking.
- Turkish copy: marker alt `görsel`; toast `Görsel çok büyük`.
- Max image size 5 MB.
- MIME: `image/png`, `image/jpeg`, `image/webp`, `image/gif`.
- Spec: `docs/superpowers/specs/2026-09-06-note-clipboard-images-design.md`
- Commit + push when feature complete (user intent: proceed).

## File map

| File | Responsibility |
|------|----------------|
| `src/db/schema.sql` | `note_images` table |
| `src/db/noteImagesRepo.ts` | save/get + ensure table |
| `src/db/connection.ts` | call ensure on open |
| `src/db/appDb.ts` | expose API |
| `src/lib/noteImages.ts` | marker helpers, size/mime constants, insert-at-cursor |
| `src/components/NoteBodyField.tsx` | textarea + paste |
| `src/components/NoteBodyView.tsx` | read-only render |
| `src/styles.css` | preview / img styles |
| Note editors/views | replace textarea / plain body display |
| Tests | repo + field + view |

---

### Task 1: `note_images` repo + AppDb

**Files:**
- Modify: `src/db/schema.sql`
- Create: `src/db/noteImagesRepo.ts`
- Modify: `src/db/connection.ts`
- Modify: `src/db/appDb.ts`
- Create: `tests/noteImagesRepo.test.ts`

**Interfaces:**
- Produces:
  - `saveNoteImage(db, { id, mime, bytesBase64, nowIso })`
  - `getNoteImage(db, id) → { mime, bytesBase64 } | null`
  - `ensureNoteImagesTable(db)`
  - `AppDb.saveNoteImage` / `AppDb.getNoteImage`

- [ ] **Step 1: Failing repo tests**

```ts
it("saves and loads a note image", async () => {
  const db = openTestAsyncDb();
  await ensureNoteImagesTable(db);
  const id = "11111111-1111-1111-1111-111111111111";
  await saveNoteImage(db, {
    id,
    mime: "image/png",
    bytesBase64: "aGVsbG8=",
    nowIso: "2026-09-06T10:00:00.000Z",
  });
  expect(await getNoteImage(db, id)).toEqual({
    mime: "image/png",
    bytesBase64: "aGVsbG8=",
  });
  db.close();
});

it("returns null for missing id", async () => {
  const db = openTestAsyncDb();
  await ensureNoteImagesTable(db);
  expect(await getNoteImage(db, "missing")).toBeNull();
  db.close();
});
```

- [ ] **Step 2: Implement schema + repo + wire AppDb/connection**

`schema.sql`:

```sql
CREATE TABLE IF NOT EXISTS note_images (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  bytes_base64 TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

`ensureNoteImagesTable`: `CREATE TABLE IF NOT EXISTS` (same DDL) for existing DBs.

- [ ] **Step 3: Tests pass** — `npx vitest run tests/noteImagesRepo.test.ts`

---

### Task 2: Marker helpers + NoteBodyField + NoteBodyView

**Files:**
- Create: `src/lib/noteImages.ts`
- Create: `src/components/NoteBodyField.tsx`
- Create: `src/components/NoteBodyView.tsx`
- Modify: `src/styles.css`
- Create: `tests/noteImages.test.ts`
- Create: `tests/note-body-images-ui.test.tsx`

**Interfaces:**
- Consumes: `saveNoteImage`, `getNoteImage`
- Produces:
  - `NOTE_IMAGE_MARKER_RE`, `formatNoteImageMarker(id)`, `insertAtCursor(body, start, end, text)`, `MAX_NOTE_IMAGE_BYTES`, `isAllowedNoteImageMime`
  - `NoteBodyField` props: `value`, `onChange`, `saveNoteImage`, `onToast`, textarea attrs
  - `NoteBodyView` props: `body`, `getNoteImage`

- [ ] **Step 1: Unit tests for helpers + UI tests for paste/view**

Helper: insert marker at selection.  
UI: mock clipboard `DataTransfer` with image file → expect `saveNoteImage` + marker in value.  
Oversized → toast.  
`NoteBodyView` with body containing marker → img with data URL (mock getNoteImage).

- [ ] **Step 2: Implement helpers + components**

Paste logic sketch:

```ts
const item = [...event.clipboardData.items].find(
  (i) => i.kind === "file" && isAllowedNoteImageMime(i.type),
);
if (!item) return;
event.preventDefault();
const file = item.getAsFile();
// size check, FileReader readAsDataURL → strip prefix → saveNoteImage → insert marker
```

`NoteBodyView`: split body by `NOTE_IMAGE_MARKER_RE`; text nodes as `<span className="note-body-view__text">` with `white-space: pre-wrap`; images load async into state map.

- [ ] **Step 3: Focused tests pass**

---

### Task 3: Wire note editors and viewers

**Files (note surfaces only):**
- `src/components/NoteEditor.tsx`
- `src/components/LinkedNotes.tsx`
- `src/components/QuickNoteModal.tsx`
- `src/views/InboxView.tsx`
- `src/views/PersonDetailView.tsx` (topic note form + LinkedNotes display paths)
- `src/views/InitiativeDetailView.tsx`
- `src/views/BugunView.tsx` (recent note body)
- `src/views/ArchiveView.tsx` / `NotesView` / `SearchView` if they render note body
- Pass `saveNoteImage` / `getNoteImage` / `onToast` from parents that have `db`

**Do not change:** `PersonForm`, `InitiativeForm` blocker/role textareas.

- [ ] **Step 1: Replace note `<textarea>` with `NoteBodyField`; replace plain `{note.body}` displays with `NoteBodyView` where notes are shown.**
- [ ] **Step 2: Fix test mocks** that construct note editors / AppDb to include `saveNoteImage` / `getNoteImage` stubs.
- [ ] **Step 3: `npm test` all green**

---

### Task 4: Commit + push

```bash
git add ...
git commit -m "$(cat <<'EOF'
Paste clipboard images into note bodies.

Store binaries in note_images and render dlt-img markers when viewing notes.
EOF
)"
git push -u origin HEAD
```

---

## Spec coverage

| Requirement | Task |
|-------------|------|
| note_images table + save/get | 1 |
| Paste → marker + save | 2 |
| 5 MB / MIME / toast | 2 |
| View render | 2 |
| All note editors | 3 |
| Exclude non-note fields | 3 |
| No new deps | all |
