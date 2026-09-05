import type { AsyncDb } from "./asyncDb";

export type SaveNoteImageInput = {
  id: string;
  mime: string;
  bytesBase64: string;
  nowIso: string;
};

export type NoteImage = {
  mime: string;
  bytesBase64: string;
};

export async function ensureNoteImagesTable(db: AsyncDb): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS note_images (
      id TEXT PRIMARY KEY,
      mime TEXT NOT NULL,
      bytes_base64 TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
}

export async function saveNoteImage(
  db: AsyncDb,
  input: SaveNoteImageInput,
): Promise<void> {
  await db.execute(
    `INSERT INTO note_images (id, mime, bytes_base64, created_at)
     VALUES (?, ?, ?, ?)`,
    [input.id, input.mime, input.bytesBase64, input.nowIso],
  );
}

export async function getNoteImage(
  db: AsyncDb,
  id: string,
): Promise<NoteImage | null> {
  const [row] = await db.select<{ mime: string; bytes_base64: string }>(
    `SELECT mime, bytes_base64 FROM note_images WHERE id = ?`,
    [id],
  );
  if (!row) return null;
  return { mime: row.mime, bytesBase64: row.bytes_base64 };
}
