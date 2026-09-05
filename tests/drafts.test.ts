import { describe, it, expect } from "vitest";
import { createDraftStore } from "../src/lib/drafts";

describe("createDraftStore", () => {
  it("stores and clears a draft", () => {
    const d = createDraftStore();
    expect(d.getDraft()).toBeNull();
    d.saveDraft("yarım not");
    expect(d.getDraft()).toBe("yarım not");
    d.clearDraft();
    expect(d.getDraft()).toBeNull();
  });
});
