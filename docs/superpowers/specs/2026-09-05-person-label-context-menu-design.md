# Person label context menu (rename + recolor)

## Goal

Right-click a relationship chip to rename or change its color. Left-click still assigns the label to the person.

## Behavior

- Context menu on label chips only (not “Yok”)
- **İsim değiştir** → inline input on the chip; Enter/blur save, Esc cancel
- **Renk değiştir** → palette swatches; click saves immediately and closes menu
- Duplicate name → toast “Bu isimde etiket var”
- `updatePersonLabel(id, { name?, color? })` persists changes; people showing that label refresh via existing label lists / person updates

## Out of scope

- Settings page
- Delete label
- Keyboard-only context menu shortcuts
