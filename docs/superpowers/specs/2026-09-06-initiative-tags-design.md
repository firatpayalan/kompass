# Initiative tags (separate catalog, multi-tag + list filter)

## Goal

Attach any number of free-text + color tags to initiatives. Catalog is independent from person labels, topic tags, and note tags. Filter the initiatives list by selected tags.

## Data

- `initiative_tags`: `id`, `name` UNIQUE COLLATE NOCASE, `color` (same palette tokens as person/topic labels), `created_at`
- `initiative_tag_links`: `(initiative_id, tag_id)` PK, CASCADE on delete of initiative or tag
- Migration: `CREATE TABLE IF NOT EXISTS` for both
- `Initiative` (list + detail): `tags: InitiativeTag[]`

## API

- `listInitiativeTags()` — full catalog
- `listInitiatives` / `getInitiative` include `tags` on each initiative
- `addTagToInitiative(initiativeId, { name, color })` — create-or-get by name, link, optionally update color if new pick differs (same rules as topic tags)
- `updateInitiativeTag(id, { name?, color? })`
- `deleteInitiativeTag(id)` — removes tag and all links
- `removeTagFromInitiative(initiativeId, tagId)` — unlink only

Filtering is client-side over loaded initiatives (not a SQL filter query in v1).

## UI

### Initiative detail

- Chip editor below the status/details form (reuse `TopicTagsEditor` pattern or thin wrapper): chips + add row (name, color swatches, Ekle)
- Chip right-click: İsim değiştir, Renk değiştir, Etiket sil (in-app confirm, no `window.confirm`)

### Initiatives list

- Read-only colored chips on each row
- Filter controls above the list: multi-select from catalog; clear / “Tümü”
- Match rule: initiative must have **all** selected tags (AND)
- Empty state when filter yields no rows

## Out of scope

- Sharing catalog with `person_labels`, `topic_tags`, or note `tags`
- SQL-side filtered list queries
- Special tag UI for archived initiatives only
- OR / exclude filter modes
