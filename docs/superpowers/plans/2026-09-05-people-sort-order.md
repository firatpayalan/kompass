# People Sort Order Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax.

**Goal:** Persist custom people order via drag-and-drop on Kişi listesi; `listPeople` returns that order everywhere; new people go to the top.

**Architecture:** `people.sort_order` column + migration for existing DBs; `reorderPeople(ids)`; HTML5 DnD with a handle on PeopleView.

**Tech Stack:** React, SQLite (Tauri plugin-sql), Vitest — no new dependencies.

## Global Constraints

- No new npm packages without asking
- Turkish UI copy
- New people: `sort_order = MIN - 1` (top of list)

---

### Task 1: Schema + repo

- [ ] Add `sort_order` to `schema.sql` and `Person` type
- [ ] Migration in `connection.ts` (ALTER if missing + backfill)
- [ ] Update `createPerson` / `listPeople`; add `reorderPeople`
- [ ] Wire `appDb`; tests for create-at-top + reorder
- [ ] Commit

### Task 2: PeopleView DnD UI

- [ ] Drag handle + reorder on drop; optimistic UI + toast on failure
- [ ] CSS; UI test for reorder call
- [ ] Commit
