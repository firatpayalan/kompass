import { describe, expect, it } from "vitest";
import { coerceModel } from "../src/lib/llmModels";

describe("llmModels", () => {
  it("falls back to provider default when model is foreign", () => {
    expect(coerceModel("openai", "claude-sonnet-4-20250514")).toBe("gpt-4.1");
    expect(coerceModel("claude", "gpt-4.1")).toBe("claude-sonnet-4-20250514");
  });
});
