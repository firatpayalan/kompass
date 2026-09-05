# People list drag-and-drop order

## Goal

Users can reorder people by drag-and-drop on **Kişi listesi**. The order is persisted and used everywhere `listPeople` is called (Inbox, command palette, etc.). New people appear at the **top** of the list.

## Data

- Add `people.sort_order INTEGER NOT NULL` (default `0`).
- `listPeople` orders by `sort_order ASC, id ASC`.
- On create: `sort_order = COALESCE(MIN(sort_order), 0) - 1` so the new row is first.
- `reorderPeople(ids: number[])` sets `sort_order` to `0..n-1` for the given id sequence in one transaction.
- Existing DBs: migration adds the column and backfills `0..n-1` by current name order.

## UI

- Only **Kişi listesi** supports drag-and-drop (not Inbox checkboxes).
- Each row: drag handle (⠿) + existing open button.
- Drag via handle (HTML5 DnD, no new dependency).
- Drop updates local order immediately, then calls `reorderPeople`; on failure, reload and toast.

## Out of scope

- Reordering initiatives
- Keyboard-only reorder shortcuts
- Third-party DnD libraries
