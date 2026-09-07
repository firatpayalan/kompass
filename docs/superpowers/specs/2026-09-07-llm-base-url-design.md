# LLM configurable base URL (company / custom host)

## Goal

Allow setting a custom API base URL in **Ayarlar** so weekly summarize can call company-network LLM gateways that speak Claude Messages or OpenAI Chat Completions, while keeping official Anthropic/OpenAI hosts as the default when the field is empty.

## Data

`llm_settings.json` (app config dir):

```json
{
  "provider": "claude" | "openai",
  "model": "<id>",
  "baseUrl": ""
}
```

- `baseUrl` optional; missing or blank → official default host for the selected provider.
- Persist via existing `get_llm_settings` / `set_llm_settings`.
- API keys unchanged: `claude_api_key` / `openai_api_key` files; auth headers unchanged.

### Normalize on save (only)

1. Trim leading/trailing whitespace.
2. Strip a **single trailing `/`** if present (avoid `//v1/...`).
3. **Do not** strip path prefixes (e.g. `/api/v2/proxy` must remain).
4. If non-empty and not parseable as `http://` or `https://` URL → reject with Turkish error; do not write.

## HTTP

```
finalUrl = normalize(baseUrl or defaultHost) + providerPath
```

| Provider | Default host | `providerPath` |
|----------|--------------|----------------|
| Claude | `https://api.anthropic.com` | `/v1/messages` |
| OpenAI | `https://api.openai.com` | `/v1/chat/completions` |

Examples:

- Empty + Claude → `https://api.anthropic.com/v1/messages`
- `https://llm.sirket.internal/api/v2/proxy` + Claude → `https://llm.sirket.internal/api/v2/proxy/v1/messages`
- Same base + OpenAI → `…/api/v2/proxy/v1/chat/completions`

Request body and headers stay as today (Claude: `x-api-key` + `anthropic-version`; OpenAI: Bearer). Gateway must match the selected provider’s wire format.

## UI (Ayarlar)

In the provider/model card:

- Label: **API taban adresi**
- Text input; placeholder: `Boş = resmi API (Anthropic / OpenAI)`
- Helper: şirket adresi path prefix dahil yazılabilir; `/v1/...` ekleme — uygulama seçilen sağlayıcıya göre ekler.
- Save with existing settings persist (blur or explicit save pattern already used for model).
- Validation error shown inline (`role="alert"`) + toast optional via existing patterns.

## Out of scope

- Per-provider separate base URLs
- “Test connection” button
- Custom auth headers / Azure `api-key` / mTLS / custom CA
- Free-form full endpoint (no auto `/v1/...`)
- New LLM providers beyond Claude / OpenAI wire formats
