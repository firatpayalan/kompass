/** Normalize unknown thrown values (Error, string, Tauri payloads) for UI. */
export function formatError(error: unknown, fallback: string): string {
  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }
  try {
    const serialized = JSON.stringify(error);
    if (
      serialized &&
      serialized !== "{}" &&
      serialized !== "null" &&
      serialized !== "[]"
    ) {
      return serialized;
    }
  } catch {
    // ignore
  }
  return fallback;
}

export function isDuplicateNameError(error: unknown): boolean {
  return formatError(error, "") === "Bu isimde kayıt var";
}
