# Bugün reminder buckets (Gecikenler / Hatırlatmalar / Yaklaşanlar) — design

## Goal

On the Bugün view, split incomplete reminders into three non-overlapping sections by local calendar day, and keep **Son notlar** unchanged.

## Sections (order)

1. **Gecikenler** (outdated) — `done = 0` and `due_at < start of today (local)`
2. **Hatırlatmalar** (today) — `done = 0` and `start of today ≤ due_at ≤ end of today`
3. **Yaklaşanlar** (upcoming) — `done = 0` and `start of tomorrow ≤ due_at ≤ end of (today + 7 days)`
4. **Son notlar** — unchanged

Empty copy (examples): “Geciken hatırlatma yok.” / “Bugün için hatırlatma yok.” / “Yaklaşan hatırlatma yok.”

## Row behavior

Same row as today’s reminder list: title, formatted `dueAt`, **Tamamla** → existing `advanceOrCompleteReminder` / ticker `completeReminder`. Completing refreshes all three lists.

## Data / API

Reuse the same title join and target filters as current `listDueRemindersForBugun` (active note / existing initiative).

- `listOverdueReminders(db, now)` — due before local midnight today
- `listDueRemindersForBugun(db, now)` — **narrow to today only** (breaking change vs previous “through end of today including overdue”)
- `listUpcomingReminders(db, now)` — from local tomorrow 00:00 through end of day today+7

Expose all three on `AppDb`.

## Notifications

OS/in-app notify must still fire for overdue **and** today. Do **not** drive the ticker solely from the today-only UI list.

Preferred approach: ticker loads `listOverdueReminders` + `listDueRemindersForBugun` (today) and merges (dedupe by id) for notify + optional combined “due for attention” set; Bugün UI loads the three lists separately for display.

## Out of scope

- Due dates on initiatives themselves
- Changing Son notlar
- English section titles
- Schema changes

## Tests

- Repo: overdue / today / upcoming bucketing with fixed `now` (boundary cases: just before midnight, tomorrow, day+7, day+8).
- UI: Bugün shows three headings; Tamamla on an overdue item removes it from Gecikenler.
