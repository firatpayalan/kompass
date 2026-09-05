# Linked-note edit reminders — design

## Goal

When editing a note in **LinkedNotes** (person detail topics / untopic notes, initiative detail), the user can optionally add a reminder with the same flow as the Notlar editor.

## Behavior

- Edit form shows existing `ReminderForm`: checkbox **Hatırlatma ekle**, datetime **Hatırlatma zamanı**, period select.
- **Kaydet** with reminder off: update note body only (current behavior).
- **Kaydet** with reminder on and empty `dueAt`: toast **Hatırlatma zamanı gerekli**; do not save the note.
- **Kaydet** with reminder on and `dueAt` set:
  1. `updateNote(id, body)`
  2. `createReminder({ targetType: "note", targetId: id, dueAt: ISO, period, nowIso })`
  3. Close edit; reload parent lists as today
  4. If reminder create fails after note save: toast **Not kaydedildi, hatırlatma eklenemedi**
- **Vazgeç** discards body and reminder draft state.
- Reminder appears in Bugün / OS notify via existing ticker (no new notify path).

## Out of scope

- Listing or editing existing reminders on the note
- Reminder on the “Not ekle” compose form under a topic
- Changes to Notlar view or Quick Note (already supported)
- Schema changes

## API / UI wiring

- Extend `LinkedNotes` `onUpdateNote` to  
  `(noteId: number, body: string, reminder: ReminderDraft | null) => Promise<void>`  
  (or keep body-only callers by making reminder optional with default `null` — prefer always passing reminder from LinkedNotes).
- `PersonDetailView` and `InitiativeDetailView`: add `createReminder` to their db pick; implement save handler mirroring `NotesView.saveNote` reminder branch.
- Reuse `ReminderForm` / `ReminderDraft` from `src/components/ReminderForm.tsx`.

## Tests

- LinkedNotes (or person detail): edit + enable reminder + dueAt → `createReminder` called with `targetType: "note"`.
- Empty dueAt with reminder enabled → toast, no `updateNote` / no `createReminder`.
- Reminder unchecked → `updateNote` only, no `createReminder`.
