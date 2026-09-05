# Bugün reminder navigation — design

## Goal

On **Bugün** reminder lists (**Gecikenler**, **Hatırlatmalar**, **Yaklaşanlar**), clicking a reminder’s title/time opens navigation to linked people/initiatives, matching **Son notlar** behavior.

## Behavior

- Click target: reminder title + due time area only. **Tamamla** stays independent (`stopPropagation`); completing must not open the link menu.
- `targetType === "initiative"`: resolve via `listInitiatives`; menu shows `İş: {name}`; choose → `onOpenInitiative`.
- `targetType === "note"`: `getNote(targetId)`; build the same menu from that note’s `personIds` / `initiativeIds` (`Kişi:` / `İş:`), using cached `listPeople` / `listInitiatives`.
- If nothing resolves (missing note, archived targets, no links): toast `Bağlantı bulunamadı`; no empty menu.
- Affordances: pointer / hover on the clickable reminder body, same spirit as navigable recent notes.

## Data / wiring

- No schema change.
- `BugunView` db pick adds `getNote` (people/initiatives catalogs already loaded for Son notlar).
- Reuse existing `onOpenPerson` / `onOpenInitiative` and `person-label-menu` pattern.

## Out of scope

- Changing reminder completion / ticker behavior
- Opening a dedicated note-detail screen

## Tests

- Note reminder with person + initiative: click body → both menu items; choose navigates; Tamamla does not open menu.
- Initiative reminder: click → `İş: …` → `onOpenInitiative`.
- Unresolvable note reminder → toast `Bağlantı bulunamadı`.
