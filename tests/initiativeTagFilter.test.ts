import { describe, expect, it } from "vitest";

import { initiativeMatchesTagFilter } from "../src/lib/initiativeTagFilter";

describe("initiativeMatchesTagFilter", () => {
  const initiative = {
    tags: [
      { id: 1, name: "acil" },
      { id: 2, name: "q3" },
    ],
  };

  it("matches all when no filter selected", () => {
    expect(initiativeMatchesTagFilter(initiative, [])).toBe(true);
  });

  it("requires all selected tags (AND)", () => {
    expect(initiativeMatchesTagFilter(initiative, [1])).toBe(true);
    expect(initiativeMatchesTagFilter(initiative, [1, 2])).toBe(true);
    expect(initiativeMatchesTagFilter(initiative, [1, 3])).toBe(false);
    expect(initiativeMatchesTagFilter(initiative, [3])).toBe(false);
  });
});
