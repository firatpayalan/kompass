# Person archive design

## Goal

Archiving a person removes them from Kişiler and hides their linked notes from active lists. Restore brings person + batch-archived notes back. Sidebar **Arşiv** lists archived people.

## Behavior

- Right-click “Kişiyi sil” → confirm → archive (not hard delete)
- Notes linked via `note_people` that are not already soft-deleted get `deleted_at = people.archived_at`
- Active lists ignore archived people; notes use existing `deleted_at` filters
- Silinenler omits notes linked to an archived person
- Arşiv: archived people, expand to topics/notes, **Geri yükle**
- Restore: clear `archived_at`; clear `deleted_at` on linked notes where `deleted_at = archived_at`

## Data

- `people.archived_at TEXT NULL` + migration
- `Person.archivedAt: string | null`

## API

- `listPeople()` — `archived_at IS NULL`
- `listArchivedPeople()`
- `archivePerson(id, nowIso)`
- `restorePerson(id)`
- Keep `deletePerson` unused from UI (or remove later)
