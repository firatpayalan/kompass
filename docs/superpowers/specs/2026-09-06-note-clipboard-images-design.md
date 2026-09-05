# Note embedded images (clipboard paste) — design

## Goal

Users can paste images from the clipboard into note bodies. Images are embedded in the note content (marker in `body` + binary stored separately) and shown when viewing notes.

## Behavior

- **Paste only** (Cmd/Ctrl+V). No file picker or drag-and-drop in v1.
- Applies to **all note editors** (create + edit): `NoteEditor`, `LinkedNotes`, Inbox organize, QuickNote, person topic “Not ekle”, initiative note fields. Non-note textareas (person role, initiative blocker, etc.) are unchanged.
- On paste of `image/png`, `image/jpeg`, `image/webp`, or `image/gif`:
  1. Prevent default text paste for that image item.
  2. Persist the image via `saveNoteImage`.
  3. Insert a markdown-like marker at the caret: `![görsel](dlt-img:<uuid>)`.
  4. Show a small preview near the field (thumbnails for markers in the draft).
- If the image is larger than **5 MB**: toast `Görsel çok büyük`; do not save.
- If paste has no supported image: leave default paste behavior (text).
- **Viewing** notes: parse `body`, render markers as `<img>` via `getNoteImage`; surrounding text stays plain.
- Deleting the marker text from the body does not delete the stored image in v1 (orphans OK).

## Data

New table `note_images`:

| Column | Type | Notes |
|--------|------|--------|
| `id` | TEXT PK | UUID |
| `mime` | TEXT | e.g. `image/png` |
| `bytes_base64` | TEXT | base64 payload |
| `created_at` | TEXT | ISO |

Body marker format (exact): `![görsel](dlt-img:<uuid>)`

No new npm/Tauri dependencies. Schema added to `schema.sql` + ensure/migrate on open if needed (same pattern as other `ensure*` helpers).

## API

- `saveNoteImage(input: { id: string; mime: string; bytesBase64: string; nowIso: string }): Promise<void>`
- `getNoteImage(id: string): Promise<{ mime: string; bytesBase64: string } | null>`

Exposed on `AppDb`.

## UI components

- `NoteBodyField` — controlled textarea + paste handler + optional preview strip; calls `saveNoteImage` / `onToast`.
- `NoteBodyView` — read-only renderer that splits body on markers and loads images.

Wire note editors/views to these components.

## Out of scope

- File picker / drag-and-drop
- Rich contentEditable / WYSIWYG
- Orphan image garbage collection
- Image resize/compression UI
- Non-note text fields

## Tests

- Paste image → `saveNoteImage` called; body gains `dlt-img:` marker.
- Oversized paste → toast `Görsel çok büyük`; no save.
- `NoteBodyView` renders marker as image (mock `getNoteImage`).
- Plain text paste still works (no image item → default path).
