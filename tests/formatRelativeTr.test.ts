import { describe, expect, it } from "vitest";
import { formatRelativeTr } from "../src/lib/formatRelativeTr";

describe("formatRelativeTr", () => {
  const now = new Date("2026-09-06T12:00:00.000Z");

  it("returns az önce under one minute", () => {
    expect(formatRelativeTr("2026-09-06T11:59:30.000Z", now)).toBe("az önce");
  });

  it("returns minutes", () => {
    expect(formatRelativeTr("2026-09-06T11:59:00.000Z", now)).toBe(
      "1 dakika önce",
    );
    expect(formatRelativeTr("2026-09-06T11:48:00.000Z", now)).toBe(
      "12 dakika önce",
    );
  });

  it("returns hours", () => {
    expect(formatRelativeTr("2026-09-06T11:00:00.000Z", now)).toBe(
      "1 saat önce",
    );
    expect(formatRelativeTr("2026-09-06T07:00:00.000Z", now)).toBe(
      "5 saat önce",
    );
  });

  it("returns days under a week", () => {
    expect(formatRelativeTr("2026-09-05T12:00:00.000Z", now)).toBe(
      "1 gün önce",
    );
    expect(formatRelativeTr("2026-09-03T12:00:00.000Z", now)).toBe(
      "3 gün önce",
    );
  });

  it("returns short date at seven days or more", () => {
    const label = formatRelativeTr("2026-08-30T12:00:00.000Z", now);
    expect(label).toMatch(/30/);
    expect(label).toMatch(/2026/);
    expect(label).not.toMatch(/önce/);
  });
});
