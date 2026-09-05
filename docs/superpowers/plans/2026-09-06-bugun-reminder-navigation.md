# Bugün Reminder Navigation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development.

**Goal:** Click Bugün reminder title/time to open the same person/initiative link menu as Son notlar.

**Architecture:** Generalize BugunView link menu to hold resolved targets. ReminderSection calls `onOpenReminder`; note reminders use `getNote`, initiative reminders use the initiatives catalog. Tamamla uses stopPropagation.

**Tech Stack:** React, Vitest, existing AppDb.

## Global Constraints

- No new dependencies.
- Copy: `Kişi:`, `İş:`, `Bağlantı bulunamadı`.
- Spec: `docs/superpowers/specs/2026-09-06-bugun-reminder-navigation-design.md`
- Commit + push when done.

---

### Task 1: Reminder body click → link menu

**Files:** `src/views/BugunView.tsx`, `src/styles.css`, `tests/bugun-reminder-navigation-ui.test.tsx`, update note-nav tests db mocks with `getNote` if required.

- [ ] TDD tests then implement as in spec.
- [ ] `npm test` green
- [ ] Commit + push
