# Person relationship labels (color tags)

## Goal

Assign each person a relationship label with a color (e.g. Lider, Çalışan, Pair) so the people list is scannable. Users can add custom labels with a color from a fixed palette.

## Data

- Table `person_labels`: `id`, `name` (UNIQUE COLLATE NOCASE), `color` (palette token string), `created_at`
- Column `people.label_id` INTEGER NULL REFERENCES `person_labels(id)` ON DELETE SET NULL
- Seed on migrate if missing: **Lider**, **Çalışan**, **Pair** with fixed palette tokens
- Palette tokens (not free hex): `sky`, `teal`, `amber`, `rose`, `slate`, `lime`, `orange`, `indigo`
- Built-in seeds: Lider=`sky`, Çalışan=`teal`, Pair=`amber`

## API

- `listPersonLabels()`, `createPersonLabel({ name, color })`, `updatePerson(id, { labelId })`
- `createPerson` accepts optional `labelId`
- `listPeople` / `findPersonByName` JOIN label → Person includes `label: { id, name, color } | null`

## UI

- **Kişi ekle** form: label select + “Yeni etiket” (name + color swatches)
- **Kişi listesi**: colored badge next to name (or left accent bar)
- **Kişi detay**: change label (same select + create)
- No label = no badge

## Out of scope

- Editing/deleting built-in or custom label names after create (can add later)
- Filtering people by label
- Multiple labels per person
