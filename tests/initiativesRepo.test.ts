import { describe, expect, it } from "vitest";

import {
  createInitiative,
  deleteInitiative,
  linkNoteToInitiatives,
  listInitiatives,
  listNotesForInitiative,
  updateInitiative,
} from "../src/db/initiativesRepo";
import { createNote, getNote, softDeleteNote } from "../src/db/notesRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("initiativesRepo", () => {
  it("creates and lists initiatives", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";

    const initiative = await createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      blockerSummary: "Bütçe",
      nowIso,
    });

    expect(initiative).toEqual({
      id: expect.any(Number),
      name: "Lansman",
      status: "aktif",
      blockerSummary: "Bütçe",
      createdAt: nowIso,
    });
    expect(await listInitiatives(db)).toEqual([initiative]);
    db.close();
  });

  it("rejects a duplicate name", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    await createInitiative(db, { name: "Lansman", status: "aktif", nowIso });

    await expect(
      createInitiative(db, {
        name: "lansman",
        status: "beklemede",
        nowIso,
      }),
    ).rejects.toThrow("Bu isimde kayıt var");
    db.close();
  });

  it("updates only supplied initiative fields", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const initiative = await createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      blockerSummary: "Bütçe",
      nowIso,
    });

    expect(
      await updateInitiative(db, initiative.id, {
        status: "beklemede",
        blockerSummary: null,
      }),
    ).toEqual({
      ...initiative,
      status: "beklemede",
      blockerSummary: null,
    });
    db.close();
  });

  it("returns linked active notes only", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const initiative = await createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      nowIso,
    });
    const active = await createNote(db, { body: "Aktif", nowIso });
    const deleted = await createNote(db, { body: "Silinmiş", nowIso });
    await softDeleteNote(db, deleted.id, "2026-09-05T11:00:00.000Z");

    await linkNoteToInitiatives(db, active.id, [
      initiative.id,
      initiative.id,
    ]);
    await linkNoteToInitiatives(db, deleted.id, [initiative.id]);

    expect(await listNotesForInitiative(db, initiative.id)).toEqual([
      expect.objectContaining({
        id: active.id,
        initiativeIds: [initiative.id],
      }),
    ]);
    db.close();
  });

  it("deletes only the initiative and its note links", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const initiative = await createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      nowIso,
    });
    const note = await createNote(db, {
      body: "Not kalmalı",
      initiativeIds: [initiative.id],
      nowIso,
    });

    await deleteInitiative(db, initiative.id);

    expect(await listInitiatives(db)).toEqual([]);
    expect(await getNote(db, note.id)).toEqual(
      expect.objectContaining({ id: note.id, initiativeIds: [] }),
    );
    db.close();
  });
});
