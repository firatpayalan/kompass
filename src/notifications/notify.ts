import { desktopRequest } from "../lib/desktop";

export function ensureNotifyPermission(): Promise<boolean> {
  return desktopRequest("notification.supported");
}

export function notifyReminder(title: string, body: string): Promise<boolean> {
  return desktopRequest("notification.show", { title, body });
}
