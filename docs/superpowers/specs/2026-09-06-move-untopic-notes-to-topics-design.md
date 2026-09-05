# Move untopic notes to topics — design

## Goal

On a person detail page, notes under **Konusuz notlar** can be assigned to an existing **Konu** with an inline topic select and **Taşı** button.

## Behavior

- Each untopic note shows a topic `<select>` (placeholder: “Konu seç…”) and a **Taşı** button **only when the person already has at least one topic**.
- If there are no topics, the move controls are hidden (user creates a topic first via **Konu ekle**).
- **Taşı** requires a selected topic; otherwise toast: “Konu seçin”.
- On success: call `linkNoteToTopics(noteId, [topicId])`, toast “Nota konu bağlandı”, reload person detail, expand the target topic.
- Person link (`note_people`) is unchanged; only a topic link is added.
- A note moves from untopic → that topic’s note list (untopic = person-linked notes with no `note_topics` row).

## Out of scope

- Creating a new topic from the move control
- Moving notes between topics
- Removing a note from a topic back to untopic
- Drag-and-drop

## Data

No schema change. Uses existing `note_topics`.

## API

- Expose existing `linkNoteToTopics(noteId, topicIds)` on `AppDb` (already in `notesRepo`; replace-links semantics).
- UI uses a single topic id: `linkNoteToTopics(noteId, [topicId])`.

## UI

- **PersonDetailView** untopic `LinkedNotes` area: per-note move row when `topics.length > 0`.
- Prefer a small prop on `LinkedNotes` (e.g. `topicOptions` + `onMoveToTopic`) so only the untopic section gets the controls; topic-card notes stay unchanged.

## Tests

- With topics: select topic → Taşı → note leaves untopic list and appears under that topic; `linkNoteToTopics` called with `[topicId]`.
- With no topics: move UI not rendered on untopic notes.
