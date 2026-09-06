import { describe, expect, it } from "vitest";
import { formatError, isDuplicateNameError } from "../src/lib/formatError";

describe("formatError", () => {
  it("prefers Error message and string payloads", () => {
    expect(formatError(new Error("SQLite hata"), "yok")).toBe("SQLite hata");
    expect(formatError("izin yok", "yok")).toBe("izin yok");
    expect(formatError({ message: "plugin denied" }, "yok")).toBe(
      "plugin denied",
    );
  });

  it("falls back when empty", () => {
    expect(formatError(null, "Kişi eklenemedi")).toBe("Kişi eklenemedi");
    expect(formatError({}, "Kişi eklenemedi")).toBe("Kişi eklenemedi");
  });

  it("detects duplicate name errors", () => {
    expect(isDuplicateNameError(new Error("Bu isimde kayıt var"))).toBe(true);
    expect(isDuplicateNameError("başka")).toBe(false);
  });
});
