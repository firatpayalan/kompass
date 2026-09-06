import { describe, expect, it } from "vitest";
import { defaultModel, normalizeModelId } from "../src/lib/llmModels";

describe("llmModels", () => {
  it("trims free-text model ids", () => {
    expect(normalizeModelId("  gpt-4.1-mini  ")).toBe("gpt-4.1-mini");
    expect(normalizeModelId("")).toBe("");
  });

  it("keeps provider defaults for empty fallbacks", () => {
    expect(defaultModel("openai")).toBe("gpt-4.1");
    expect(defaultModel("claude")).toBe("claude-sonnet-4-20250514");
  });
});
