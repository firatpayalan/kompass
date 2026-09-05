# Linked-note reminder urgency colors — design

## Goal

In **Bağlı notlar** (`LinkedNotes`), if a note has an open reminder, tint the whole note card by urgency relative to **local calendar day**.

## Rules

Compare reminder due **date** (local day, time ignored) to today (local day):

| Condition | Style |
|-----------|--------|
| `dueDay < today` (overdue) | Light red background on the note card |
| `0 ≤ dueDay − today ≤ 3` (due today through +3 days) | Yellow / light amber background |
| No open reminder, or due more than 3 days out | Default (unchanged) |

Overdue wins over yellow. Only incomplete reminders (`done = 0`) count. If several exist for a note, use the **earliest** `due_at`.

## Data

- Add optional `nextReminderDueAt: string | null` on `Note` (ISO), filled when mapping notes (batch query preferred: for note ids, `MIN(due_at)` where `target_type = 'note'`, `done = 0`).
- Apply in paths that feed LinkedNotes (person topics / untopic, initiative linked notes). Other note lists may leave the field `null` until needed.

## UI

- `LinkedNotes` `<li>` gets a modifier class from a pure helper, e.g. `reminderUrgency(dueAt, now) → "overdue" | "soon" | null`.
- CSS: light red / light yellow backgrounds matching existing palette (subtle, readable text).
- Do **not** replace `NoteTimestamps` (created/edited); optional later: show hatırlatma time — out of scope unless trivial.

## Out of scope

- Coloring Notlar list / Bugün recent notes
- Editing reminder display
- Schema change beyond reading existing `reminders` table

## Tests

- Helper unit tests: overdue, today, +3, +4, null due.
- UI: note with overdue dueAt gets overdue class; soon gets soon class.
