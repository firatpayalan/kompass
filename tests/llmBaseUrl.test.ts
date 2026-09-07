import { describe, expect, it } from "vitest";
import {
  normalizeBaseUrl,
  resolveLlmEndpoint,
  validateBaseUrl,
} from "../src/lib/llmBaseUrl";

describe("llmBaseUrl", () => {
  it("normalizes whitespace and a single trailing slash without stripping path", () => {
    expect(normalizeBaseUrl("  https://llm.sirket.internal/api/v2/proxy/  ")).toBe(
      "https://llm.sirket.internal/api/v2/proxy",
    );
    expect(normalizeBaseUrl("")).toBe("");
    expect(normalizeBaseUrl("   ")).toBe("");
  });

  it("rejects non-http(s) when non-empty", () => {
    expect(validateBaseUrl("")).toBeNull();
    expect(validateBaseUrl("https://ok.example/path")).toBeNull();
    expect(validateBaseUrl("ftp://x")).toMatch(/geçersiz|http/i);
    expect(validateBaseUrl("not-a-url")).not.toBeNull();
  });

  it("resolves official and custom endpoints", () => {
    expect(resolveLlmEndpoint("claude", "")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
    expect(resolveLlmEndpoint("openai", "")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
    expect(
      resolveLlmEndpoint("claude", "https://llm.sirket.internal/api/v2/proxy"),
    ).toBe("https://llm.sirket.internal/api/v2/proxy/v1/messages");
    expect(
      resolveLlmEndpoint("openai", "https://llm.sirket.internal/api/v2/proxy"),
    ).toBe(
      "https://llm.sirket.internal/api/v2/proxy/v1/chat/completions",
    );
  });
});
