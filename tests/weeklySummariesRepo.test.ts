import { describe, expect, it } from "vitest";
import {
  ensureWeeklySummariesTable,
  getWeeklySummary,
  upsertWeeklySummary,
} from "../src/db/weeklySummariesRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("weeklySummariesRepo", () => {
  it("upserts summary by week_start", async () => {
    const db = openTestAsyncDb();
    await ensureWeeklySummariesTable(db);
    await upsertWeeklySummary(db, {
      weekStart: "2026-09-07",
      content: "ilk",
      provider: "claude",
      model: "claude-test",
      createdAt: "2026-09-08T10:00:00.000Z",
    });
    await upsertWeeklySummary(db, {
      weekStart: "2026-09-07",
      content: "ikinci",
      provider: "openai",
      model: "gpt-4.1",
      createdAt: "2026-09-08T11:00:00.000Z",
    });
    expect(await getWeeklySummary(db, "2026-09-07")).toEqual({
      weekStart: "2026-09-07",
      content: "ikinci",
      provider: "openai",
      model: "gpt-4.1",
      createdAt: "2026-09-08T11:00:00.000Z",
    });
    expect(await getWeeklySummary(db, "2026-08-31")).toBeNull();
    db.close();
  });
});
