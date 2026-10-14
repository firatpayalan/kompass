import { join, resolve } from "node:path";

/** Reuse the old application ID to retain existing databases and API settings. */
export function resolveDataDirectory(platform: string, home: string, env: NodeJS.ProcessEnv): string {
  if (env.KOMPASS_DATA_DIR) return resolve(env.KOMPASS_DATA_DIR);
  const root = platform === "darwin" ? join(home, "Library", "Application Support")
    : platform === "win32" ? env.APPDATA ?? join(home, "AppData", "Roaming")
      : env.XDG_CONFIG_HOME ?? join(home, ".config");
  return join(root, "com.dailyleadership.tool");
}
