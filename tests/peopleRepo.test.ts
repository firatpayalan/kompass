import { describe, expect, it } from "vitest";

import { createNote, getNote, softDeleteNote } from "../src/db/notesRepo";
import {
  createPerson,
  deletePerson,
  findPersonByName,
  linkNoteToPeople,
  listNotesForPerson,
  listPeople,
} from "../src/db/peopleRepo";
import { openTestDb } from "../src/db/testDb";

describe("peopleRepo", () => {
  it("creates, lists, and finds people by case-insensitive name", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";

    const person = createPerson(db, {
      name: "Ayşe",
      roleOrNotes: "Satış lideri",
      nowIso,
    });

    expect(person).toEqual({
      id: expect.any(Number),
      name: "Ayşe",
      roleOrNotes: "Satış lideri",
      createdAt: nowIso,
    });
    expect(listPeople(db)).toEqual([person]);
    expect(findPersonByName(db, "ayşe")).toEqual(person);
    expect(findPersonByName(db, "Kimse")).toBeNull();
    db.close();
  });

  it("rejects a duplicate name", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    createPerson(db, { name: "Ayşe", nowIso });

    expect(() => createPerson(db, { name: "ayşe", nowIso })).toThrow(
      "Bu isimde kayıt var",
    );
    db.close();
  });

  it("links active notes and replaces duplicate links", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const person = createPerson(db, { name: "Ayşe", nowIso });
    const otherPerson = createPerson(db, { name: "Can", nowIso });
    const active = createNote(db, { body: "Aktif", nowIso });
    const deleted = createNote(db, { body: "Silinmiş", nowIso });
    softDeleteNote(db, deleted.id, "2026-09-05T11:00:00.000Z");

    linkNoteToPeople(db, active.id, [person.id, person.id, otherPerson.id]);
    linkNoteToPeople(db, deleted.id, [person.id]);

    expect(listNotesForPerson(db, person.id)).toEqual([
      expect.objectContaining({ id: active.id, personIds: [person.id, otherPerson.id] }),
    ]);
    db.close();
  });

  it("deletes only the person and its note links", () => {
    const db = openTestDb();
    const nowIso = "2026-09-05T10:00:00.000Z";
    const person = createPerson(db, { name: "Ayşe", nowIso });
    const note = createNote(db, {
      body: "Not kalmalı",
      personIds: [person.id],
      nowIso,
    });

    deletePerson(db, person.id);

    expect(findPersonByName(db, "Ayşe")).toBeNull();
    expect(getNote(db, note.id)).toEqual(
      expect.objectContaining({ id: note.id, personIds: [] }),
    );
    db.close();
  });
});
