import { describe, expect, it } from "vitest";
import { getWeekRange, shiftWeek } from "../src/lib/weekRange";

describe("weekRange", () => {
  it("returns Monday-local week containing the anchor", () => {
    const anchor = new Date(2026, 8, 9, 15, 30, 0);
    const range = getWeekRange(anchor);
    expect(range.weekStart).toBe("2026-09-07");
    expect(range.startIso).toBe(new Date(2026, 8, 7, 0, 0, 0, 0).toISOString());
    expect(range.endIso).toBe(new Date(2026, 8, 14, 0, 0, 0, 0).toISOString());
  });

  it("shifts week_start by whole weeks", () => {
    expect(shiftWeek("2026-09-07", -1)).toBe("2026-08-31");
    expect(shiftWeek("2026-09-07", 1)).toBe("2026-09-14");
  });
});
