export type LlmProvider = "claude" | "openai";

export type LlmModelOption = { id: string; label: string };

export const CLAUDE_MODELS: LlmModelOption[] = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { id: "claude-haiku-4-20250414", label: "Claude Haiku 4" },
];

export const OPENAI_MODELS: LlmModelOption[] = [
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "o4-mini", label: "o4-mini" },
];

export function modelsFor(provider: LlmProvider): LlmModelOption[] {
  return provider === "claude" ? CLAUDE_MODELS : OPENAI_MODELS;
}

export function defaultModel(provider: LlmProvider): string {
  return modelsFor(provider)[0].id;
}

export function normalizeModelId(model: string): string {
  return model.trim();
}
