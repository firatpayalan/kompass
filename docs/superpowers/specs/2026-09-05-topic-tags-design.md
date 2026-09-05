# Topic tags (separate from person labels)

## Goal

Attach any number of free-text + color tags to topics. Catalog is independent from person relationship labels.

## Data

- `topic_tags`: `id`, `name` UNIQUE COLLATE NOCASE, `color` (same palette tokens as person labels), `created_at`
- `topic_tag_links`: `(topic_id, tag_id)` PK, CASCADE on delete
- Migration `CREATE TABLE IF NOT EXISTS` for both

## API

- Tags loaded with `listTopicsWithNotesForPerson` → each topic includes `tags: TopicTag[]`
- `addTagToTopic(topicId, { name, color })` — create-or-get by name, link, optionally update color if new pick differs
- `updateTopicTag(id, { name?, color? })`
- `deleteTopicTag(id)` — removes tag and all links
- `removeTagFromTopic(topicId, tagId)` — unlink only (chip “Konudan kaldır” optional; right-click Sil deletes tag)

## UI

- Expanded/collapsed topic header area: chips + add row (name input, color swatches, Ekle)
- Chip right-click: İsim değiştir, Renk değiştir, Etiket sil (in-app confirm, no `window.confirm`)

## Out of scope

- Filtering topics by tag
- Sharing with person_labels
