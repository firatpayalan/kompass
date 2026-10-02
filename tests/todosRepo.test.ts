import { describe, expect, it } from "vitest";
import { createInitiative } from "../src/db/initiativesRepo";
import { createNote, listNotesForInitiative } from "../src/db/notesRepo";
import {
  createTodoFromNote,
  createTodoStatus,
  deleteTodoStatus,
  ensureTodosSchema,
  listTodoStatuses,
  listTodos,
  updateTodoStatus,
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

describe("todosRepo todos", () => {
  it("creates a todo from a note and rejects duplicates", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const note = await createNote(db, {
      body: "RFC yaz",
      nowIso: "2026-10-02T10:00:00.000Z",
    });
    const todo = await createTodoFromNote(db, note.id, "2026-10-02T10:01:00.000Z");
    expect(todo.title).toBe("RFC yaz");
    expect(todo.completedAt).toBeNull();
    await expect(createTodoFromNote(db, note.id)).rejects.toThrow(
      "Bu not zaten bir to-do",
    );
    await expect(createTodoFromNote(db, 9999)).rejects.toThrow("Not bulunamadı");
    db.close();
  });

  it("lists todos with status, links and completion filter", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const initiative = await createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      nowIso: "2026-10-02T09:00:00.000Z",
    });
    const n1 = await createNote(db, {
      body: "Bir",
      initiativeIds: [initiative.id],
      nowIso: "2026-10-02T10:00:00.000Z",
    });
    const n2 = await createNote(db, {
      body: "İki",
      nowIso: "2026-10-02T10:00:00.000Z",
    });
    const t1 = await createTodoFromNote(db, n1.id, "2026-10-02T10:01:00.000Z");
    await createTodoFromNote(db, n2.id, "2026-10-02T10:02:00.000Z");
    const done = (await listTodoStatuses(db)).find((s) => s.name === "tamamlandı")!;
    await updateTodoStatus(db, t1.id, done.id, {
      nowIso: "2026-10-02T11:00:00.000Z",
    });
    const all = await listTodos(db);
    expect(all.map((t) => t.title)).toEqual(["Bir", "İki"]);
    expect(all[0].statusName).toBe("tamamlandı");
    expect(all[0].countsAsComplete).toBe(true);
    expect(all[0].initiativeIds).toEqual([initiative.id]);
    expect(all[1].statusName).toBe("açık");
    expect((await listTodos(db, { completion: "open" })).map((t) => t.title)).toEqual(["İki"]);
    expect((await listTodos(db, { completion: "done" })).map((t) => t.title)).toEqual(["Bir"]);
    db.close();
  });

  it("writes a completion note to the single linked initiative", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const initiative = await createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      nowIso: "2026-10-02T09:00:00.000Z",
    });
    const note = await createNote(db, {
      body: "Checklist bitir",
      initiativeIds: [initiative.id],
      nowIso: "2026-10-02T10:00:00.000Z",
    });
    const todo = await createTodoFromNote(db, note.id, "2026-10-02T10:01:00.000Z");
    const done = (await listTodoStatuses(db)).find((s) => s.name === "tamamlandı")!;
    const updated = await updateTodoStatus(db, todo.id, done.id, {
      nowIso: "2026-10-02T11:00:00.000Z",
    });
    expect(updated.completedAt).toBe("2026-10-02T11:00:00.000Z");
    const notes = await listNotesForInitiative(db, initiative.id);
    expect(
      notes.some((n) => n.body === "To-do tamamlandı: “Checklist bitir”"),
    ).toBe(true);
    await updateTodoStatus(db, todo.id, done.id, {
      nowIso: "2026-10-02T12:00:00.000Z",
    });
    const notesAfter = await listNotesForInitiative(db, initiative.id);
    expect(
      notesAfter.filter((n) => n.body.startsWith("To-do tamamlandı:")).length,
    ).toBe(1);
    db.close();
  });

  it("clears completed_at when moving back to a non-complete status", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const note = await createNote(db, { body: "Geri al" });
    const todo = await createTodoFromNote(db, note.id);
    const statuses = await listTodoStatuses(db);
    const done = statuses.find((s) => s.name === "tamamlandı")!;
    const open = statuses.find((s) => s.name === "devam")!;
    await updateTodoStatus(db, todo.id, done.id);
    const reopened = await updateTodoStatus(db, todo.id, open.id);
    expect(reopened.completedAt).toBeNull();
    expect(reopened.statusId).toBe(open.id);
    db.close();
  });

  it("requires initiativeId when completing with multiple linked initiatives", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const a = await createInitiative(db, { name: "A", status: "aktif", nowIso: "2026-10-02T09:00:00.000Z" });
    const b = await createInitiative(db, { name: "B", status: "aktif", nowIso: "2026-10-02T09:01:00.000Z" });
    const note = await createNote(db, {
      body: "Çoklu iş",
      initiativeIds: [a.id, b.id],
      nowIso: "2026-10-02T10:00:00.000Z",
    });
    const todo = await createTodoFromNote(db, note.id, "2026-10-02T10:01:00.000Z");
    const done = (await listTodoStatuses(db)).find((s) => s.name === "tamamlandı")!;
    await expect(updateTodoStatus(db, todo.id, done.id)).rejects.toThrow(
      "İş seçimi gerekli",
    );
    // failed attempt must not leave the todo half-completed
    expect((await listTodos(db, { completion: "done" }))).toHaveLength(0);
    const updated = await updateTodoStatus(db, todo.id, done.id, {
      initiativeId: b.id,
      nowIso: "2026-10-02T11:00:00.000Z",
    });
    expect(updated.completedAt).toBeTruthy();
    const notesB = await listNotesForInitiative(db, b.id);
    expect(notesB.some((n) => n.body.includes("Çoklu iş"))).toBe(true);
    db.close();
  });

  it("completes with zero initiatives without writing a note", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const note = await createNote(db, {
      body: "Inbox işi",
      nowIso: "2026-10-02T10:00:00.000Z",
    });
    const todo = await createTodoFromNote(db, note.id);
    const done = (await listTodoStatuses(db)).find((s) => s.name === "tamamlandı")!;
    const updated = await updateTodoStatus(db, todo.id, done.id);
    expect(updated.completedAt).toBeTruthy();
    expect(await listTodos(db, { completion: "done" })).toHaveLength(1);
    db.close();
  });

  it("rejects deleting a custom status that is in use", async () => {
    const db = openTestAsyncDb();
    await ensureTodosSchema(db);
    const custom = await createTodoStatus(db, {
      name: "Beklemede",
      color: "amber",
      countsAsComplete: false,
    });
    const note = await createNote(db, { body: "Kullanımda" });
    const todo = await createTodoFromNote(db, note.id);
    await updateTodoStatus(db, todo.id, custom.id);
    await expect(deleteTodoStatus(db, custom.id)).rejects.toThrow(
      "Durum kullanımda",
    );
    db.close();
  });
});
