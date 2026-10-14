import { desktopRequest } from "../lib/desktop";
import type { AppDb } from "./createAppDb";
export { createAppDb, type AppDb } from "./createAppDb";

let appDb: AppDb | null = null;
let pendingInit: Promise<void> | null = null;

export function initAppDb(): Promise<void> {
  if (!pendingInit) {
    pendingInit = desktopRequest("db.initialize").then(() => {
      appDb = new Proxy({} as AppDb, {
        get(_target, method: string) {
          if (method === "then") return undefined;
          return (...args: unknown[]) => desktopRequest("db.call", {
            method: method as keyof AppDb, args,
          });
        },
      });
    }).catch((error: unknown) => { pendingInit = null; throw error; });
  }
  return pendingInit;
}

export function getDb(): AppDb {
  if (!appDb) throw new Error("Veritabanı hazır değil");
  return appDb;
}

export async function resetAppDb(): Promise<void> {
  appDb = null;
  pendingInit = null;
  await initAppDb();
}
