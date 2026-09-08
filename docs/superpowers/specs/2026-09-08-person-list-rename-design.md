# Person list rename (context menu)

## Goal

Right-click a person in **Kişi listesi** and rename them inline, without opening the detail view.

## Behavior

- Context menu on list rows (existing menu that already has **Kişiyi arşivle**)
- New item **İsmi değiştir** above archive
- Choosing it closes the menu and replaces the name on that row with an inline input
- Input starts with the current name, focused and selected
- **Enter** or blur saves; **Esc** cancels and restores the name
- Empty (whitespace-only) name → toast “İsim boş olamaz”; stay in edit mode
- Unchanged name → exit edit mode with no write
- After a successful save, the list row shows the new name; open detail (if any) should reflect the same name via existing person update callbacks if wired

## Persistence

- Extend `UpdatePersonPatch` with optional `name`
- `updatePerson` updates `people.name` when `name` is provided (trim before save)
- Label-only updates keep working as today

## Out of scope

- Editing role/notes from the list
- Changing label from this menu
- Duplicate-name checks (person names are not unique today)
- Initiative list rename (separate if needed later)
