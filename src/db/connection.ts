import { desktopRequest } from "../lib/desktop";

export async function checkpointAppDatabase(): Promise<void> {
  await desktopRequest("db.checkpoint");
}

export async function closeAppDatabase(): Promise<void> {
  await desktopRequest("db.close");
}
