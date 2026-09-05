import { describe, expect, it } from "vitest";
import {
  reminderUrgency,
  reminderUrgencyLabel,
} from "../src/lib/reminderUrgency";

const noon = (y: number, m: number, d: number) => new Date(y, m, d, 12);

describe("reminderUrgency", () => {
  it("returns null without a due date", () => {
    expect(reminderUrgency(null, noon(2026, 8, 6))).toBeNull();
    expect(reminderUrgency(undefined, noon(2026, 8, 6))).toBeNull();
  });

  it("marks overdue when due day is before today", () => {
    expect(
      reminderUrgency(
        new Date(2026, 8, 5, 23, 59).toISOString(),
        noon(2026, 8, 6),
      ),
    ).toBe("overdue");
  });

  it("marks soon for today through +3 days", () => {
    const now = noon(2026, 8, 6);
    expect(
      reminderUrgency(new Date(2026, 8, 6, 8).toISOString(), now),
    ).toBe("soon");
    expect(
      reminderUrgency(new Date(2026, 8, 9, 18).toISOString(), now),
    ).toBe("soon");
  });

  it("returns null when more than 3 days out", () => {
    expect(
      reminderUrgency(
        new Date(2026, 8, 10, 0).toISOString(),
        noon(2026, 8, 6),
      ),
    ).toBeNull();
  });
});

describe("reminderUrgencyLabel", () => {
  it("describes overdue days", () => {
    expect(
      reminderUrgencyLabel(
        new Date(2026, 8, 1, 10).toISOString(),
        noon(2026, 8, 6),
      ),
    ).toBe("5 gün gecikti");
    expect(
      reminderUrgencyLabel(
        new Date(2026, 8, 5, 10).toISOString(),
        noon(2026, 8, 6),
      ),
    ).toBe("1 gün gecikti");
  });

  it("describes remaining days including today", () => {
    const now = noon(2026, 8, 6);
    expect(
      reminderUrgencyLabel(new Date(2026, 8, 6, 8).toISOString(), now),
    ).toBe("Bugün");
    expect(
      reminderUrgencyLabel(new Date(2026, 8, 7, 8).toISOString(), now),
    ).toBe("1 gün kaldı");
    expect(
      reminderUrgencyLabel(new Date(2026, 8, 8, 8).toISOString(), now),
    ).toBe("2 gün kaldı");
  });

  it("returns null when outside urgency window", () => {
    expect(
      reminderUrgencyLabel(
        new Date(2026, 8, 10, 0).toISOString(),
        noon(2026, 8, 6),
      ),
    ).toBeNull();
  });
});
