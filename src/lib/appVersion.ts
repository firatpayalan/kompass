import { getVersion } from "@tauri-apps/api/app";

import packageJson from "../../package.json";

/** Resolve display version: Tauri bundle version, else package.json. */
export async function resolveAppVersion(
  getTauriVersion: () => Promise<string> = getVersion,
): Promise<string> {
  try {
    const version = (await getTauriVersion()).trim();
    if (version) {
      return version;
    }
  } catch {
    // Non-Tauri (Vite / tests) or invoke failure → fallback
  }
  return packageJson.version;
}

export function formatVersionLabel(version: string): string {
  const trimmed = version.trim();
  if (!trimmed) {
    return "";
  }
  return trimmed.startsWith("v") ? trimmed : `v${trimmed}`;
}
