import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

export async function ensureNotifyPermission(): Promise<boolean> {
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  return granted;
}

export async function notifyReminder(
  title: string,
  body: string,
): Promise<boolean> {
  if (!(await ensureNotifyPermission())) {
    return false;
  }

  sendNotification({ title, body });
  return true;
}
