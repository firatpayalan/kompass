import { describe, expect, it } from "vitest";
import {
  ensureNoteImagesTable,
  getNoteImage,
  saveNoteImage,
} from "../src/db/noteImagesRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("noteImagesRepo", () => {
  it("saves and loads a note image", async () => {
    const db = openTestAsyncDb();
    await ensureNoteImagesTable(db);
    const id = "11111111-1111-1111-1111-111111111111";
    await saveNoteImage(db, {
      id,
      mime: "image/png",
      bytesBase64: "aGVsbG8=",
      nowIso: "2026-09-06T10:00:00.000Z",
    });
    expect(await getNoteImage(db, id)).toEqual({
      mime: "image/png",
      bytesBase64: "aGVsbG8=",
    });
    db.close();
  });

  it("returns null for missing id", async () => {
    const db = openTestAsyncDb();
    await ensureNoteImagesTable(db);
    expect(await getNoteImage(db, "missing")).toBeNull();
    db.close();
  });
});
