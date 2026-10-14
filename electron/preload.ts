import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi, DesktopEvent } from "../src/lib/desktop";

const channels: Record<DesktopEvent, string> = {
  "quick-note": "kompass:quick-note",
  "before-close": "kompass:before-close",
};
const api: DesktopApi = {
  request: (command, args) => ipcRenderer.invoke("kompass:request", command, args),
  on(event, callback) {
    const channel = channels[event];
    if (!channel) throw new Error("Geçersiz olay");
    const listener = () => callback();
    ipcRenderer.on(channel, listener);
    if (event === "before-close") ipcRenderer.send("kompass:close-handler", 1);
    if (event === "quick-note") ipcRenderer.send("kompass:quick-note-handler", 1);
    return () => {
      ipcRenderer.removeListener(channel, listener);
      if (event === "before-close") ipcRenderer.send("kompass:close-handler", -1);
      if (event === "quick-note") ipcRenderer.send("kompass:quick-note-handler", -1);
    };
  },
  closeReady: (saved) => ipcRenderer.send("kompass:close-ready", saved === true),
};
contextBridge.exposeInMainWorld("kompass", api);
