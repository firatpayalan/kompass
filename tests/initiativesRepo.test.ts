import { describe, expect, it } from "vitest";

import {
  archiveInitiative,
  createInitiative,
  deleteInitiative,
  linkNoteToInitiatives,
  listArchivedInitiatives,
  listInitiatives,
  listNotesForInitiative,
  reorderInitiatives,
  restoreInitiative,
  updateInitiative,
} from "../src/db/initiativesRepo";
import {
  createNote,
  getNote,
  listActiveNotes,
  listDeletedNotes,
  softDeleteNote,
} from "../src/db/notesRepo";
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
      lastActivityAt: nowIso,
      sortOrder: -1,
      archivedAt: null,
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

  it("reorders initiatives by the given id sequence", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const a = await createInitiative(db, {
      name: "Alpha",
      status: "aktif",
      nowIso,
    });
    const b = await createInitiative(db, {
      name: "Beta",
      status: "aktif",
      nowIso,
    });
    const c = await createInitiative(db, {
      name: "Gamma",
      status: "aktif",
      nowIso,
    });

    await reorderInitiatives(db, [a.id, c.id, b.id]);

    expect((await listInitiatives(db)).map((item) => item.name)).toEqual([
      "Alpha",
      "Gamma",
      "Beta",
    ]);
    db.close();
  });

  it("archives an initiative with linked notes and restores them together", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const archivedAt = "2026-09-05T12:00:00.000Z";
    const initiative = await createInitiative(db, {
      name: "Lansman",
      status: "aktif",
      nowIso,
    });
    const note = await createNote(db, {
      body: "Bağlı not",
      initiativeIds: [initiative.id],
      nowIso,
    });
    const alreadyTrashed = await createNote(db, {
      body: "Önceden silinmiş",
      initiativeIds: [initiative.id],
      nowIso,
    });
    await softDeleteNote(db, alreadyTrashed.id, "2026-09-05T11:00:00.000Z");

    await archiveInitiative(db, initiative.id, archivedAt);

    expect(await listInitiatives(db)).toEqual([]);
    expect(await listArchivedInitiatives(db)).toEqual([
      expect.objectContaining({ id: initiative.id, archivedAt }),
    ]);
    expect(await listActiveNotes(db)).toEqual([]);
    expect(await getNote(db, note.id)).toEqual(
      expect.objectContaining({ deletedAt: archivedAt }),
    );
    expect(await listDeletedNotes(db)).toEqual([]);
    expect(
      await listNotesForInitiative(db, initiative.id, { includeDeleted: true }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: note.id }),
        expect.objectContaining({ id: alreadyTrashed.id }),
      ]),
    );

    await restoreInitiative(db, initiative.id);

    expect(await listInitiatives(db)).toEqual([
      expect.objectContaining({ id: initiative.id, archivedAt: null }),
    ]);
    expect(await listActiveNotes(db)).toEqual([
      expect.objectContaining({ id: note.id, deletedAt: null }),
    ]);
    expect(await getNote(db, alreadyTrashed.id)).toEqual(
      expect.objectContaining({
        id: alreadyTrashed.id,
        deletedAt: "2026-09-05T11:00:00.000Z",
      }),
    );
    expect(await listDeletedNotes(db)).toEqual([
      expect.objectContaining({ id: alreadyTrashed.id }),
    ]);
    db.close();
  });

  it("uses createdAt as lastActivityAt when there are no linked notes", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const initiative = await createInitiative(db, {
      name: "Boş",
      status: "aktif",
      nowIso,
    });
    expect(initiative.lastActivityAt).toBe(nowIso);
    expect((await listInitiatives(db))[0].lastActivityAt).toBe(nowIso);
    db.close();
  });

  it("uses max active linked note updatedAt as lastActivityAt", async () => {
    const db = openTestAsyncDb();
    const createdAt = "2026-09-05T10:00:00.000Z";
    const initiative = await createInitiative(db, {
      name: "Aktif iş",
      status: "aktif",
      nowIso: createdAt,
    });
    const older = await createNote(db, {
      body: "Eski",
      nowIso: "2026-09-05T11:00:00.000Z",
    });
    const newer = await createNote(db, {
      body: "Yeni",
      nowIso: "2026-09-05T12:00:00.000Z",
    });
    await linkNoteToInitiatives(db, older.id, [initiative.id]);
    await linkNoteToInitiatives(db, newer.id, [initiative.id]);

    const [listed] = await listInitiatives(db);
    expect(listed.lastActivityAt).toBe("2026-09-05T12:00:00.000Z");
    db.close();
  });

  it("ignores soft-deleted linked notes for lastActivityAt", async () => {
    const db = openTestAsyncDb();
    const createdAt = "2026-09-05T10:00:00.000Z";
    const initiative = await createInitiative(db, {
      name: "Silinen notlu",
      status: "aktif",
      nowIso: createdAt,
    });
    const active = await createNote(db, {
      body: "Aktif",
      nowIso: "2026-09-05T11:00:00.000Z",
    });
    const deleted = await createNote(db, {
      body: "Silinmiş",
      nowIso: "2026-09-05T13:00:00.000Z",
    });
    await softDeleteNote(db, deleted.id, "2026-09-05T14:00:00.000Z");
    await linkNoteToInitiatives(db, active.id, [initiative.id]);
    await linkNoteToInitiatives(db, deleted.id, [initiative.id]);

    const [listed] = await listInitiatives(db);
    expect(listed.lastActivityAt).toBe("2026-09-05T11:00:00.000Z");
    db.close();
  });
});
