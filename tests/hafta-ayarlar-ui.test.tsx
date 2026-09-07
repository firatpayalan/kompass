// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppDb } from "../src/db/appDb";
import type { LlmBridge } from "../src/lib/llmBridge";
import type { Initiative, Note, Person } from "../src/lib/types";
import { getWeekRange } from "../src/lib/weekRange";
import AyarlarView from "../src/views/AyarlarView";
import HaftaView from "../src/views/HaftaView";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "Ayşe",
  roleOrNotes: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const initiative: Initiative = {
  id: 2,
  name: "Atlas",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-01T00:00:00.000Z",
  lastActivityAt: "2026-09-01T00:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
  tags: [],
};

function noteInCurrentWeek(): Note {
  const { startIso } = getWeekRange(new Date());
  const created = new Date(startIso);
  created.setHours(12);
  return {
    id: 10,
    body: "Haftalık gözlem",
    createdAt: created.toISOString(),
    updatedAt: created.toISOString(),
    deletedAt: null,
    tags: [],
    personIds: [1],
    initiativeIds: [],
    topicIds: [],
    nextReminderDueAt: null,
  };
}

function mockLlm(partial: Partial<LlmBridge> = {}): LlmBridge {
  return {
    hasClaudeApiKey: vi.fn(async () => false),
    saveClaudeApiKey: vi.fn(async () => undefined),
    clearClaudeApiKey: vi.fn(async () => undefined),
    hasOpenaiApiKey: vi.fn(async () => false),
    saveOpenaiApiKey: vi.fn(async () => undefined),
    clearOpenaiApiKey: vi.fn(async () => undefined),
    getLlmSettings: vi.fn(async () => ({
      provider: "claude",
      model: "claude-sonnet-4-20250514",
      baseUrl: "",
    })),
    setLlmSettings: vi.fn(async () => undefined),
    summarizeWeek: vi.fn(async () => ({
      content: "özet metni",
      provider: "claude",
      model: "claude-sonnet-4-20250514",
    })),
    ...partial,
  };
}

describe("Hafta and Ayarlar UI", () => {
  it("lists person notes for the week and hides summarize without keys", async () => {
    const weekNote = noteInCurrentWeek();
    const db = {
      listNotesInRange: vi.fn(async () => [weekNote]),
      listPeople: vi.fn(async () => [person]),
      listInitiatives: vi.fn(async () => [initiative]),
      getWeeklySummary: vi.fn(async () => null),
      upsertWeeklySummary: vi.fn(async () => undefined),
      getNoteImage: vi.fn(async () => null),
    } as unknown as AppDb;

    render(<HaftaView db={db} llm={mockLlm()} />);

    expect(await screen.findByText("Kişiler")).toBeTruthy();
    expect(screen.getByText("Haftalık gözlem")).toBeTruthy();
    expect(screen.getByText(/1 not · 1 kişi · 0 iş/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Özetle" })).toBeNull();
    expect(screen.getByText(/Ayarlar’dan API anahtarı/)).toBeTruthy();
  });

  it("summarizes when a key is available and upserts cache", async () => {
    const weekNote = noteInCurrentWeek();
    const upsertWeeklySummary = vi.fn(async () => undefined);
    const db = {
      listNotesInRange: vi.fn(async () => [weekNote]),
      listPeople: vi.fn(async () => [person]),
      listInitiatives: vi.fn(async () => [initiative]),
      getWeeklySummary: vi.fn(async () => null),
      upsertWeeklySummary,
      getNoteImage: vi.fn(async () => null),
    } as unknown as AppDb;
    const llm = mockLlm({
      hasClaudeApiKey: vi.fn(async () => true),
    });

    render(<HaftaView db={db} llm={llm} />);

    const button = await screen.findByRole("button", { name: "Özetle" });
    fireEvent.click(button);

    await waitFor(() => {
      expect(llm.summarizeWeek).toHaveBeenCalled();
      expect(upsertWeeklySummary).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "özet metni",
          provider: "claude",
          model: "claude-sonnet-4-20250514",
        }),
      );
    });
    expect(await screen.findByText("özet metni")).toBeTruthy();
  });

  it("shows the full summarize error message from a string reject", async () => {
    const weekNote = noteInCurrentWeek();
    const onToast = vi.fn();
    const db = {
      listNotesInRange: vi.fn(async () => [weekNote]),
      listPeople: vi.fn(async () => [person]),
      listInitiatives: vi.fn(async () => [initiative]),
      getWeeklySummary: vi.fn(async () => null),
      upsertWeeklySummary: vi.fn(async () => undefined),
      getNoteImage: vi.fn(async () => null),
    } as unknown as AppDb;
    const detail =
      "Claude API 401: {\"type\":\"error\",\"error\":{\"message\":\"invalid x-api-key\"}}";
    const llm = mockLlm({
      hasClaudeApiKey: vi.fn(async () => true),
      summarizeWeek: vi.fn(async () => {
        throw detail;
      }),
    });

    render(<HaftaView db={db} llm={llm} onToast={onToast} />);

    fireEvent.click(await screen.findByRole("button", { name: "Özetle" }));

    expect((await screen.findByRole("alert")).textContent).toBe(detail);
    expect(onToast).toHaveBeenCalledWith(detail);
  });

  it("saves Claude key and allows free-text model ids", async () => {
    const saveClaudeApiKey = vi.fn(async () => undefined);
    const setLlmSettings = vi.fn(async () => undefined);
    const llm = mockLlm({
      hasClaudeApiKey: vi.fn(async () => false),
      hasOpenaiApiKey: vi.fn(async () => true),
      saveClaudeApiKey,
      setLlmSettings,
      getLlmSettings: vi.fn(async () => ({
        provider: "openai",
        model: "gpt-4.1",
      })),
    });

    render(<AyarlarView llm={llm} />);

    expect(await screen.findByRole("heading", { name: "Özet sağlayıcısı" })).toBeTruthy();
    const modelInput = screen.getByLabelText("Model") as HTMLInputElement;
    expect(modelInput.value).toBe("gpt-4.1");

    fireEvent.change(modelInput, { target: { value: "gpt-4.1-mini" } });
    fireEvent.blur(modelInput);

    await waitFor(() => {
      expect(setLlmSettings).toHaveBeenCalledWith({
        provider: "openai",
        model: "gpt-4.1-mini",
        baseUrl: "",
      });
    });

    const keyInput = screen.getByLabelText("Yeni anahtar", {
      selector: "#claude-api-key",
    });
    fireEvent.change(keyInput, { target: { value: "sk-ant-test" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Kaydet" })[0]);

    await waitFor(() => {
      expect(saveClaudeApiKey).toHaveBeenCalledWith("sk-ant-test");
    });

    fireEvent.change(screen.getByLabelText("Sağlayıcı"), {
      target: { value: "claude" },
    });
    await waitFor(() => {
      expect(setLlmSettings).toHaveBeenCalledWith({
        provider: "claude",
        model: "claude-sonnet-4-20250514",
        baseUrl: "",
      });
    });
  });

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
});
