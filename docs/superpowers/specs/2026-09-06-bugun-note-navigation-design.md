# Bugün recent-note navigation — design

## Goal

On **Bugün → Son notlar**, clicking a note that is linked to people and/or initiatives opens a menu of those targets and navigates to the chosen detail view.

## Behavior

- A note is **navigable** when `personIds.length > 0` or `initiativeIds.length > 0`.
- Clicking a navigable note always opens a context-style menu listing **all** resolvable targets:
  - People: `Kişi: {name}`
  - Initiatives: `İş: {name}`
- Choosing a person calls `onOpenPerson(person)`; choosing an initiative calls `onOpenInitiative(initiative)` (same App handlers as Command Palette / lists).
- Notes with no person or initiative links are **not** clickable (no menu, no toast).
- Right-click archive (`NoteArchiveShell`) is unchanged and must not conflict with left-click navigation.
- If linked ids cannot be resolved (e.g. archived / missing), skip those entries. If the menu would be empty, toast: `Bağlantı bulunamadı`.
- Reminder sections (Gecikenler / Hatırlatmalar / Yaklaşanlar) are out of scope.

## UI

- Reuse the existing `person-label-menu` pattern (position near click).
- Navigable rows get pointer cursor / light hover affordance; non-navigable rows stay inert for click.

## Data / wiring

- No schema change. Use `Note.personIds` and `Note.initiativeIds`.
- `BugunView` gains `onOpenPerson` and `onOpenInitiative` props; `App` passes existing `openPerson` / `openInitiative`.
- Resolve names via `listPeople` + `listInitiatives` (active lists only).

## Tests

- Linked note (person + initiative): click → menu shows both labels; person item → `onOpenPerson`; initiative item → `onOpenInitiative`.
- Unlinked note: click does not open menu / does not call open handlers.
- Existing Bugün smoke tests keep passing with new optional/required props wired in mocks.
