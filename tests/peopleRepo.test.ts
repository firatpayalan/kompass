import { describe, expect, it } from "vitest";

import { createNote, getNote, listActiveNotes, listDeletedNotes, softDeleteNote } from "../src/db/notesRepo";
import {
  archivePerson,
  createPerson,
  deletePerson,
  findPersonByName,
  getPerson,
  linkNoteToPeople,
  listArchivedPeople,
  listNotesForPerson,
  listPeople,
  reorderPeople,
  restorePerson,
  updatePerson,
} from "../src/db/peopleRepo";
import { listPersonLabels } from "../src/db/personLabelsRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("peopleRepo", () => {
  it("creates, lists, and finds people by case-insensitive name", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";

    const person = await createPerson(db, {
      name: "Ayşe",
      roleOrNotes: "Satış lideri",
      nowIso,
    });

    expect(person).toEqual({
      id: expect.any(Number),
      name: "Ayşe",
      roleOrNotes: "Satış lideri",
      createdAt: nowIso,
      sortOrder: -1,
      label: null,
      archivedAt: null,
    });
    expect(await listPeople(db)).toEqual([person]);
    expect(await findPersonByName(db, "ayşe")).toEqual(person);
    expect(await findPersonByName(db, "Kimse")).toBeNull();
    db.close();
  });

  it("puts newly created people at the top of the list", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";

    const first = await createPerson(db, { name: "Ayşe", nowIso });
    const second = await createPerson(db, { name: "Can", nowIso });

    expect(await listPeople(db)).toEqual([
      expect.objectContaining({ id: second.id, name: "Can" }),
      expect.objectContaining({ id: first.id, name: "Ayşe" }),
    ]);
    db.close();
  });

  it("reorders people by the given id sequence", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const a = await createPerson(db, { name: "Ayşe", nowIso });
    const b = await createPerson(db, { name: "Can", nowIso });
    const c = await createPerson(db, { name: "Deniz", nowIso });

    await reorderPeople(db, [a.id, c.id, b.id]);

    expect((await listPeople(db)).map((person) => person.name)).toEqual([
      "Ayşe",
      "Deniz",
      "Can",
    ]);
    db.close();
  });

  it("assigns a relationship label to a person", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const labels = await listPersonLabels(db);
    const lider = labels.find((label) => label.name === "Lider");
    expect(lider).toBeTruthy();

    const person = await createPerson(db, {
      name: "Ayşe",
      labelId: lider!.id,
      nowIso,
    });
    expect(person.label).toEqual(
      expect.objectContaining({ name: "Lider", color: "sky" }),
    );

    const updated = await updatePerson(db, person.id, { labelId: null });
    expect(updated.label).toBeNull();
    db.close();
  });

  it("rejects a duplicate name", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    await createPerson(db, { name: "Ayşe", nowIso });

    await expect(createPerson(db, { name: "ayşe", nowIso })).rejects.toThrow(
      "Bu isimde kayıt var",
    );
    db.close();
  });

  it("links active notes and replaces duplicate links", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const person = await createPerson(db, { name: "Ayşe", nowIso });
    const otherPerson = await createPerson(db, { name: "Can", nowIso });
    const active = await createNote(db, { body: "Aktif", nowIso });
    const deleted = await createNote(db, { body: "Silinmiş", nowIso });
    await softDeleteNote(db, deleted.id, "2026-09-05T11:00:00.000Z");

    await linkNoteToPeople(db, active.id, [
      person.id,
      person.id,
      otherPerson.id,
    ]);
    await linkNoteToPeople(db, deleted.id, [person.id]);

    expect(await listNotesForPerson(db, person.id)).toEqual([
      expect.objectContaining({
        id: active.id,
        personIds: [person.id, otherPerson.id],
      }),
    ]);
    db.close();
  });

  it("deletes only the person and its note links", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const person = await createPerson(db, { name: "Ayşe", nowIso });
    const note = await createNote(db, {
      body: "Not kalmalı",
      personIds: [person.id],
      nowIso,
    });

    await deletePerson(db, person.id);

    expect(await findPersonByName(db, "Ayşe")).toBeNull();
    expect(await getNote(db, note.id)).toEqual(
      expect.objectContaining({ id: note.id, personIds: [] }),
    );
    db.close();
  });

  it("archives a person with linked notes and restores them together", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const archivedAt = "2026-09-05T12:00:00.000Z";
    const person = await createPerson(db, { name: "Ayşe", nowIso });
    const note = await createNote(db, {
      body: "Bağlı not",
      personIds: [person.id],
      nowIso,
    });
    const alreadyTrashed = await createNote(db, {
      body: "Önceden silinmiş",
      personIds: [person.id],
      nowIso,
    });
    await softDeleteNote(db, alreadyTrashed.id, "2026-09-05T11:00:00.000Z");

    await archivePerson(db, person.id, archivedAt);

    expect(await listPeople(db)).toEqual([]);
    expect(await listArchivedPeople(db)).toEqual([
      expect.objectContaining({ id: person.id, archivedAt }),
    ]);
    expect(await listActiveNotes(db)).toEqual([]);
    expect(await getNote(db, note.id)).toEqual(
      expect.objectContaining({ deletedAt: archivedAt }),
    );
    // Linked notes (including previously trashed) live under Arşiv, not Silinenler.
    expect(await listDeletedNotes(db)).toEqual([]);

    await restorePerson(db, person.id);

    expect(await listPeople(db)).toEqual([
      expect.objectContaining({ id: person.id, archivedAt: null }),
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

  it("renames a person", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-08T10:00:00.000Z";
    const person = await createPerson(db, { name: "Ayşe", nowIso });

    const updated = await updatePerson(db, person.id, { name: "Ayşe Yılmaz" });
    expect(updated.name).toBe("Ayşe Yılmaz");
    expect(await getPerson(db, person.id)).toEqual(
      expect.objectContaining({ id: person.id, name: "Ayşe Yılmaz" }),
    );
    db.close();
  });

  it("rejects renaming to a duplicate active name", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-08T10:00:00.000Z";
    await createPerson(db, { name: "Ayşe", nowIso });
    const other = await createPerson(db, { name: "Can", nowIso });

    await expect(
      updatePerson(db, other.id, { name: "ayşe" }),
    ).rejects.toThrow("Bu isimde kayıt var");
    db.close();
  });

  it("rejects empty rename", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-08T10:00:00.000Z";
    const person = await createPerson(db, { name: "Ayşe", nowIso });

    await expect(updatePerson(db, person.id, { name: "   " })).rejects.toThrow(
      "İsim boş olamaz",
    );
    db.close();
  });
});
