# Daily Leadership Tool — Design Spec

**Date:** 2026-09-05  
**Status:** Approved for implementation planning  
**Language:** Turkish UI  
**Audience:** Single user (engineering manager)

## Problem

Engineering managers juggle 1:1s, stakeholder meetings, team performance feedback, large initiatives, and self-reflection under high concurrent load. Capture is often pen-and-paper; transfer and recall fail. The tool must make fast local note capture, organization, search, and periodic reminders reliable on the desktop.

## Goals (MVP)

- Capture freeform notes quickly with keyboard shortcuts
- Organize via tags plus first-class People and Initiative records linked from notes
- Remind on chosen schedules (in-app “Bugün” panel + macOS notifications)
- Full-text search across notes
- Soft-delete notes into **Silinenler** (restore or permanently delete)
- Local-first data (no cloud in MVP)

## Non-goals (MVP)

- AI summaries, insights, or goal-alignment commentary (Phase 2)
- Period goals and automated weekly digests (Phase 2)
- Multi-user / team sharing / sync across devices
- Mobile-first clients
- Calendar or email integration

## Product decisions

| Decision | Choice |
|----------|--------|
| Platform | Desktop-first (macOS priority), keyboard-heavy |
| Shell | Tauri + web UI (React) |
| Data | Local SQLite in app data directory |
| Notes | Freeform text + tags (`#1:1`, `#geri-bildirim`, …) |
| People / Initiatives | Separate records; link from notes (not tag-only) |
| Reminders | In-app panel + OS notifications |
| Layout | Sidebar: Bugün, Notlar, Kişiler, İşler, Arama, Silinenler |
| UI language | Turkish |
| Delete | Soft delete → Silinenler; permanent delete with confirm |

## Architecture

```
┌─────────────────────────────────────────┐
│  Tauri shell (macOS)                    │
│  · In-app shortcuts (MVP); global       │
│    hotkeys optional later               │
│  · Native notifications                 │
│  · Reminder scheduler while app is      │
│    running (MVP)                        │
├─────────────────────────────────────────┤
│  React UI (Turkish)                     │
│  · Sidebar navigation                   │
│  · Cmd+K command palette / search       │
│  · Cmd+N quick note                     │
├─────────────────────────────────────────┤
│  Local SQLite + FTS                     │
└─────────────────────────────────────────┘
```

Phase 2 AI features consume the same note/person/initiative store without changing MVP capture flows.

## Screens and flows

### Navigation (sidebar)

1. **Bugün** — due reminders + recent notes (default home)
2. **Notlar** — chronological list; compose/edit
3. **Kişiler** — list + detail (linked notes)
4. **İşler** — initiatives list + detail (status, blocker summary, linked notes)
5. **Arama** — FTS results
6. **Silinenler** — soft-deleted notes; restore or permanent delete

### Primary flows

1. **Quick capture (`Cmd+N`)** — write body → parse `#tags` → optional link people/initiatives → optional reminder → save  
2. **Link entity** — pick existing person/initiative or create quickly; `@name` in text may suggest matches  
3. **Reminder** — attach to note or initiative; appears on Bugün when due; fires OS notification  
4. **Person / Initiative page** — chronological linked notes for prep and feedback history  
5. **Soft delete** — remove from active lists → Silinenler; restore returns to active; permanent delete requires confirmation  

## Data model

### Tables

- **people** — `id`, `name`, `role_or_notes` (optional), `created_at`
- **initiatives** — `id`, `name`, `status` (`aktif` | `beklemede` | `bitti`), `blocker_summary`, `created_at`
- **notes** — `id`, `body`, `created_at`, `updated_at`, `deleted_at` (null = active)
- **tags** — tag strings; many-to-many with notes
- **note_people** / **note_initiatives** — note ↔ entity links
- **reminders** — `id`, target (`note` | `initiative` + id), `due_at`, `period` (`once` | `daily` | `weekly` | `monthly`), `done`, `created_at`

### Rules

- Empty note body cannot be saved
- Duplicate person/initiative names: warn and offer existing record
- Deleting a person/initiative unlinks notes; note bodies remain
- Soft-deleted notes keep tags and links; excluded from default lists/search unless viewing Silinenler (search scope: active by default)
- Soft-deleted notes’ reminders are hidden from Bugün and do not fire OS notifications until the note is restored
- Reminder without notification permission: Bugün panel still works; one-time prompt to enable notifications

## Keyboard shortcuts (MVP)

| Shortcut | Action |
|----------|--------|
| `Cmd+N` | Quick note |
| `Cmd+K` | Command palette / navigate |
| `Cmd+F` | Search notes |
| `Cmd+1…4` | Bugün / Notlar / Kişiler / İşler |
| `Esc` | Cancel / close composer or modal |

## Error handling

- SQLite write failure → Turkish toast; keep in-memory draft so capture is not lost
- Missing notification permission → degrade to panel-only + prompt
- Soft delete is default destructive action; permanent delete is explicit and confirmed

## Testing

- **Unit:** tag parsing, reminder period next-due calculation, FTS query helpers, soft-delete/restore
- **Integration:** create note → link person → reminder appears on Bugün; soft delete → Silinenler → restore
- **Manual:** OS notification delivery, shortcut tour on macOS

## Mapping to original requirements

| Requirement theme | MVP | Phase 2 |
|-------------------|-----|---------|
| Fast notes, 1:1 / meeting capture | Yes | — |
| Link feedback to people | Yes (notes + people) | — |
| Stakeholder meeting notes | Yes (notes + people) | — |
| Daily observations for manager 1:1 | Yes (notes + tags/reminders) | Digests |
| Initiative tracking / blockers | Yes (initiatives + notes) | Richer status views |
| Action items from meetings | Yes (notes + reminders) | — |
| Search | Yes | — |
| Reminders | Yes | — |
| Daily/weekly AI summaries | — | Yes |
| Period goals + alignment | — | Yes |

## Out of scope details for later design

Phase 2 will specify AI provider (local vs API), digest schedules, and period-goal schema once MVP capture and reminder loops are proven.
