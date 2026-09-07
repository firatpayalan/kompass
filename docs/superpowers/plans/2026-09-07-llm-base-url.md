# LLM Base URL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users set an optional company/custom API base URL in Ayarlar; summarize posts to `{base}/v1/messages` or `{base}/v1/chat/completions` (official hosts when empty).

**Architecture:** Persist `baseUrl` on existing `llm_settings.json` via `get/set_llm_settings`. Shared normalize/join rules in TS (UI validation) and Rust (HTTP). Path prefixes are preserved; only whitespace + one trailing `/` are stripped.

**Tech Stack:** React + TypeScript, Vitest, Tauri Rust `llm.rs` + reqwest (already present).

## Global Constraints

- No new dependencies without asking the user.
- Turkish UI copy as in the spec.
- Do not strip path prefixes from `baseUrl`.
- Empty `baseUrl` → official Anthropic / OpenAI hosts.
- Auth headers and key files unchanged.
- Commit only when the user explicitly asks (skip commit steps unless requested).
- Spec: `docs/superpowers/specs/2026-09-07-llm-base-url-design.md`

## File map

| File | Responsibility |
|------|----------------|
| `src/lib/llmBaseUrl.ts` | Normalize + validate + resolve endpoint (TS, for UI + tests) |
| `tests/llmBaseUrl.test.ts` | Unit tests for normalize/resolve |
| `src/lib/llmBridge.ts` | `LlmSettings.baseUrl?: string` |
| `src-tauri/src/llm.rs` | Persist `baseUrl`; build final URL in Claude/OpenAI callers |
| `src/views/AyarlarView.tsx` | API taban adresi field |
| `tests/hafta-ayarlar-ui.test.tsx` | Persist baseUrl / validation UI |

---

### Task 1: TS `llmBaseUrl` helpers

**Files:**
- Create: `src/lib/llmBaseUrl.ts`
- Test: `tests/llmBaseUrl.test.ts`

**Interfaces:**
- Produces:
  - `normalizeBaseUrl(raw: string): string` — trim; strip one trailing `/`; empty → `""`
  - `validateBaseUrl(raw: string): string | null` — returns Turkish error or `null` if OK (empty OK)
  - `resolveLlmEndpoint(provider: "claude" | "openai", baseUrl: string): string`

- [ ] **Step 1: Write failing tests**

Create `tests/llmBaseUrl.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  normalizeBaseUrl,
  resolveLlmEndpoint,
  validateBaseUrl,
} from "../src/lib/llmBaseUrl";

describe("llmBaseUrl", () => {
  it("normalizes whitespace and a single trailing slash without stripping path", () => {
    expect(normalizeBaseUrl("  https://llm.sirket.internal/api/v2/proxy/  ")).toBe(
      "https://llm.sirket.internal/api/v2/proxy",
    );
    expect(normalizeBaseUrl("")).toBe("");
    expect(normalizeBaseUrl("   ")).toBe("");
  });

  it("rejects non-http(s) when non-empty", () => {
    expect(validateBaseUrl("")).toBeNull();
    expect(validateBaseUrl("https://ok.example/path")).toBeNull();
    expect(validateBaseUrl("ftp://x")).toMatch(/geçersiz|http/i);
    expect(validateBaseUrl("not-a-url")).not.toBeNull();
  });

  it("resolves official and custom endpoints", () => {
    expect(resolveLlmEndpoint("claude", "")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
    expect(resolveLlmEndpoint("openai", "")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(
      resolveLlmEndpoint("claude", "https://llm.sirket.internal/api/v2/proxy"),
    ).toBe("https://llm.sirket.internal/api/v2/proxy/v1/messages");
    expect(
      resolveLlmEndpoint("openai", "https://llm.sirket.internal/api/v2/proxy"),
    ).toBe(
      "https://llm.sirket.internal/api/v2/proxy/v1/chat/completions",
    );
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/llmBaseUrl.test.ts`

- [ ] **Step 3: Implement `src/lib/llmBaseUrl.ts`**

```ts
import type { LlmProvider } from "./llmModels";

const DEFAULT_HOST: Record<LlmProvider, string> = {
  claude: "https://api.anthropic.com",
  openai: "https://api.openai.com",
};

const PROVIDER_PATH: Record<LlmProvider, string> = {
  claude: "/v1/messages",
  openai: "/v1/chat/completions",
};

export function normalizeBaseUrl(raw: string): string {
  let value = raw.trim();
  if (value.endsWith("/")) {
    value = value.slice(0, -1);
  }
  return value;
}

export function validateBaseUrl(raw: string): string | null {
  const normalized = normalizeBaseUrl(raw);
  if (!normalized) {
    return null;
  }
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return "API taban adresi geçersiz";
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "API taban adresi http veya https olmalı";
  }
  return null;
}

export function resolveLlmEndpoint(
  provider: LlmProvider,
  baseUrl: string,
): string {
  const normalized = normalizeBaseUrl(baseUrl);
  const host = normalized || DEFAULT_HOST[provider];
  return `${host}${PROVIDER_PATH[provider]}`;
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npm test -- tests/llmBaseUrl.test.ts`

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add src/lib/llmBaseUrl.ts tests/llmBaseUrl.test.ts
git commit -m "Add LLM base URL normalize and resolve helpers."
```

---

### Task 2: Rust settings + HTTP endpoint

**Files:**
- Modify: `src-tauri/src/llm.rs`
- Modify: `src/lib/llmBridge.ts` (`baseUrl` on `LlmSettings`)

**Interfaces:**
- Consumes: normalize/join rules matching Task 1
- Produces: `LlmSettings.base_url` serialized as `baseUrl`; `call_claude` / `call_openai` POST to resolved URL

- [ ] **Step 1: Extend TS type**

In `src/lib/llmBridge.ts`:

```ts
export type LlmSettings = {
  provider: LlmProvider;
  model: string;
  baseUrl?: string;
};
```

- [ ] **Step 2: Extend Rust `LlmSettings`**

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LlmSettings {
    pub provider: LlmProvider,
    pub model: String,
    #[serde(default)]
    pub base_url: String,
}
```

Update `default_settings()` to `base_url: String::new()`.

Add helpers (mirror TS):

```rust
fn normalize_base_url(raw: &str) -> String {
    let trimmed = raw.trim();
    trimmed.strip_suffix('/').unwrap_or(trimmed).to_string()
}

fn validate_base_url(raw: &str) -> Result<String, String> {
    let normalized = normalize_base_url(raw);
    if normalized.is_empty() {
        return Ok(normalized);
    }
    let parsed = url::Url::parse(&normalized)
        .map_err(|_| "API taban adresi geçersiz".to_string())?;
    match parsed.scheme() {
        "http" | "https" => Ok(normalized),
        _ => Err("API taban adresi http veya https olmalı".into()),
    }
}
```

**Dependency note:** `url` crate may already come via reqwest. Prefer parsing without new deps: check `normalized.starts_with("http://") || normalized.starts_with("https://")` after normalize if `url` is not a direct dependency — **do not add `url` without asking**. Simple prefix check is enough to match the UI validation spirit.

```rust
fn validate_base_url(raw: &str) -> Result<String, String> {
    let normalized = normalize_base_url(raw);
    if normalized.is_empty() {
        return Ok(normalized);
    }
    if !(normalized.starts_with("http://") || normalized.starts_with("https://")) {
        return Err("API taban adresi http veya https olmalı".into());
    }
    Ok(normalized)
}

fn resolve_endpoint(provider: &LlmProvider, base_url: &str) -> String {
    let base = {
        let n = normalize_base_url(base_url);
        if n.is_empty() {
            match provider {
                LlmProvider::Claude => "https://api.anthropic.com".to_string(),
                LlmProvider::Openai => "https://api.openai.com".to_string(),
            }
        } else {
            n
        }
    };
    let path = match provider {
        LlmProvider::Claude => "/v1/messages",
        LlmProvider::Openai => "/v1/chat/completions",
    };
    format!("{base}{path}")
}
```

- [ ] **Step 3: Validate on `set_llm_settings`**

```rust
pub fn set_llm_settings(app: AppHandle, settings: LlmSettings) -> Result<(), String> {
    let base_url = validate_base_url(&settings.base_url)?;
    write_settings(
        &app,
        &LlmSettings {
            provider: settings.provider,
            model: settings.model,
            base_url,
        },
    )
}
```

- [ ] **Step 4: Pass URL into callers**

Change signatures:

```rust
async fn call_claude(api_key: &str, model: &str, prompt: &str, endpoint: &str) -> Result<String, String>
async fn call_openai(api_key: &str, model: &str, prompt: &str, endpoint: &str) -> Result<String, String>
```

Replace hardcoded `.post("https://…")` with `.post(endpoint)`.

In `summarize_week`:

```rust
let endpoint = resolve_endpoint(&settings.provider, &settings.base_url);
// pass &endpoint into call_claude / call_openai
```

- [ ] **Step 5: `cargo check` in `src-tauri`**

Run: `cd src-tauri && cargo check`

Expected: success. Fix serde: if existing settings JSON lacks `baseUrl`, `#[serde(default)]` must yield `""`.

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add src-tauri/src/llm.rs src/lib/llmBridge.ts
git commit -m "Use configurable LLM base URL for summarize HTTP calls."
```

---

### Task 3: Ayarlar UI

**Files:**
- Modify: `src/views/AyarlarView.tsx`
- Modify: `tests/hafta-ayarlar-ui.test.tsx`

**Interfaces:**
- Consumes: `normalizeBaseUrl`, `validateBaseUrl`, `LlmSettings.baseUrl`
- Produces: field **API taban adresi** persisted with settings

- [ ] **Step 1: Failing UI test**

Append to `tests/hafta-ayarlar-ui.test.tsx`:

```tsx
  it("persists API base URL with settings", async () => {
    const setLlmSettings = vi.fn(async () => undefined);
    const llm = mockLlm({
      hasClaudeApiKey: vi.fn(async () => true),
      setLlmSettings,
      getLlmSettings: vi.fn(async () => ({
        provider: "claude",
        model: "claude-sonnet-4-20250514",
        baseUrl: "",
      })),
    });

    render(<AyarlarView llm={llm} />);

    const input = (await screen.findByLabelText(
      "API taban adresi",
    )) as HTMLInputElement;
    fireEvent.change(input, {
      target: { value: "https://llm.sirket.internal/api/v2/proxy/" },
    });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(setLlmSettings).toHaveBeenCalledWith({
        provider: "claude",
        model: "claude-sonnet-4-20250514",
        baseUrl: "https://llm.sirket.internal/api/v2/proxy",
      });
    });
  });

  it("shows validation error for invalid base URL", async () => {
    const setLlmSettings = vi.fn(async () => undefined);
    const llm = mockLlm({
      hasClaudeApiKey: vi.fn(async () => true),
      setLlmSettings,
    });

    render(<AyarlarView llm={llm} />);

    const input = await screen.findByLabelText("API taban adresi");
    fireEvent.change(input, { target: { value: "not-a-url" } });
    fireEvent.blur(input);

    expect((await screen.findByRole("alert")).textContent).toMatch(
      /geçersiz|http/i,
    );
    expect(setLlmSettings).not.toHaveBeenCalled();
  });
```

Update `mockLlm` default `getLlmSettings` / `setLlmSettings` types if needed so `baseUrl` is allowed.

- [ ] **Step 2: Run — expect FAIL**

Run: `npm test -- tests/hafta-ayarlar-ui.test.tsx -t "API base"`

- [ ] **Step 3: Wire AyarlarView**

1. Import `normalizeBaseUrl`, `validateBaseUrl` from `../lib/llmBaseUrl`.
2. State: `baseUrlDraft`, `baseUrlError`.
3. On load: `setBaseUrlDraft(loaded.baseUrl ?? "")`.
4. Extend `persistSettings` to accept/include `baseUrl`:

```ts
  const persistSettings = async (next: LlmSettings) => {
    const model = normalizeModelId(next.model) || defaultModel(next.provider);
    const baseUrl = normalizeBaseUrl(next.baseUrl ?? "");
    const error = validateBaseUrl(baseUrl);
    if (error) {
      setBaseUrlError(error);
      onToast(error);
      return;
    }
    setBaseUrlError(null);
    const coerced = { provider: next.provider, model, baseUrl };
    setSettings(coerced);
    setModelDraft(model);
    setBaseUrlDraft(baseUrl);
    try {
      await llm.setLlmSettings(coerced);
    } catch (error) {
      onToast(formatError(error, "Ayarlar kaydedilemedi"));
    }
  };
```

Use `formatError` from `../lib/formatError` (same as Hafta).

5. In provider card UI (near model field):

```tsx
        <label className="ayarlar-card__field" htmlFor="llm-base-url">
          API taban adresi
          <input
            autoComplete="off"
            id="llm-base-url"
            onBlur={() => {
              void persistSettings({
                ...settings,
                model: modelDraft,
                baseUrl: baseUrlDraft,
              });
            }}
            onChange={(event) => {
              setBaseUrlDraft(event.target.value);
              setBaseUrlError(null);
            }}
            placeholder="Boş = resmi API (Anthropic / OpenAI)"
            spellCheck={false}
            value={baseUrlDraft}
          />
        </label>
        {baseUrlError ? (
          <p className="form-error" role="alert">
            {baseUrlError}
          </p>
        ) : null}
        <p className="ayarlar-card__hint">
          Şirket adresi yazabilirsin (path prefix dahil). /v1/... yolunu ekleme;
          seçilen sağlayıcıya göre uygulama ekler.
        </p>
```

6. When changing provider, keep `baseUrl` (same company gateway for both wire formats).

7. Initial `useState` for settings may include `baseUrl: ""`.

- [ ] **Step 4: Hint CSS if missing**

If `.ayarlar-card__hint` does not exist, add to `src/styles.css`:

```css
.ayarlar-card__hint {
  margin: 0.35rem 0 0;
  color: #64748b;
  font-size: 0.85rem;
  line-height: 1.35;
}
```

- [ ] **Step 5: Run tests**

Run: `npm test -- tests/llmBaseUrl.test.ts tests/hafta-ayarlar-ui.test.tsx`

Expected: PASS

Run: `npm test` and `cd src-tauri && cargo check`

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add src/views/AyarlarView.tsx src/styles.css tests/hafta-ayarlar-ui.test.tsx
git commit -m "Add API base URL field to Ayarlar."
```

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| `baseUrl` in settings JSON | Task 2 |
| Normalize: trim + trailing `/` only; keep path | Tasks 1–2 |
| Validate http(s) | Tasks 1–3 |
| Resolve Claude/OpenAI endpoints | Tasks 1–2 |
| Empty → official hosts | Tasks 1–2 |
| Ayarlar field + helper copy | Task 3 |
| Keys/headers unchanged | Task 2 (no key file changes) |
| Out of scope items | Not implemented |

## Consistency check

- Field name: `baseUrl` (TS / JSON) ↔ `base_url` (Rust with camelCase serde).
- Error strings: `API taban adresi geçersiz` / `API taban adresi http veya https olmalı`.
