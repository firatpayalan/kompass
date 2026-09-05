# Person Labels Implementation Plan

> **For agentic workers:** Implement task-by-task.

**Goal:** Relationship labels with colors on people; seed Lider/Çalışan/Pair; allow custom labels with palette colors.

**Architecture:** `person_labels` table + `people.label_id`; JOIN in listPeople; UI select + badge.

**Tech Stack:** React, SQLite, Vitest — no new dependencies.

## Global Constraints

- Turkish UI
- No new npm packages
- Palette tokens only (no free hex picker)

---

### Task 1: Schema + repo

- [ ] schema, migration, types, peopleRepo/labelsRepo, appDb
- [ ] Seed builtins; tests
- [ ] Commit

### Task 2: UI

- [ ] PersonForm + PeopleView badge + PersonDetail label editor
- [ ] CSS for palette badges
- [ ] UI tests; commit
