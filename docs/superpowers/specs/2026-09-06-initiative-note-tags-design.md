# Initiative linked-note tags — design

## Goal

Enable the same colored note-tag chips on **İş detayı → Bağlı notlar** as on person detail notes.

## Behavior

- Each linked note shows `TopicTagsEditor` (add / link existing / edit / delete) via existing `LinkedNotes` tag props.
- Tags are shared note tags (`note_tags` / `note_tag_links`); catalog from `listNoteTags()`.
- After tag mutations, reload initiative notes.

## Implementation

Wire `InitiativeDetailView` like `PersonDetailView` `noteTagHandlers`:

- Db pick: `addTagToNote`, `linkTagToNote`, `listNoteTags`, `updateNoteTag`, `deleteNoteTag`
- Load catalog on mount / with notes
- Pass handlers + `tagCatalog` + `onToast` into `LinkedNotes`

No schema change.

## Tests

UI: initiative detail LinkedNotes can add a tag (mock `addTagToNote`).
