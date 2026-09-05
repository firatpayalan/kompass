# Initiative Topics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or executing-plans.

**Goal:** Give iş detayı the same Konu → Not structure as kişi detayı, with existing flat notes as Konusuz.

**Architecture:** Extend `topics` with nullable `person_id` + `initiative_id` (XOR). Add list/create helpers for initiatives; reshape `InitiativeDetailView` like `PersonDetailView` topic UI.

**Tech Stack:** React, TypeScript, SQLite, Vitest.

## Global Constraints

- No new dependencies.
- Turkish copy mirrors person detail (Konu ekle, Yeniden adlandır, Konusuz notlar, Taşı, …).
- Spec: `docs/superpowers/specs/2026-09-06-initiative-topics-design.md`
- Commit + push when complete.

## File map

| File | Role |
|------|------|
| `src/db/schema.sql` | topics columns |
| `src/db/topicsRepo.ts` | ensure migration, create/list for initiative |
| `src/db/notesRepo.ts` | `listUntopicNotesForInitiative` |
| `src/db/connection.ts` | call ensure |
| `src/lib/types.ts` | Topic personId/initiativeId nullables |
| `src/db/appDb.ts` | expose new APIs |
| `src/views/InitiativeDetailView.tsx` | topic UI |
| Tests | repo + UI + fixture Topic updates |

---

### Task 1: Schema + repo

- [ ] Migration `ensureTopicsInitiativeOwner(db)`:
  - ADD `initiative_id` if missing
  - Rebuild `topics` so `person_id` is nullable; preserve FKs on `note_topics` / `topic_tag_links` (disable FK, copy, drop, rename, recreate indexes)
  - Create unique index on `(initiative_id, title)` where initiative_id IS NOT NULL if feasible; else enforce in app
- [ ] Update `Topic` type; map `initiative_id`
- [ ] `CreateTopicInput`: `{ personId: number; title; nowIso? } | { initiativeId: number; title; nowIso? }`
- [ ] `findTopicByTitleForInitiative`, `createTopic` XOR, `updateTopic` uses owner’s find
- [ ] `listTopicsForInitiative`, `listTopicsWithNotesForInitiative`
- [ ] `listUntopicNotesForInitiative` (mirror person SQL on `note_initiatives`)
- [ ] Wire AppDb + connection
- [ ] Tests in `tests/topicsRepo.test.ts` (extend) / new file
- [ ] Fix all `Topic` fixtures: `initiativeId: null` (and keep `personId`)

### Task 2: InitiativeDetailView UI

- [ ] Mirror PersonDetailView topic section (state: topics, untopicNotes, expanded, drafts, rename, create)
- [ ] Remove flat Bağlı notlar list + bottom-only form
- [ ] Pass note image + note tag + topic tag handlers
- [ ] UI test: create topic, add note under topic, move untopic

### Task 3: Verify + ship

- [ ] `npm test` green
- [ ] Commit + push

---

## Spec coverage

Data XOR + migration → Task 1; full UI parity → Task 2; tests → 1–2; ship → 3.
