import { describe, expect, it } from "vitest";

import { createInitiative } from "../src/db/initiativesRepo";
import { createNote, listNotesForInitiative } from "../src/db/notesRepo";
import { createPerson } from "../src/db/peopleRepo";
import {
  createTopic,
  listTopicsWithNotesForInitiative,
  promoteTopicToInitiative,
} from "../src/db/topicsRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("promoteTopicToInitiative", () => {
  it("creates a new initiative and two trail notes without moving the topic", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-18T10:00:00.000Z";
    const parent = await createInitiative(db, {
      name: "Ana İş",
      status: "aktif",
      nowIso,
    });
    const topic = await createTopic(db, {
      initiativeId: parent.id,
      title: "Alt Konu",
      nowIso,
    });
    const existing = await createNote(db, {
      body: "Eski not",
      initiativeIds: [parent.id],
      topicIds: [topic.id],
      nowIso,
    });

    const created = await promoteTopicToInitiative(db, topic.id, nowIso);

    expect(created.name).toBe("Alt Konu");
    expect(created.id).not.toBe(parent.id);

    const { topics } = await listTopicsWithNotesForInitiative(db, parent.id);
    const stillThere = topics.find((t) => t.id === topic.id);
    expect(stillThere).toBeTruthy();
    expect(stillThere!.notes.map((n) => n.id)).toContain(existing.id);
    expect(stillThere!.notes.map((n) => n.body)).toContain(
      "Bu konu “Alt Konu” işine taşınmıştır.",
    );

    const newInitiativeNotes = await listNotesForInitiative(db, created.id);
    expect(newInitiativeNotes.map((n) => n.body)).toContain(
      "“Alt Konu” konusundan taşınmıştır.",
    );
    expect(newInitiativeNotes.every((n) => n.topicIds.length === 0)).toBe(true);

    db.close();
  });

  it("rejects person-owned topics", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-18T10:00:00.000Z";
    const person = await createPerson(db, {
      name: "Cartman",
      nowIso,
    });
    const topic = await createTopic(db, {
      personId: person.id,
      title: "Kişisel konu",
      nowIso,
    });

    await expect(
      promoteTopicToInitiative(db, topic.id, nowIso),
    ).rejects.toThrow("Bu konu bir işe ait değil");
    db.close();
  });

  it("rejects duplicate initiative names", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-18T10:00:00.000Z";
    await createInitiative(db, { name: "Çakışan", status: "aktif", nowIso });
    const parent = await createInitiative(db, {
      name: "Ana",
      status: "aktif",
      nowIso,
    });
    const topic = await createTopic(db, {
      initiativeId: parent.id,
      title: "Çakışan",
      nowIso,
    });
    await expect(
      promoteTopicToInitiative(db, topic.id, nowIso),
    ).rejects.toThrow("Bu isimde kayıt var");
    db.close();
  });

  it("rejects a missing topic", async () => {
    const db = openTestAsyncDb();
    const nowIso = "2026-09-18T10:00:00.000Z";

    await expect(
      promoteTopicToInitiative(db, 999, nowIso),
    ).rejects.toThrow("Konu bulunamadı");
    db.close();
  });
});
