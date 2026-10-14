import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { LlmSettings, SummarizeWeekResult } from "../src/lib/llmBridge";
import type { LlmProvider } from "../src/lib/llmModels";
import type { LlmNotePayloadItem } from "../src/lib/weeklyDigest";
import { writeAtomic } from "./files";

const defaults = { claude: "claude-sonnet-4-20250514", openai: "gpt-4.1" };
const keyFiles = { claude: "claude_api_key", openai: "openai_api_key" };

export function validateSettings(settings: LlmSettings): LlmSettings {
  if (!settings || !Object.hasOwn(defaults, settings.provider) || typeof settings.model !== "string") throw new Error("Geçersiz LLM ayarları");
  const baseUrl = (settings.baseUrl ?? "").trim().replace(/\/$/, "");
  if (baseUrl) {
    let url: URL;
    try { url = new URL(baseUrl); } catch { throw new Error("API taban adresi geçersiz"); }
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("API taban adresi http veya https olmalı");
    if (url.search || url.hash || url.username || url.password) throw new Error("API taban adresi sorgu, fragment veya kullanıcı bilgisi içermemeli");
  }
  return { provider: settings.provider, model: settings.model.trim(), baseUrl };
}

export function resolveEndpoint(settings: LlmSettings): string {
  const checked = validateSettings(settings);
  const base = checked.baseUrl || (checked.provider === "claude" ? "https://api.anthropic.com" : "https://api.openai.com");
  // Concatenate, rather than new URL('/v1/...', base), to preserve corporate path prefixes.
  return base + (checked.provider === "claude" ? "/v1/messages" : "/v1/chat/completions");
}

export class LlmService {
  constructor(private directory: string, private fetcher: typeof fetch = fetch) {}

  private keyPath(provider: LlmProvider): string {
    if (!Object.hasOwn(keyFiles, provider)) throw new Error("Geçersiz LLM sağlayıcısı");
    return join(this.directory, keyFiles[provider]);
  }

  private readKey(provider: LlmProvider): string {
    const filename = this.keyPath(provider);
    return existsSync(filename) ? readFileSync(filename, "utf8").trim() : "";
  }

  hasKey(provider: LlmProvider): boolean { return !!this.readKey(provider); }
  saveKey(provider: LlmProvider, key: string): void {
    if (!key.trim()) throw new Error("API anahtarı boş olamaz");
    writeAtomic(this.keyPath(provider), key.trim());
  }
  clearKey(provider: LlmProvider): void { rmSync(this.keyPath(provider), { force: true }); }

  getSettings(): LlmSettings {
    const filename = join(this.directory, "llm_settings.json");
    if (!existsSync(filename)) return { provider: "claude", model: defaults.claude, baseUrl: "" };
    try { return validateSettings(JSON.parse(readFileSync(filename, "utf8"))); }
    catch (error) { throw new Error(`Ayarlar okunamadı: ${error instanceof Error ? error.message : String(error)}`); }
  }

  setSettings(settings: LlmSettings): void {
    writeAtomic(join(this.directory, "llm_settings.json"), JSON.stringify(validateSettings(settings), null, 2));
  }

  async summarize(input: { weekStart: string; notes: LlmNotePayloadItem[] }): Promise<SummarizeWeekResult> {
    const settings = this.getSettings();
    const provider = settings.provider;
    const label = provider === "claude" ? "Claude" : "OpenAI";
    const key = this.readKey(provider);
    if (!key) throw new Error(`${label} API anahtarı yok. Ayarlar’dan ekleyin.`);
    const model = settings.model || defaults[provider];
    const prompt = `Sen bir liderlik asistanısın. Aşağıdaki haftalık notları Türkçe özetle.
Hafta başlangıcı (Pazartesi): ${input.weekStart}

Çıktı bölümleri:
1) Kişiler
2) İşler
3) Dikkat / aksiyon

Sadece verilen notlara dayan. Uydurma. Görsel veya teknik işaretleri yok say.

Notlar (JSON):
${JSON.stringify(input.notes)}`;
    const body = provider === "claude" ? {
      model, max_tokens: 2048, messages: [{ role: "user", content: prompt }],
    } : {
      model, messages: [{ role: "system", content: "Türkçe liderlik özeti üreten bir asistansın." }, { role: "user", content: prompt }],
    };
    let response: Response;
    try {
      response = await this.fetcher(resolveEndpoint(settings), {
        method: "POST", signal: AbortSignal.timeout(120_000), redirect: "error",
        headers: provider === "claude" ? {
          "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01",
        } : { "content-type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify(body),
      });
    } catch (error) {
      const detail = error instanceof Error ? `${error.message}${error.cause ? `: ${String(error.cause)}` : ""}` : String(error);
      throw new Error(`${label} isteği başarısız: ${detail}`);
    }
    const text = await response.text();
    if (!response.ok) throw new Error(`${label} hatası (${response.status} ${response.statusText}): ${text}`);
    let parsed;
    try { parsed = JSON.parse(text); }
    catch { throw new Error(`${label} JSON yanıtı bozuk: ${text}`); }
    const content = provider === "claude"
      ? parsed.content?.filter((block: { type: string; text?: string }) => block.type === "text").map((block: { text: string }) => block.text).join("\n")
      : parsed.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error(`${label} yanıtında metin yok: ${text}`);
    return { content, provider, model };
  }
}
