import { describe, expect, it } from "vitest";

import { applySchema, splitSqlStatements } from "../src/db/asyncDb";
import { openTestAsyncDb, readSchemaSql } from "../src/db/testDb";

describe("schema", () => {
  it("creates notes table", async () => {
    const db = openTestAsyncDb();

    const rows = await db.select(
      "SELECT name FROM sqlite_master WHERE name = 'notes'",
    );

    expect(rows).toHaveLength(1);
    db.close();
  });

  it("splits trigger bodies into single statements", () => {
    const statements = splitSqlStatements(readSchemaSql());

    expect(statements[0]).toBe("PRAGMA foreign_keys = ON;");
    expect(
      statements.filter((statement) => /CREATE TRIGGER/i.test(statement)),
    ).toHaveLength(3);
    expect(
      statements.find((statement) => /notes_ai/.test(statement)),
    ).toContain("END;");
  });

  it("applies the schema statement by statement", async () => {
    const db = openTestAsyncDb();

    // Re-applying must be idempotent: the app runs it on every startup.
    await applySchema(db, readSchemaSql());

    const rows = await db.select<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'trigger' ORDER BY name",
    );

    expect(rows.map((row) => row.name)).toEqual([
      "notes_ad",
      "notes_ai",
      "notes_au",
    ]);
    db.close();
  });
});
