import { afterEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseService } from "../electron/database";
import { openNodeDatabase } from "../electron/sqlite";
import { resolveDataDirectory } from "../electron/paths";
import { BackupService, recoverInterruptedImport } from "../electron/backup";
import { openBackup, sealBackup } from "../electron/backupFormat";
import { LlmService, resolveEndpoint } from "../electron/llm";
import { createAppDb } from "../src/db/createAppDb";
import { migrateDatabase } from "../src/db/migrateDb";

const cleanup: (() => void)[] = [];
function temp(): string {
  const directory = mkdtempSync(join(tmpdir(), "kompass-node-test-"));
  cleanup.push(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}
async function service(): Promise<DatabaseService> {
  const database = new DatabaseService(temp());
  await database.initialize();
  cleanup.push(() => database.close());
  return database;
}
afterEach(() => { for (const close of cleanup.splice(0).reverse()) close(); });

describe("Node desktop storage", () => {
  it("retains the existing application data location on all desktop platforms", () => {
    expect(resolveDataDirectory("darwin", "/users/test", {})).toBe("/users/test/Library/Application Support/com.dailyleadership.tool");
    expect(resolveDataDirectory("linux", "/home/test", { XDG_CONFIG_HOME: "/config" })).toBe("/config/com.dailyleadership.tool");
    expect(resolveDataDirectory("win32", "/home/test", { APPDATA: "/roaming" })).toBe("/roaming/com.dailyleadership.tool");
    expect(resolveDataDirectory("darwin", "/users/test", { KOMPASS_DATA_DIR: "/sandbox" })).toBe("/sandbox");
  });

  it("serializes concurrent repository operations and persists them across reopen", async () => {
    const db = await service();
    const notes = await Promise.all(Array.from({ length: 25 }, (_, i) => db.exclusive(() => db.call("createNote", [{ body: `Not ${i}` }])))) as { id: number; body: string }[];
    expect(new Set(notes.map((note) => note.id)).size).toBe(25);
    expect(notes.map((note) => note.body)).toEqual(Array.from({ length: 25 }, (_, i) => `Not ${i}`));
    db.close();
    await expect(db.call("listActiveNotes", [])).rejects.toThrow("Yedek geri yükleniyor");
    await db.initialize();
    expect(await db.call("listActiveNotes", [])).toHaveLength(25);
    await expect(db.call("constructor", [])).rejects.toThrow("Geçersiz");
  });

  it("rolls back the note and links if a nested repository operation fails", async () => {
    const db = openNodeDatabase(":memory:");
    cleanup.push(() => db.close());
    await migrateDatabase(db);
    const repo = createAppDb(db);
    await expect(repo.createNote({ body: "Geri alınmalı", personIds: [999999] })).rejects.toThrow();
    expect(await repo.listActiveNotes()).toEqual([]);
  });

  it("rolls back both a todo completion and its generated note", async () => {
    const db = openNodeDatabase(":memory:");
    cleanup.push(() => db.close());
    await migrateDatabase(db);
    const repo = createAppDb(db);
    const work = await repo.createInitiative({ name: "İş", status: "aktif", nowIso: new Date().toISOString() });
    const note = await repo.createNote({ body: "Aksiyon", initiativeIds: [work.id] });
    const todo = await repo.createTodoFromNote(note.id);
    const done = (await repo.listTodoStatuses()).find((status) => status.countsAsComplete)!;
    await db.execute("CREATE TRIGGER reject_todo_update BEFORE UPDATE ON todos BEGIN SELECT RAISE(ABORT, 'test failure'); END");
    await expect(repo.updateTodoStatus(todo.id, done.id)).rejects.toThrow("test failure");
    expect(await repo.listNotesForInitiative(work.id)).toHaveLength(1);
    expect((await repo.listTodos())[0].countsAsComplete).toBe(false);
  });

  it("opens a legacy person-only topics database without losing linked notes", async () => {
    const db = openNodeDatabase(":memory:");
    cleanup.push(() => db.close());
    await db.execute("CREATE TABLE people (id INTEGER PRIMARY KEY, name TEXT NOT NULL, role_or_notes TEXT, created_at TEXT NOT NULL)");
    await db.execute("CREATE TABLE topics (id INTEGER PRIMARY KEY, person_id INTEGER NOT NULL REFERENCES people(id), title TEXT NOT NULL, created_at TEXT NOT NULL)");
    await db.execute("INSERT INTO people VALUES (1, 'Ayşe', NULL, '2026-09-01')");
    await db.execute("INSERT INTO topics VALUES (1, 1, 'Eski konu', '2026-09-01')");
    await migrateDatabase(db);
    const repo = createAppDb(db);
    const note = await repo.createNote({ body: "Eski veri", personIds: [1], topicIds: [1] });
    expect(note.topicIds).toEqual([1]);
    const result = await repo.listTopicsWithNotesForPerson(1);
    expect(result.topics[0].title).toBe("Eski konu");
    expect(result.topics[0].notes[0].body).toBe("Eski veri");
  });
});

describe("encrypted backups in Node", () => {
  it("decrypts a fixture created by the previous Rust KMPS v1 implementation", async () => {
    const fixture = Buffer.from(readFileSync(new URL("./fixtures/legacy-backup-v1.hex", import.meta.url), "utf8").trim(), "hex");
    const files = await openBackup("uyumluluk-parolası", fixture);
    expect(files.map((file) => [file.name, file.data.toString()])).toEqual([
      ["leadership.db", "legacy-test-database"], ["claude_api_key", "sk-fake-compatibility-test"],
    ]);
  });

  it("round trips binary bytes and rejects wrong passwords, tampering and unknown versions", async () => {
    const files = [{ name: "leadership.db", data: Buffer.from([0, 1, 255, 128]) }];
    const blob = await sealBackup("şifre", files);
    expect(await openBackup("şifre", blob)).toEqual(files);
    await expect(openBackup("yanlış", blob)).rejects.toThrow("Parola hatalı");
    const changed = Buffer.from(blob); changed[changed.length - 1] ^= 1;
    await expect(openBackup("şifre", changed)).rejects.toThrow("Parola hatalı");
    changed[4] = 2;
    await expect(openBackup("şifre", changed)).rejects.toThrow("Desteklenmeyen");
    await expect(sealBackup("", files)).rejects.toThrow("Parola boş");
  });

  it("exports archived data, images and keys and restores the complete database", async () => {
    const source = await service();
    const person = await source.call("createPerson", [{ name: "Ayşe", nowIso: new Date().toISOString() }]) as { id: number };
    const note = await source.call("createNote", [{ body: "Arşiv notu", personIds: [person.id] }]) as { id: number };
    await source.call("softDeleteNote", [note.id, new Date().toISOString()]);
    await source.call("archivePerson", [person.id, new Date().toISOString()]);
    await source.call("saveNoteImage", [{ id: "test-image", mime: "image/png", bytesBase64: "aW1hZ2U=", nowIso: new Date().toISOString() }]);
    const llm = new LlmService(source.directory);
    llm.saveKey("claude", "sk-fake-test");
    llm.setSettings({ provider: "claude", model: "internal-model", baseUrl: "https://company.test/llm/prefix" });
    const path = join(temp(), "backup.kompass");
    await new BackupService(source).export("secret", path);
    const dest = await service();
    new LlmService(dest.directory).saveKey("openai", "local-key-to-remove");
    const importer = new BackupService(dest);
    await expect(importer.import("wrong", path)).rejects.toThrow("Parola hatalı");
    expect(new LlmService(dest.directory).hasKey("openai")).toBe(true);
    await importer.import("secret", path);
    expect((await dest.call("getNote", [note.id]) as { deletedAt: string }).deletedAt).toBeTruthy();
    expect(await dest.call("listArchivedPeople", [])).toHaveLength(1);
    expect(await dest.call("getNoteImage", ["test-image"])).toEqual({ mime: "image/png", bytesBase64: "aW1hZ2U=" });
    expect(new LlmService(dest.directory).hasKey("openai")).toBe(false);
    expect(new LlmService(dest.directory).getSettings().baseUrl).toBe("https://company.test/llm/prefix");
  }, 20_000);

  it("leaves live files unchanged when an archive contains a corrupt database", async () => {
    const db = await service();
    await db.call("createNote", [{ body: "Korunmalı" }]);
    const blob = await sealBackup("secret", [{ name: "leadership.db", data: Buffer.from("SQLite format 3\0invalid") }]);
    const path = join(temp(), "broken.kompass"); writeFileSync(path, blob);
    await expect(new BackupService(db).import("secret", path)).rejects.toThrow();
    expect((await db.call("listActiveNotes", []) as { body: string }[])[0].body).toBe("Korunmalı");
  });

  it("rolls back a failed migration after installing an otherwise valid SQLite archive", async () => {
    const db = await service();
    await db.call("createNote", [{ body: "Önceki not" }]);
    const brokenPath = join(temp(), "incompatible.kompass");
    // A valid SQLite file with an incompatible application schema fails after the swap.
    const directory = temp();
    const raw = openNodeDatabase(join(directory, "source.db"));
    await raw.execute("CREATE TABLE notes (id INTEGER PRIMARY KEY)"); raw.checkpoint(); raw.close();
    writeFileSync(brokenPath, await sealBackup("secret", [{ name: "leadership.db", data: readFileSync(join(directory, "source.db")) }]));
    await expect(new BackupService(db).import("secret", brokenPath)).rejects.toThrow();
    expect((await db.call("listActiveNotes", []) as { body: string }[])[0].body).toBe("Önceki not");
    expect(existsSync(join(db.directory, ".kompass-restore"))).toBe(false);
  });

  it("recovers an interrupted multi-file import on next startup", async () => {
    const directory = temp();
    const recovery = join(directory, ".kompass-restore"); mkdirSync(recovery);
    writeFileSync(join(recovery, "leadership.db"), "original-db");
    writeFileSync(join(recovery, "claude_api_key"), "original-key");
    writeFileSync(join(recovery, "manifest.json"), JSON.stringify(["leadership.db", "claude_api_key"]));
    writeFileSync(join(directory, "leadership.db"), "partially-imported-db");
    writeFileSync(join(directory, "openai_api_key"), "incoming-key");
    recoverInterruptedImport(directory);
    expect(readFileSync(join(directory, "leadership.db"), "utf8")).toBe("original-db");
    expect(readFileSync(join(directory, "claude_api_key"), "utf8")).toBe("original-key");
    expect(existsSync(join(directory, "openai_api_key"))).toBe(false);
  });
});

describe("Node LLM services", () => {
  it("keeps corporate host path prefixes for both providers", () => {
    expect(resolveEndpoint({ provider: "claude", model: "model", baseUrl: " https://company.test/agents/claude/ " })).toBe("https://company.test/agents/claude/v1/messages");
    expect(resolveEndpoint({ provider: "openai", model: "model", baseUrl: "http://company.test/prefix" })).toBe("http://company.test/prefix/v1/chat/completions");
    expect(resolveEndpoint({ provider: "openai", model: "" })).toBe("https://api.openai.com/v1/chat/completions");
    expect(() => resolveEndpoint({ provider: "claude", model: "x", baseUrl: "file:///tmp" })).toThrow();
  });

  it.each(["claude", "openai"] as const)("sends %s credentials and custom model only from the Node service", async (provider) => {
    let request: { url: string; init: RequestInit } | undefined;
    const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
      request = { url: String(url), init: init! };
      return Response.json(provider === "claude" ? { content: [{ type: "thinking", thinking: "private" }, { type: "text", text: "Özet" }] } : { choices: [{ message: { content: "Özet" } }] });
    };
    const llm = new LlmService(temp(), fetcher as typeof fetch);
    llm.saveKey(provider, "sk-fake-key");
    llm.setSettings({ provider, model: "company-model", baseUrl: "https://company.test/agents" });
    expect(await llm.summarize({ weekStart: "2026-10-12", notes: [] })).toEqual({ content: "Özet", provider, model: "company-model" });
    expect(request?.url).toContain("https://company.test/agents/v1/");
    expect(JSON.parse(request!.init.body as string).model).toBe("company-model");
    expect(request!.init.headers).toMatchObject(provider === "claude" ? { "x-api-key": "sk-fake-key" } : { Authorization: "Bearer sk-fake-key" });
  });

  it("surfaces the complete provider error body", async () => {
    const llm = new LlmService(temp(), (async () => new Response('{"error":"company gateway unavailable","trace":"abc-123"}', { status: 503, statusText: "Unavailable" })) as typeof fetch);
    llm.saveKey("claude", "sk-fake-key");
    await expect(llm.summarize({ weekStart: "2026-10-12", notes: [] })).rejects.toThrow('Claude hatası (503 Unavailable): {"error":"company gateway unavailable","trace":"abc-123"}');
  });
});
