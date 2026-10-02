import { describe, expect, it } from "vitest";
import {
  createTodoStatus,
  deleteTodoStatus,
  ensureTodosSchema,
  listTodoStatuses,
} from "../src/db/todosRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("todosRepo statuses", () => {
  it("seeds four builtin statuses", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const statuses = await listTodoStatuses(db);
    expect(statuses.map((s) => s.name)).toEqual([
      "açık",
      "devam",
      "tamamlandı",
      "tamamlanamadı",
    ]);
    expect(statuses.find((s) => s.name === "tamamlandı")?.countsAsComplete).toBe(true);
    expect(statuses.every((s) => s.isBuiltin)).toBe(true);
    db.close();
  });

  it("creates a custom status and rejects deleting builtins or in-use customs later", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const custom = await createTodoStatus(db, {
      name: "Beklemede",
      color: "amber",
      countsAsComplete: false,
    });
    expect(custom.isBuiltin).toBe(false);
    const builtin = (await listTodoStatuses(db)).find((s) => s.name === "açık")!;
    await expect(deleteTodoStatus(db, builtin.id)).rejects.toThrow(
      "Hazır durum silinemez",
    );
    db.close();
  });
});
