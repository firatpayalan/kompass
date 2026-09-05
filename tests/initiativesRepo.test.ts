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
import { openTestDb } from "../src/db/testDb";

describe("initiativesRepo", () => {
  it("creates and lists initiatives", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";

    const initiative = createInitiative(db, {
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
    expect(listInitiatives(db)).toEqual([initiative]);
    db.close();
  });

  it("rejects a duplicate name", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    createInitiative(db, { name: "Lansman", status: "aktif", nowIso });

    expect(() =>
      createInitiative(db, {
        name: "lansman",
        status: "beklemede",
        nowIso,
      }),
    ).toThrow("Bu isimde kayıt var");
    db.close();
  });

  it("updates only supplied initiative fields", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const initiative = createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      blockerSummary: "Bütçe",
      nowIso,
    });

    expect(
      updateInitiative(db, initiative.id, {
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

  it("returns linked active notes only", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const initiative = createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      nowIso,
    });
    const active = createNote(db, { body: "Aktif", nowIso });
    const deleted = createNote(db, { body: "Silinmiş", nowIso });
    softDeleteNote(db, deleted.id, "2026-09-05T11:00:00.000Z");

    linkNoteToInitiatives(db, active.id, [initiative.id, initiative.id]);
    linkNoteToInitiatives(db, deleted.id, [initiative.id]);

    expect(listNotesForInitiative(db, initiative.id)).toEqual([
      expect.objectContaining({
        id: active.id,
        initiativeIds: [initiative.id],
      }),
    ]);
    db.close();
  });

  it("deletes only the initiative and its note links", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const initiative = createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      nowIso,
    });
    const note = createNote(db, {
      body: "Not kalmalı",
      initiativeIds: [initiative.id],
      nowIso,
    });

    deleteInitiative(db, initiative.id);

    expect(listInitiatives(db)).toEqual([]);
    expect(getNote(db, note.id)).toEqual(
      expect.objectContaining({ id: note.id, initiativeIds: [] }),
    );
    db.close();
  });
});
