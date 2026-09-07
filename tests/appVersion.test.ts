import { describe, expect, it, vi } from "vitest";

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

  it("prefers the Tauri version when available", async () => {
    expect(
      await resolveAppVersion(async () => "9.9.9"),
    ).toBe("9.9.9");
  });

  it("falls back to package.json when Tauri fails", async () => {
    expect(
      await resolveAppVersion(async () => {
        throw new Error("not in tauri");
      }),
    ).toBe(packageJson.version);
  });
});
