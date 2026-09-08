import { describe, it, expect } from "vitest";
import {
  advanceDueAtAfterCompletion,
  isDue,
  nextDueAt,
} from "../src/lib/reminders";

describe("isDue", () => {
  it("is true when dueAt <= now", () => {
    expect(isDue("2026-09-05T10:00:00.000Z", new Date("2026-09-05T11:00:00.000Z"))).toBe(true);
  });
  it("is false when dueAt > now", () => {
    expect(isDue("2026-09-05T12:00:00.000Z", new Date("2026-09-05T11:00:00.000Z"))).toBe(false);
  });
});

describe("nextDueAt", () => {
  it("returns null for once after due", () => {
    expect(
      nextDueAt("2026-09-01T10:00:00.000Z", "once", new Date("2026-09-05T10:00:00.000Z")),
    ).toBeNull();
  });
  it("advances daily until after now", () => {
    const next = nextDueAt(
      "2026-09-01T10:00:00.000Z",
      "daily",
      new Date("2026-09-05T09:00:00.000Z"),
    );
    expect(next).toBe("2026-09-05T10:00:00.000Z");
  });
});

describe("advanceDueAtAfterCompletion", () => {
  it("always skips the current occurrence even when it is still upcoming", () => {
    expect(
      advanceDueAtAfterCompletion(
        "2026-09-08T10:00:00.000Z",
        "weekly",
        new Date("2026-09-05T12:00:00.000Z"),
      ),
    ).toBe("2026-09-15T10:00:00.000Z");
  });
});
