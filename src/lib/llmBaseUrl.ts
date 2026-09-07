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
