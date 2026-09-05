# Initiative list last activity — design

## Goal

On **İşler → İş listesi**, show when each initiative was last worked on, based on linked-note activity, as a relative Turkish time (minute precision).

## Behavior

- Display value: `lastActivityAt` = `MAX(updated_at)` of non-deleted notes linked via `note_initiatives`; if none, fall back to the initiative’s `createdAt`.
- Soft-deleted notes (`deleted_at IS NOT NULL`) do not count.
- Format with a shared `formatRelativeTr(iso, now)` helper:
  - &lt; 1 minute → `az önce`
  - 1–59 minutes → `N dakika önce`
  - 1–23 hours → `N saat önce`
  - 1–6 days → `N gün önce`
  - ≥ 7 days → short date, e.g. `6 Eyl 2026` (`tr-TR`)
- Visible label is relative; `title` / `dateTime` use full `toLocaleString("tr-TR")`.
- No live ticking while the page stays open; refresh on load / navigation back to the list.
- Manual list order (`sort_order`) unchanged.

## UI

Row layout (left → right):

1. Drag handle  
2. Initiative name (and blocker line when present)  
3. Fixed-width relative activity column  
4. **Status badge always farthest right**

Matches option C with status pinned to the trailing edge.

## Data

- Add `lastActivityAt: string` (ISO) to `Initiative`.
- No schema migration; derive in SQL when reading initiatives.
- `listInitiatives` (and other mappers that return `Initiative`) populate `lastActivityAt` so the type stays consistent:
  - create → `createdAt`
  - get / update / list / archive restore → same `COALESCE(MAX(...), created_at)` expression (or create uses `createdAt` only)

## Out of scope

- Reordering the list by last activity
- Showing activity on the archive initiatives list
- Auto-refresh / interval timers on the open list page
- Counting initiative field edits (name/status/blocker) as activity

## Tests

- Repo: initiative with linked notes → `lastActivityAt` is max note `updated_at`; with no notes → `createdAt`; deleted notes ignored.
- UI: list row shows relative text and keeps status on the far right; formatter unit cases for minute / hour / day / week+ buckets.
