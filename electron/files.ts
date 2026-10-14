import { mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { randomUUID } from "node:crypto";

export function writeAtomic(filename: string, bytes: string | Uint8Array): void {
  mkdirSync(dirname(filename), { recursive: true, mode: 0o700 });
  const temp = join(dirname(filename), `.${basename(filename)}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temp, bytes, { mode: 0o600, flag: "wx" });
    renameSync(temp, filename);
  } finally { rmSync(temp, { force: true }); }
}
