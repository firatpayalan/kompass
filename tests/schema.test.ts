import { describe, expect, it } from "vitest";

import { openTestDb } from "../src/db/testDb";

describe("schema", () => {
  it("creates notes table", () => {
    const db = openTestDb();

    const row = db
      .prepare("SELECT name FROM sqlite_master WHERE name = 'notes'")
      .get();

    expect(row).toBeTruthy();
    db.close();
  });
});
