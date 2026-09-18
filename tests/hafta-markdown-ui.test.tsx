// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type { AppDb } from "../src/db/appDb";
import type { LlmBridge } from "../src/lib/llmBridge";
import HaftaView from "../src/views/HaftaView";

afterEach(cleanup);

function mockDb(content: string) {
  return {
    listNotesInRange: vi.fn(async () => []),
    listPeople: vi.fn(async () => []),
    listInitiatives: vi.fn(async () => []),
    getWeeklySummary: vi.fn(async () => ({
      weekStart: "2026-09-15",
      content,
      provider: "openai",
      model: "gpt-4.1",
      createdAt: "2026-09-18T10:00:00.000Z",
    })),
    upsertWeeklySummary: vi.fn(),
    getNoteImage: vi.fn(async () => null),
  } as unknown as AppDb;
}

function mockLlm() {
  return {
    hasClaudeApiKey: vi.fn(async () => false),
    hasOpenaiApiKey: vi.fn(async () => false),
    summarizeWeek: vi.fn(),
    getLlmSettings: vi.fn(async () => ({
      provider: "openai",
      model: "gpt-4.1",
      baseUrl: "",
    })),
    setLlmSettings: vi.fn(),
    saveClaudeApiKey: vi.fn(),
    clearClaudeApiKey: vi.fn(),
    saveOpenaiApiKey: vi.fn(),
    clearOpenaiApiKey: vi.fn(),
  } as unknown as LlmBridge;
}

it("renders Özet markdown as headings and lists", async () => {
  const content = `## Kişiler\n\n- **Ayşe:** not\n\n## İşler\n\n1. Bir`;
  render(<HaftaView db={mockDb(content)} llm={mockLlm()} />);

  const ozet = await screen.findByRole("region", { name: "Özet" });
  await waitFor(() => {
    expect(
      within(ozet).getByRole("heading", { name: "Kişiler", level: 2 }),
    ).toBeTruthy();
  });
  expect(within(ozet).getByText("Ayşe:")).toBeTruthy();
  expect(within(ozet).queryByText(/\*\*Ayşe:\*\*/)).toBeNull();
  expect(within(ozet).getAllByRole("list").length).toBeGreaterThanOrEqual(1);
});

it("opens Özet markdown links in a new tab with noreferrer noopener", async () => {
  const content = `[kaynak](https://example.com/page)`;
  render(<HaftaView db={mockDb(content)} llm={mockLlm()} />);

  const ozet = await screen.findByRole("region", { name: "Özet" });
  const link = await within(ozet).findByRole("link", { name: "kaynak" });
  expect(link.getAttribute("href")).toBe("https://example.com/page");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noreferrer noopener");
});
