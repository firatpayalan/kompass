# Weekly digest + optional LLM summary — design

## Goal

Sidebar **Hafta** screen: compile notes for a chosen Mon–Sun week grouped by people and initiatives. Optionally call **Claude and/or OpenAI** (user API keys) to produce a Turkish leadership summary and cache it locally.

## Behavior (UI)

### Navigation

- New sidebar items: **Hafta** (`hafta`) and **Ayarlar** (`ayarlar`); both in command palette.

### Hafta screen

- Week navigator: local-calendar Monday 00:00 → next Monday 00:00; ◀ ▶; show range in `tr-TR`.
- Summary counts: “N not · M kişi · K iş”.
- If a cached summary exists for `week_start`, show an **Özet** block above the lists (include which provider/model produced it when available).
- If at least one API key is set **and** a provider is selected: **Özetle** (UPSERT overwrites cache for that week). Button label can be neutral (“Özetle”) or “{Sağlayıcı} ile özetle”.
- If no usable key/provider: compilation only; short copy pointing to **Ayarlar** (no summarize button).
- Sections **Kişiler** and **İşler**: name → that week’s notes (short body; click opens person/initiative detail).
- A note linked to both a person and an initiative appears in **both** sections.
- Inbox notes (no person/initiative) are excluded.
- Soft-deleted notes are excluded.
- Privacy note: summarizing sends note text to the selected provider (Anthropic or OpenAI).

### Ayarlar (LLM)

**Keys (optional, independent)**

- Claude (Anthropic) API key: save / clear → “Anahtar kayıtlı” (never show full key after save).
- OpenAI API key: save / clear → same. This is the **Platform API** key (`sk-…`), not ChatGPT Plus login.

**Provider + model (how the user picks)**

- **Sağlayıcı** `<select>`: `Claude` | `OpenAI`. Only providers that currently have a saved key are enabled; if none, selects disabled and summarize unavailable.
- **Model** `<select>`: curated list that **depends on the selected provider** (no free-text model id in v1).

Default curated lists (ids pinned in code; labels Turkish-friendly):

| Provider | Models (value = API model id) |
|----------|-------------------------------|
| Claude | `claude-sonnet-4-20250514` (default), `claude-opus-4-20250514`, `claude-haiku-4-20250414` |
| OpenAI | `gpt-4.1` (default), `gpt-4o`, `o4-mini` |

- Changing provider resets model to that provider’s default if the previous model is not in the new list.
- Persist `provider` + `model` in app config (JSON), not SQLite.
- Keys stay in separate files under app config dir (not SQLite, no keychain in v1).

## Data

### Week window

- Filter: `notes.created_at >= startIso AND notes.created_at < endIso` and `deleted_at IS NULL`.
- `week_start` key: Monday date `YYYY-MM-DD` in local calendar.

### `weekly_summaries`

| Column | Notes |
|--------|--------|
| `week_start` | `TEXT PRIMARY KEY` (`YYYY-MM-DD`) |
| `content` | Summary text |
| `provider` | `claude` \| `openai` |
| `model` | Model id used |
| `created_at` | Generation timestamp (ISO) |

Migration: `CREATE TABLE IF NOT EXISTS` (+ ensure helper; add `provider` column via ensure if upgrading empty/new installs from CREATE).

### Config files (app config dir)

- `claude_api_key` — Anthropic key (or empty/absent)
- `openai_api_key` — OpenAI key (or empty/absent)
- `llm_settings.json` — `{ "provider": "claude" \| "openai", "model": "<id>" }`

## API

### SQLite / AppDb

- `listNotesInRange(db, startIso, endIso) → Note[]`
- `getWeeklySummary(weekStart) → { content, provider, model, createdAt } | null`
- `upsertWeeklySummary({ weekStart, content, provider, model, createdAt })`
- TS helper groups notes into person/initiative sections.

### LLM (Tauri commands)

- Key helpers: `has_claude_api_key`, `save_claude_api_key`, `clear_claude_api_key`, and OpenAI equivalents.
- Settings: `get_llm_settings` / `set_llm_settings` (provider + model).
- `summarize_week({ week_start, notes_json })` → `{ content, provider, model }`
  - Reads keys + settings from disk (not from frontend for secrets).
  - Dispatches to Anthropic Messages **or** OpenAI Chat Completions based on `provider`.
  - Same Turkish prompt structure for both.
  - Strip `dlt-img:…`; no image bytes.
  - Errors → Turkish toast; cache unchanged.
- HTTP via Rust `reqwest` (ask before adding dependency). No npm LLM SDKs.

## Out of scope

- ChatGPT Plus / browser session (not an API)
- Free-text / arbitrary model ids (v1 curated only)
- Other providers (Gemini, local Ollama, …)
- Self-performance category digests (requirements §11)
- Daily AI summary, period goals, scheduled digests
- Keychain / npm SDKs
- Inbox-only or archived-entity focus
- Copy/export of summary

## Tests

- `listNotesInRange`: range bounds + soft-delete exclusion
- Grouping: person-only, initiative-only, both
- `weekly_summaries` UPSERT including `provider`
- UI: no keys → no summarize; key + provider → summarize available
- Ayarlar: model list switches with provider; provider without key disabled
- Summarize success writes cache; 401 leaves cache unchanged (bridge mocked)
