import { describe, expect, it } from "vitest";

import {
  formatVersionLabel,
  resolveAppVersion,
} from "../src/lib/appVersion";
import packageJson from "../package.json";

describe("appVersion", () => {
  it("formats with a v prefix", () => {
    expect(formatVersionLabel("0.1.2")).toBe("v0.1.2");
    expect(formatVersionLabel("v0.1.2")).toBe("v0.1.2");
  });

  it("prefers the desktop version when available", async () => {
    expect(
      await resolveAppVersion(async () => "9.9.9"),
    ).toBe("9.9.9");
  });

  it("falls back to package.json when desktop fails", async () => {
    expect(
      await resolveAppVersion(async () => {
        throw new Error("not in desktop");
      }),
    ).toBe(packageJson.version);
  });
});
