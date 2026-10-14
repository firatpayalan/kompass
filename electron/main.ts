import { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, Notification, shell } from "electron";
import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";
import { resolveDataDirectory } from "./paths";
import { DatabaseService } from "./database";
import { BackupService, recoverInterruptedImport } from "./backup";
import { LlmService } from "./llm";
import type { DesktopCommands, DesktopReply } from "../src/lib/desktop";

const directory = resolveDataDirectory(process.platform, homedir(), process.env);
mkdirSync(directory, { recursive: true, mode: 0o700 });
app.setPath("userData", directory);
app.setName("Kompass");
const database = new DatabaseService(directory);
const backup = new BackupService(database);
const llm = new LlmService(directory);
const devUrl = !app.isPackaged ? process.env.KOMPASS_DEV_URL : undefined;
let window: BrowserWindow | null = null;
let allowClose = false;
let closing = false;
let quitting = false;
let pendingQuickNote = false;
let closeHandlers = 0;
let quickNoteHandlers = 0;

function trusted(event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent): boolean {
  return !!window && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame;
}

async function request<K extends keyof DesktopCommands>(command: K, args: DesktopCommands[K]["args"]): Promise<unknown> {
  // Values are checked by the domain service; the transport never accepts SQL or arbitrary files to execute.
  const value = args;
  switch (command) {
    case "db.initialize": return database.exclusive(() => database.initialize());
    case "db.call": {
      const { method, args: params } = value as DesktopCommands["db.call"]["args"];
      return database.exclusive(() => database.call(method, params));
    }
    case "db.checkpoint": return database.exclusive(() => database.checkpoint());
    case "db.close": return database.exclusive(() => database.close());
    case "app.version": return app.getVersion();
    case "app.close": window?.close(); return;
    case "llm.hasKey": return llm.hasKey((value as DesktopCommands["llm.hasKey"]["args"]).provider);
    case "llm.saveKey": {
      const { provider, key } = value as DesktopCommands["llm.saveKey"]["args"];
      return database.exclusive(() => llm.saveKey(provider, key));
    }
    case "llm.clearKey": return database.exclusive(() => llm.clearKey((value as DesktopCommands["llm.clearKey"]["args"]).provider));
    case "llm.getSettings": return llm.getSettings();
    case "llm.setSettings": return database.exclusive(() => llm.setSettings(value as DesktopCommands["llm.setSettings"]["args"]));
    case "llm.summarize": return llm.summarize(value as DesktopCommands["llm.summarize"]["args"]);
    case "backup.pickExport": {
      const stamp = new Date().toLocaleDateString("sv-SE");
      const result = await dialog.showSaveDialog(window!, { defaultPath: `kompass-yedek-${stamp}.kompass`, filters: [{ name: "Kompass yedek", extensions: ["kompass"] }] });
      return result.canceled ? null : result.filePath ?? null;
    }
    case "backup.pickImport": {
      const result = await dialog.showOpenDialog(window!, { properties: ["openFile"], filters: [{ name: "Kompass yedek", extensions: ["kompass"] }] });
      return result.canceled ? null : result.filePaths[0] ?? null;
    }
    case "backup.export": {
      const { password, destPath } = value as DesktopCommands["backup.export"]["args"];
      return database.exclusive(() => backup.export(password, destPath));
    }
    case "backup.verify": {
      const { password, sourcePath } = value as DesktopCommands["backup.verify"]["args"];
      return backup.verify(password, sourcePath);
    }
    case "backup.import": {
      const { password, sourcePath } = value as DesktopCommands["backup.import"]["args"];
      return database.exclusive(() => backup.import(password, sourcePath));
    }
    case "notification.supported": return Notification.isSupported();
    case "notification.show": {
      if (!Notification.isSupported()) return false;
      const { title, body } = value as DesktopCommands["notification.show"]["args"];
      new Notification({ title, body }).show();
      return true;
    }
    default: throw new Error("Geçersiz masaüstü işlemi");
  }
}

ipcMain.handle("kompass:request", async (event, command, args): Promise<DesktopReply<unknown>> => {
  if (!trusted(event)) return { ok: false, error: "Yetkisiz masaüstü bağlantısı" };
  try { return { ok: true, value: await request(command, args) }; }
  catch (error) { return { ok: false, error: error instanceof Error ? error.message : String(error) }; }
});

ipcMain.on("kompass:close-ready", (event, saved) => {
  if (!trusted(event) || !closing) return;
  if (!saved) { closing = false; quitting = false; return; }
  // Drain pending writes before allowing the native window or process to exit.
  void database.exclusive(() => {
    allowClose = true;
    window?.close();
    if (quitting) app.quit();
  });
});

ipcMain.on("kompass:close-handler", (event, delta) => {
  if (trusted(event) && (delta === 1 || delta === -1)) closeHandlers = Math.max(0, closeHandlers + delta);
});

ipcMain.on("kompass:quick-note-handler", (event, delta) => {
  if (!trusted(event) || (delta !== 1 && delta !== -1)) return;
  quickNoteHandlers = Math.max(0, quickNoteHandlers + delta);
  if (quickNoteHandlers > 0 && pendingQuickNote) {
    pendingQuickNote = false;
    window?.webContents.send("kompass:quick-note");
  }
});

function openQuickNote(): void {
  if (!window) { pendingQuickNote = true; createWindow(); return; }
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
  if (quickNoteHandlers > 0) window.webContents.send("kompass:quick-note");
  else pendingQuickNote = true;
}

function createWindow(): void {
  allowClose = false;
  closing = false;
  closeHandlers = 0;
  quickNoteHandlers = 0;
  const created = new BrowserWindow({
    title: "Kompass", width: 1200, height: 800, minWidth: 800, minHeight: 600,
    backgroundColor: "#f8fafc", show: false,
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  window = created;
  created.once("ready-to-show", () => created.show());
  created.webContents.on("will-navigate", (event) => event.preventDefault());
  created.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  created.webContents.session.setPermissionRequestHandler((_contents, permission, callback) => callback(permission === "clipboard-sanitized-write"));
  created.webContents.on("did-start-navigation", (_event, _url, _isInPlace, isMainFrame) => {
    if (isMainFrame) { closeHandlers = 0; quickNoteHandlers = 0; }
  });
  created.on("close", (event) => {
    if (allowClose || closeHandlers === 0 || created.webContents.isDestroyed() || created.webContents.isCrashed()) {
      allowClose = true;
      return;
    }
    event.preventDefault();
    if (!closing) { closing = true; created.webContents.send("kompass:before-close"); }
  });
  created.on("closed", () => { window = null; closing = false; });
  if (devUrl) void created.loadURL(devUrl);
  else void created.loadFile(join(__dirname, "../dist/index.html"));
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => { if (!window) createWindow(); window?.show(); window?.focus(); });
  void app.whenReady().then(() => {
    recoverInterruptedImport(directory);
    createWindow();
    const template: Electron.MenuItemConstructorOptions[] = [
      ...(process.platform === "darwin" ? [{ role: "appMenu" as const }] : []),
      { label: "Dosya", submenu: [{ label: "Hızlı Not", accelerator: "CmdOrCtrl+N", click: openQuickNote }, { role: "close" }] },
      { role: "editMenu" }, { role: "viewMenu" }, { role: "windowMenu" },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    if (!globalShortcut.register("CommandOrControl+Shift+N", openQuickNote)) console.warn("Genel Hızlı Not kısayolu kaydedilemedi: Cmd/Ctrl+Shift+N");
    app.on("activate", () => { if (!window) createWindow(); else window.show(); });
  }).catch((error) => { dialog.showErrorBox("Kompass başlatılamadı", String(error)); app.exit(1); });
  app.on("before-quit", (event) => {
    if (window && !allowClose) { event.preventDefault(); quitting = true; window.close(); }
  });
  app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
  app.on("will-quit", () => { globalShortcut.unregisterAll(); database.close(); });
}
