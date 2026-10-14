import { desktopRequest } from "./desktop";
import type { LlmProvider } from "./llmModels";
import type { LlmNotePayloadItem } from "./weeklyDigest";

export type LlmSettings = {
  provider: LlmProvider;
  model: string;
  baseUrl?: string;
};

export type SummarizeWeekResult = {
  content: string;
  provider: LlmProvider;
  model: string;
};

export async function hasClaudeApiKey(): Promise<boolean> {
  return desktopRequest("llm.hasKey", { provider: "claude" });
}

export async function saveClaudeApiKey(key: string): Promise<void> {
  await desktopRequest("llm.saveKey", { provider: "claude", key });
}

export async function clearClaudeApiKey(): Promise<void> {
  await desktopRequest("llm.clearKey", { provider: "claude" });
}

export async function hasOpenaiApiKey(): Promise<boolean> {
  return desktopRequest("llm.hasKey", { provider: "openai" });
}

export async function saveOpenaiApiKey(key: string): Promise<void> {
  await desktopRequest("llm.saveKey", { provider: "openai", key });
}

export async function clearOpenaiApiKey(): Promise<void> {
  await desktopRequest("llm.clearKey", { provider: "openai" });
}

export async function getLlmSettings(): Promise<LlmSettings> {
  return desktopRequest("llm.getSettings");
}

export async function setLlmSettings(settings: LlmSettings): Promise<void> {
  await desktopRequest("llm.setSettings", settings);
}

export async function summarizeWeek(input: {
  weekStart: string;
  notes: LlmNotePayloadItem[];
}): Promise<SummarizeWeekResult> {
  return desktopRequest("llm.summarize", {
    weekStart: input.weekStart,
    notes: input.notes,
  });
}

export type LlmBridge = {
  hasClaudeApiKey: typeof hasClaudeApiKey;
  saveClaudeApiKey: typeof saveClaudeApiKey;
  clearClaudeApiKey: typeof clearClaudeApiKey;
  hasOpenaiApiKey: typeof hasOpenaiApiKey;
  saveOpenaiApiKey: typeof saveOpenaiApiKey;
  clearOpenaiApiKey: typeof clearOpenaiApiKey;
  getLlmSettings: typeof getLlmSettings;
  setLlmSettings: typeof setLlmSettings;
  summarizeWeek: typeof summarizeWeek;
};

export const defaultLlmBridge: LlmBridge = {
  hasClaudeApiKey,
  saveClaudeApiKey,
  clearClaudeApiKey,
  hasOpenaiApiKey,
  saveOpenaiApiKey,
  clearOpenaiApiKey,
  getLlmSettings,
  setLlmSettings,
  summarizeWeek,
};
