import { desktopRequest } from "./desktop";

import packageJson from "../../package.json";

/** Resolve display version: Electron bundle version, else package.json. */
export async function resolveAppVersion(
  getDesktopVersion: () => Promise<string> = () => desktopRequest("app.version"),
): Promise<string> {
  try {
    const version = (await getDesktopVersion()).trim();
    if (version) {
      return version;
    }
  } catch {
    // Non-desktop (Vite / tests) or invoke failure → fallback
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
