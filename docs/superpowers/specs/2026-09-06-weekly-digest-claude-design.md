# Weekly digest + optional Claude summary — design

## Goal

Sidebar **Hafta** screen: compile notes for a chosen Mon–Sun week grouped by people and initiatives. Optionally call Claude (user API key) to produce a Turkish leadership summary and cache it locally.

## Behavior (UI)

### Navigation

- New sidebar items: **Hafta** (`hafta`) and **Ayarlar** (`ayarlar`); both in command palette.

### Hafta screen

- Week navigator: local-calendar Monday 00:00 → next Monday 00:00; ◀ ▶; show range in `tr-TR`.
- Summary counts: “N not · M kişi · K iş”.
- If a cached summary exists for `week_start`, show an **Özet** block above the lists.
- If API key is set: **Claude ile özetle** (UPSERT overwrites cache for that week).
- If no API key: compilation only; show short copy pointing to **Ayarlar** (no summarize button).
- Sections **Kişiler** and **İşler**: name → that week’s notes (short body; click opens person/initiative detail).
- A note linked to both a person and an initiative appears in **both** sections.
- Inbox notes (no person/initiative) are excluded.
- Soft-deleted notes are excluded.
- Privacy note near summarize / settings: summarizing sends note text to Anthropic.

### Ayarlar (minimal)

- Optional Claude API key: save / clear.
- Key never shown in full after save (masked or “kayıtlı” only).
- Key is not stored in SQLite.

## Data

### Week window

- Filter: `notes.created_at >= startIso AND notes.created_at < endIso` and `deleted_at IS NULL`.
- `week_start` key: Monday date `YYYY-MM-DD` in local calendar.

### `weekly_summaries`

| Column | Notes |
|--------|--------|
| `week_start` | `TEXT PRIMARY KEY` (`YYYY-MM-DD`) |
| `content` | Claude summary text |
| `model` | Model id used |
| `created_at` | Generation timestamp (ISO) |

Migration: `CREATE TABLE IF NOT EXISTS` (+ ensure helper if needed, same pattern as other tables).

### API key storage

- File under Tauri app config/data dir (e.g. `claude_api_key`), not SQLite.
- No new keychain dependency in v1.

## API

### SQLite / AppDb

- `listNotesInRange(db, startIso, endIso) → Note[]` (existing note mapping: tags, personIds, initiativeIds, topicIds).
- `getWeeklySummary(weekStart) → { content, model, createdAt } | null`
- `upsertWeeklySummary({ weekStart, content, model, createdAt })`
- TS helper groups notes into person/initiative sections using `listPeople` / `listInitiatives` names.

### Claude (Tauri command)

- `summarize_week({ week_start, notes_payload, api_key }) → { content, model }`
- Implemented in Rust; HTTP to Anthropic Messages API (requires adding a Rust HTTP crate such as `reqwest` — ask before adding).
- Prompt: Turkish weekly leadership digest (people / initiatives / dikkat).
- Strip image markers (`dlt-img:…`); do not send image bytes.
- Errors (network, 401, rate limit): Turkish toast; leave existing cache unchanged.

## Out of scope

- OpenAI or other providers
- Self-performance category digests (requirements §11)
- Daily AI summary, period goals, scheduled digests
- Keychain / npm Anthropic SDK
- Inbox-only or archived-entity focus
- Copy/export of summary

## Tests

- `listNotesInRange`: range bounds + soft-delete exclusion
- Grouping: person-only, initiative-only, both
- `weekly_summaries` UPSERT
- UI: no key → no summarize; key present → summarize available
- Summarize success writes cache; 401 leaves cache unchanged (command mocked in tests where needed)
