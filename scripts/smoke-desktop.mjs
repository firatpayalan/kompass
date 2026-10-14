import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { once } from "node:events";
import assert from "node:assert/strict";
import electron from "electron";

let server;
if (process.argv.includes("--dev")) {
  const { createServer } = await import("vite");
  server = await createServer({ server: { port: 0, strictPort: false } });
  await server.listen();
}

// Test the actual Chromium -> sandboxed preload -> Node IPC path using disposable data.
const directory = mkdtempSync(join(tmpdir(), "kompass-desktop-smoke-"));
const env = { ...process.env, KOMPASS_DATA_DIR: directory };
if (server) env.KOMPASS_DEV_URL = server.resolvedUrls.local[0];
delete env.ELECTRON_RUN_AS_NODE;
const executable = process.env.KOMPASS_SMOKE_EXECUTABLE || electron;
const args = process.env.KOMPASS_SMOKE_EXECUTABLE ? [] : [resolve(".")];
const child = spawn(executable, [...args, "--remote-debugging-port=0"], { env, stdio: ["ignore", "pipe", "pipe"] });
let logs = "";
let exitObserved = false;
const exited = new Promise((resolve) => {
  child.once("exit", (code, signal) => { exitObserved = true; resolve({ code, signal }); });
  child.once("error", (error) => { logs += String(error); exitObserved = true; resolve({ error }); });
});
child.stdout.on("data", (data) => { logs += data; });
child.stderr.on("data", (data) => { logs += data; });
let socket;
const pending = new Map();
let id = 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(operation, message, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (exitObserved) throw new Error(`Electron exited ${child.exitCode ?? child.signalCode}\n${logs}`);
    try { const value = await operation(); if (value) return value; } catch { /* readiness check */ }
    await wait(100);
  }
  throw new Error(`${message}\n${logs}`);
}
function cdp(method, params = {}) {
  const commandId = ++id;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { pending.delete(commandId); reject(new Error(`CDP timeout: ${method}`)); }, 15_000);
    pending.set(commandId, { resolve: (value) => { clearTimeout(timeout); resolve(value); }, reject });
    socket.send(JSON.stringify({ id: commandId, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function request(command, args) {
  const result = await evaluate(`window.kompass.request(${JSON.stringify(command)}, ${JSON.stringify(args) ?? "undefined"})`);
  assert.equal(result.ok, true, result.error);
  return result.value;
}

try {
  const port = await until(() => readFileSync(join(directory, "DevToolsActivePort"), "utf8").split("\n")[0], "Debugging port not ready");
  const page = await until(async () => (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()).find((page) => page.type === "page"), "Page not ready");
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await once(socket, "open");
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data);
    const call = pending.get(message.id);
    if (!call) return;
    pending.delete(message.id);
    if (message.error) call.reject(new Error(JSON.stringify(message.error)));
    else call.resolve(message.result);
  });
  await until(() => evaluate("!!window.kompass && !!document.querySelector('.app-shell')"), "App did not mount");
  assert.equal(await evaluate("typeof window.require"), "undefined");
  assert.equal(await evaluate("typeof window.process"), "undefined");
  assert.equal(await request("app.version"), JSON.parse(readFileSync("package.json", "utf8")).version);
  const nowIso = new Date().toISOString();
  const person = await request("db.call", { method: "createPerson", args: [{ name: "Smoke Person", nowIso }] });
  const work = await request("db.call", { method: "createInitiative", args: [{ name: "Smoke Work", status: "aktif", nowIso }] });
  const topic = await request("db.call", { method: "createTopic", args: [{ title: "Smoke Topic", initiativeId: work.id }] });
  const note = await request("db.call", { method: "createNote", args: [{ body: "Smoke note", personIds: [person.id], initiativeIds: [work.id], topicIds: [topic.id] }] });
  assert.equal(note.body, "Smoke note");
  await request("db.call", { method: "updateNote", args: [note.id, "Updated note"] });
  const reminder = await request("db.call", { method: "createReminder", args: [{
    targetType: "note", targetId: note.id, period: "once", nowIso,
    dueAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  }] });
  // IPC must preserve real Date objects used by the reminder repositories.
  const due = await evaluate("window.kompass.request('db.call', {method:'listDueRemindersForBugun',args:[new Date()]})");
  assert.equal(due.ok, true, due.error);
  assert.equal(due.value.some((item) => item.id === reminder.id), true);
  await request("db.call", { method: "markReminderDone", args: [reminder.id] });
  const todo = await request("db.call", { method: "createTodoFromNote", args: [note.id] });
  const statuses = await request("db.call", { method: "listTodoStatuses", args: [] });
  await request("db.call", { method: "updateTodoStatus", args: [todo.id, statuses.find((status) => status.countsAsComplete).id] });
  await request("db.call", { method: "searchNotes", args: ["Updated"] });
  await request("llm.saveKey", { provider: "claude", key: "sk-fake-smoke-key" });
  await request("llm.setSettings", { provider: "claude", model: "internal", baseUrl: "https://company.test/agents/prefix" });
  const backup = join(directory, "smoke.kompass");
  await request("backup.export", { password: "smoke-secret", destPath: backup });
  await request("db.call", { method: "createNote", args: [{ body: "Not in backup" }] });
  await request("backup.import", { password: "smoke-secret", sourcePath: backup });
  assert.equal((await request("db.call", { method: "listActiveNotes", args: [] })).some((note) => note.body === "Not in backup"), false);
  assert.equal((await request("llm.getSettings")).baseUrl, "https://company.test/agents/prefix");
  const legacyHex = readFileSync("tests/fixtures/legacy-backup-v1.hex", "utf8").trim();
  // Exercise the same crypto bundle on Electron's Node runtime, not only the host Node.
  const legacyPath = join(directory, "legacy.kompass");
  writeFileSync(legacyPath, Buffer.from(legacyHex, "hex"));
  const wrong = await evaluate(`window.kompass.request('backup.verify', {password:'wrong', sourcePath:${JSON.stringify(legacyPath)}})`);
  assert.equal(wrong.ok, false);
  assert.match(wrong.error, /Parola hatalı/);
  const legacy = await evaluate(`window.kompass.request('backup.verify', {password:'uyumluluk-parolası', sourcePath:${JSON.stringify(legacyPath)}})`);
  // The old fixture decrypts successfully; its synthetic DB payload is intentionally not SQLite.
  assert.equal(legacy.error, "Yedekteki veritabanı geçersiz");
  const refused = await evaluate("window.kompass.request('db.call', {method:'constructor',args:[]})");
  assert.equal(refused.ok, false);
  if (process.env.KOMPASS_VISUAL_DIR) {
    const output = resolve(process.env.KOMPASS_VISUAL_DIR);
    mkdirSync(output, { recursive: true });
    const people = [];
    for (const [name, roleOrNotes] of [["Deniz Yılmaz", "Yazılım mühendisi · Backend"], ["Selin Kaya", "Yazılım mühendisi · Frontend"], ["Mert Demir", "Mühendislik lideri"]]) {
      people.push(await request("db.call", { method: "createPerson", args: [{ name, roleOrNotes, nowIso }] }));
    }
    const works = [];
    for (const [name, status] of [["Yeni onboarding deneyimi", "aktif"], ["API performans iyileştirmeleri", "beklemede"], ["Q4 teknik yol haritası", "aktif"]]) {
      works.push(await request("db.call", { method: "createInitiative", args: [{ name, status, nowIso }] }));
    }
    const designTopic = await request("db.call", { method: "createTopic", args: [{ title: "İlk hafta deneyimi", initiativeId: works[0].id }] });
    const entries = [
      { body: "İlk kullanım akışını birlikte gözden geçirdik. Karşılama ekranını sadeleştirip kullanıcıya ilk adımı daha net göstereceğiz.", initiativeIds: [works[0].id], topicIds: [designTopic.id], personIds: [people[1].id], due: 0 },
      { body: "API gecikmelerinin kaynağı analiz edildi. Veritabanı indeksleri için hazırlanan önerileri ekip toplantısında değerlendirelim.", initiativeIds: [works[1].id], personIds: [people[0].id], due: -2 },
      { body: "1:1 görüşmesinde önümüzdeki çeyreğin gelişim hedeflerini konuştuk. Teknik mentorluk için haftalık bir saat ayıracağız.", personIds: [people[0].id], due: 2 },
      { body: "Yol haritasının ilk taslağı hazır. Öncelikleri netleştirmek için ürün ekibiyle ortak bir oturum planlayalım.", initiativeIds: [works[2].id], personIds: [people[2].id], due: 4 },
    ];
    for (const entry of entries) {
      const created = await request("db.call", { method: "createNote", args: [entry] });
      const date = new Date(); date.setDate(date.getDate() + entry.due); date.setHours(23, 30, 0, 0);
      await request("db.call", { method: "createReminder", args: [{ targetType: "note", targetId: created.id, dueAt: date.toISOString(), period: "once", nowIso }] });
      await request("db.call", { method: "addTagToNote", args: [created.id, { name: entry.due < 0 ? "Takip" : "Toplantı", color: entry.due < 0 ? "amber" : "teal" }] });
    }
    await request("db.call", { method: "addTagToInitiative", args: [works[0].id, { name: "Ürün", color: "teal" }] });
    await request("db.call", { method: "createNote", args: [{ body: "Toplantıdan sonra düzenle: cuma günü yapılacak demo için akışın son halini kontrol et." }] });
    await cdp("Page.reload");
    await until(() => evaluate("!!document.querySelector('.app-shell') && document.body.innerText.includes('Yol haritasının ilk taslağı')"), "Visual review data not loaded");
    const capture = async (name) => {
      await wait(200);
      const layout = await evaluate("({width: window.innerWidth, content: document.documentElement.scrollWidth})");
      assert.ok(layout.content <= layout.width + 1, `${name}: horizontal overflow ${JSON.stringify(layout)}`);
      const screenshot = await cdp("Page.captureScreenshot", { format: "png" });
      writeFileSync(join(output, `${name}.png`), Buffer.from(screenshot.data, "base64"));
    };
    await capture("bugun");
    for (const [label, heading, name] of [["İşler", "İşler", "isler"], ["Kişiler", "Kişiler", "kisiler"], ["Notlar", "Notlar", "notlar"], ["Gelen", "Gelen", "gelen"], ["Yapılacaklar", "Yapılacaklar", "yapilacaklar"], ["Hafta", "Hafta", "hafta"], ["Ayarlar", "Ayarlar", "ayarlar"]]) {
      await evaluate(`Array.from(document.querySelectorAll('.sidebar__item')).find(button => button.textContent.trim() === ${JSON.stringify(label)}).click()`);
      await until(() => evaluate(`Array.from(document.querySelectorAll('h1')).some(node => node.textContent === ${JSON.stringify(heading)})`), "View not ready");
      await capture(name);
    }
    await evaluate("Array.from(document.querySelectorAll('.sidebar__item')).find(button => button.textContent.trim() === 'Bugün').click()");
    await until(() => evaluate("!!document.querySelector('.bugun-view')"), "Today not ready");
    await cdp("Emulation.setDeviceMetricsOverride", { width: 800, height: 700, deviceScaleFactor: 1, mobile: false });
    await capture("bugun-compact");
    await evaluate("document.querySelector('[data-view=\"isler\"]').click()");
    await until(() => evaluate("!!document.querySelector('.entity-workspace')"), "Work view not ready");
    await capture("isler-compact");
    await evaluate("Array.from(document.querySelectorAll('.entity-list__open')).find(button => button.getAttribute('aria-label') === 'Yeni onboarding deneyimi').click()");
    await until(() => evaluate("!!document.querySelector('.topic-card__toggle')"), "Work detail not ready");
    await evaluate("document.querySelector('.topic-card__toggle').click()");
    await capture("konu-compact");
    await cdp("Emulation.clearDeviceMetricsOverride");
    await evaluate("document.querySelector('[data-view=\"bugun\"]').click()");
    await until(() => evaluate("!!document.querySelector('.bugun-view')"), "Today not ready");
  }
  // The toolbar and keyboard shortcuts share the same quick-capture flow.
  await evaluate("document.querySelector('.app-toolbar__capture') ? document.querySelector('.app-toolbar__capture').click() : window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', metaKey: true, bubbles: true }))");
  await until(() => evaluate("!!document.querySelector('.quick-note-modal textarea')"), "Quick note did not open");
  await evaluate("document.querySelector('.quick-note-modal textarea').focus()");
  await cdp("Input.insertText", { text: "Saved on window close" });
  assert.equal(await evaluate("document.querySelector('.quick-note-modal textarea').value"), "Saved on window close");
  await wait(100);
  // Ask the Node main process to call BrowserWindow.close(), as the native close button does.
  void request("app.close").catch(() => {});
  await until(() => !socket || socket.readyState === WebSocket.CLOSED, "Native window did not close");
  const { DatabaseSync } = await import("node:sqlite");
  const check = new DatabaseSync(join(directory, "leadership.db"), { readOnly: true });
  try { assert.equal(check.prepare("SELECT count(*) AS count FROM notes WHERE body = ?").get("Saved on window close").count, 1); }
  finally { check.close(); }
  console.log("Desktop smoke passed: sandbox, IPC, people/work/topics/notes/todos/search/reminders, encrypted backup restore, legacy compatibility, custom LLM host and save-on-close.");
} catch (error) {
  console.error(logs);
  throw error;
} finally {
  socket?.close();
  for (const call of pending.values()) call.resolve({});
  pending.clear();
  if (!exitObserved) {
    child.kill("SIGTERM");
    await Promise.race([exited, wait(2000)]);
    if (!exitObserved) { child.kill("SIGKILL"); await exited; }
  }
  rmSync(directory, { recursive: true, force: true });
  await server?.close();
}
