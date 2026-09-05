import { describe, expect, it } from "vitest";

import { createNote, getNote, softDeleteNote } from "../src/db/notesRepo";
import {
  createPerson,
  deletePerson,
  findPersonByName,
  linkNoteToPeople,
  listNotesForPerson,
  listPeople,
  reorderPeople,
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
});
