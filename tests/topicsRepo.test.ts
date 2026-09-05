import { describe, expect, it } from "vitest";

import { createNote } from "../src/db/notesRepo";
import { createPerson } from "../src/db/peopleRepo";
import {
  createTopic,
  listTopicsWithNotesForPerson,
} from "../src/db/topicsRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("topicsRepo", () => {
  it("creates person-scoped topics and nests notes under them", async () => {
    const db = openTestAsyncDb();
    const person = await createPerson(db, {
      name: "Cartman",
      nowIso: "2026-09-05T09:00:00.000Z",
    });
    const topic = await createTopic(db, {
      personId: person.id,
      title: "USS Fishkill",
      nowIso: "2026-09-05T10:00:00.000Z",
    });
    const note = await createNote(db, {
      body: "küfür etti",
      personIds: [person.id],
      topicIds: [topic.id],
      nowIso: "2026-09-05T10:05:00.000Z",
    });
    await createNote(db, {
      body: "konusuz eski not",
      personIds: [person.id],
      nowIso: "2026-09-05T09:30:00.000Z",
    });

    const result = await listTopicsWithNotesForPerson(db, person.id);

    expect(result.topics).toHaveLength(1);
    expect(result.topics[0].title).toBe("USS Fishkill");
    expect(result.topics[0].notes.map((item) => item.id)).toEqual([note.id]);
    expect(result.untopicNotes.map((item) => item.body)).toEqual([
      "konusuz eski not",
    ]);
    db.close();
  });

  it("rejects duplicate topic titles for the same person", async () => {
    const db = openTestAsyncDb();
    const person = await createPerson(db, {
      name: "Kenny",
      nowIso: "2026-09-05T09:00:00.000Z",
    });
    await createTopic(db, {
      personId: person.id,
      title: "1:1",
      nowIso: "2026-09-05T10:00:00.000Z",
    });

    await expect(
      createTopic(db, {
        personId: person.id,
        title: "1:1",
        nowIso: "2026-09-05T11:00:00.000Z",
      }),
    ).rejects.toThrow("Bu isimde konu var");
    db.close();
  });
});
