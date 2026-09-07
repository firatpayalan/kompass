import { invoke } from "@tauri-apps/api/core";
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
  return invoke<boolean>("has_claude_api_key");
}

export async function saveClaudeApiKey(key: string): Promise<void> {
  await invoke("save_claude_api_key", { key });
}

export async function clearClaudeApiKey(): Promise<void> {
  await invoke("clear_claude_api_key");
}

export async function hasOpenaiApiKey(): Promise<boolean> {
  return invoke<boolean>("has_openai_api_key");
}

export async function saveOpenaiApiKey(key: string): Promise<void> {
  await invoke("save_openai_api_key", { key });
}

export async function clearOpenaiApiKey(): Promise<void> {
  await invoke("clear_openai_api_key");
}

export async function getLlmSettings(): Promise<LlmSettings> {
  return invoke<LlmSettings>("get_llm_settings");
}

export async function setLlmSettings(settings: LlmSettings): Promise<void> {
  await invoke("set_llm_settings", { settings });
}

export async function summarizeWeek(input: {
  weekStart: string;
  notes: LlmNotePayloadItem[];
}): Promise<SummarizeWeekResult> {
  return invoke<SummarizeWeekResult>("summarize_week", {
    weekStart: input.weekStart,
    notesJson: JSON.stringify(input.notes),
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
