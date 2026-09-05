# Initiative topics (parity with person topics) — design

## Goal

On **İş detayı**, mirror person detail: create **Konular** first, add notes under a topic, and keep existing flat initiative notes under **Konusuz notlar**.

## Behavior (UI)

`InitiativeDetailView` matches person-detail topic UX:

- **Konu ekle** (title + add)
- Topic cards: expand/collapse, note count, **Yeniden adlandır**, topic tags, notes list + **Not ekle**
- **Konusuz notlar**: notes linked to the initiative with no `note_topics` row; **Taşı** when at least one topic exists
- Remove the current flat “Bağlı notlar” + bottom-only note form (replaced by topic / untopic flow)
- Status / reminder / image paste / note tags on notes remain as today

## Data

Extend `topics`:

- `person_id` becomes nullable
- add `initiative_id INTEGER NULL REFERENCES initiatives(id) ON DELETE CASCADE`
- Exactly one owner:  
  `(person_id IS NOT NULL AND initiative_id IS NULL) OR (person_id IS NULL AND initiative_id IS NOT NULL)`
- Uniqueness: per-person title (existing) and per-initiative title (new), enforced in app + migration-friendly indexes where SQLite allows
- Migration `ensureTopicsInitiativeId` for existing DBs; existing rows keep `initiative_id = NULL`

`Topic` type:

- `personId: number | null`
- `initiativeId: number | null`
- `title`, `createdAt` unchanged

`note_topics` and topic-tag tables unchanged.

Semantics:

- Topic note on an initiative: `note_initiatives` + `note_topics`
- Untopic for an initiative: in `note_initiatives`, not in `note_topics`

## API

- `createTopic({ personId } | { initiativeId }, title, nowIso?)` — XOR owners; duplicate title errors as today (“Bu isimde konu var”)
- `listTopicsWithNotesForInitiative(initiativeId)` → `{ topics: TopicWithNotes[]; untopicNotes: Note[] }`
- `listUntopicNotesForInitiative` (used internally / via list helper)
- Reuse `updateTopic`, topic-tag APIs, `linkNoteToTopics`
- Creating a note under an initiative topic: `createNote` with `initiativeIds: [id]` and `topicIds: [topicId]` (or create then link)

Person-topic APIs remain valid; `personId` required path unchanged for callers that only pass `personId`.

## Out of scope

- Moving notes between topics
- Sharing a topic between a person and an initiative
- New archive-specific initiative-topic UI beyond existing archive patterns

## Tests

- Repo: create/list initiative topics; reject duplicate title; untopic = initiative-linked without topic; note under topic leaves untopic list
- UI: add topic → card; add note under topic; move untopic → topic
- Person topic flows still pass
