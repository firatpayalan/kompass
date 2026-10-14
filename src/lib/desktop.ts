import type { AppDb } from "../db/createAppDb";
import type { LlmSettings, SummarizeWeekResult } from "./llmBridge";
import type { LlmNotePayloadItem } from "./weeklyDigest";

export type DesktopCommands = {
  "db.initialize": { args: undefined; result: void };
  "db.call": { args: { method: keyof AppDb; args: unknown[] }; result: unknown };
  "db.checkpoint": { args: undefined; result: void };
  "db.close": { args: undefined; result: void };
  "app.version": { args: undefined; result: string };
  "app.close": { args: undefined; result: void };
  "llm.hasKey": { args: { provider: "claude" | "openai" }; result: boolean };
  "llm.saveKey": { args: { provider: "claude" | "openai"; key: string }; result: void };
  "llm.clearKey": { args: { provider: "claude" | "openai" }; result: void };
  "llm.getSettings": { args: undefined; result: LlmSettings };
  "llm.setSettings": { args: LlmSettings; result: void };
  "llm.summarize": { args: { weekStart: string; notes: LlmNotePayloadItem[] }; result: SummarizeWeekResult };
  "backup.pickExport": { args: undefined; result: string | null };
  "backup.pickImport": { args: undefined; result: string | null };
  "backup.export": { args: { password: string; destPath: string }; result: void };
  "backup.verify": { args: { password: string; sourcePath: string }; result: void };
  "backup.import": { args: { password: string; sourcePath: string }; result: void };
  "notification.supported": { args: undefined; result: boolean };
  "notification.show": { args: { title: string; body: string }; result: boolean };
};

export type DesktopReply<T> = { ok: true; value: T } | { ok: false; error: string };
export type DesktopEvent = "quick-note" | "before-close";

export interface DesktopApi {
  request<K extends keyof DesktopCommands>(command: K, args?: DesktopCommands[K]["args"]): Promise<DesktopReply<DesktopCommands[K]["result"]>>;
  on(event: DesktopEvent, callback: () => void): () => void;
  closeReady(saved: boolean): void;
}

declare global {
  interface Window { kompass?: DesktopApi }
}

export function desktopApi(): DesktopApi {
  if (typeof window === "undefined" || !window.kompass) {
    throw new Error("Kompass masaüstü bağlantısı bulunamadı. Uygulamayı npm run dev veya npm start ile açın.");
  }
  return window.kompass;
}

export async function desktopRequest<K extends keyof DesktopCommands>(command: K, args?: DesktopCommands[K]["args"]): Promise<DesktopCommands[K]["result"]> {
  const reply = await desktopApi().request(command, args);
  if (!reply.ok) throw new Error(reply.error);
  return reply.value;
}
