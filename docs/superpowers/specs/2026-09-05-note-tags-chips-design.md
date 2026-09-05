# Note tags chip UI

## Goal

Add colored chips to notes (same UX as topic tags), separate from person/topic label catalogs. Uses existing `tags` / `note_tags` with a new `color` column.

## Data

- `tags.color TEXT NOT NULL DEFAULT 'slate'`
- Migration for existing DBs
- `Note.tags: NoteTag[]` (`id`, `name`, `color`)

## API

- `listNoteTags()`, `addTagToNote`, `linkTagToNote`, `updateNoteTag`, `deleteNoteTag`
- Hashtag parse on create/update still links tags (default color `slate` for new names)

## UI

- `LinkedNotes` and `NoteList`: chips + add/reuse + right-click rename/recolor/delete
- Other list views show colored `#name` badges
