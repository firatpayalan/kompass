// tests/tags.test.ts
import { describe, it, expect } from "vitest";
import { parseHashtags } from "../src/lib/tags";

describe("parseHashtags", () => {
  it("extracts unique lowercased tags", () => {
    expect(parseHashtags("Ali ile #1:1 ve #Geri-Bildirim #1:1")).toEqual([
      "1:1",
      "geri-bildirim",
    ]);
  });

  it("returns empty for no tags", () => {
    expect(parseHashtags("sadece metin")).toEqual([]);
  });
});
