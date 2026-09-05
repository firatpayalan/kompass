import { describe, expect, it } from "vitest";
import {
  formatNoteImageMarker,
  insertAtCursor,
  isAllowedNoteImageMime,
  splitNoteBody,
} from "../src/lib/noteImages";

describe("noteImages helpers", () => {
  it("formats and splits markers", () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const marker = formatNoteImageMarker(id);
    expect(marker).toBe(`![görsel](dlt-img:${id})`);
    expect(splitNoteBody(`Merhaba\n${marker}\nson`)).toEqual([
      { type: "text", value: "Merhaba\n" },
      { type: "image", id },
      { type: "text", value: "\nson" },
    ]);
  });

  it("inserts at cursor", () => {
    expect(insertAtCursor("ab", 1, 1, "X")).toEqual({ next: "aXb", caret: 2 });
  });

  it("allows known image mimes", () => {
    expect(isAllowedNoteImageMime("image/png")).toBe(true);
    expect(isAllowedNoteImageMime("text/plain")).toBe(false);
  });
});
