import { describe, expect, it } from "vitest";

import { createPerson } from "../src/db/peopleRepo";
import { createTopic, listTopicsWithNotesForPerson } from "../src/db/topicsRepo";
import {
  addTagToTopic,
  deleteTopicTag,
  updateTopicTag,
} from "../src/db/topicTagsRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("topicTagsRepo", () => {
  it("adds multiple tags to a topic and lists them", async () => {
    const db = openTestAsyncDb();
    const person = await createPerson(db, {
      name: "Osman",
      nowIso: "2026-09-05T09:00:00.000Z",
    });
    const topic = await createTopic(db, {
      personId: person.id,
      title: "atlas gecisi",
      nowIso: "2026-09-05T10:00:00.000Z",
    });

    await addTagToTopic(db, topic.id, { name: "acil", color: "rose" });
    await addTagToTopic(db, topic.id, { name: "q3", color: "teal" });

    const listed = await listTopicsWithNotesForPerson(db, person.id);
    expect(listed.topics[0].tags.map((tag) => tag.name)).toEqual([
      "acil",
      "q3",
    ]);
    db.close();
  });

  it("updates and deletes a topic tag", async () => {
    const db = openTestAsyncDb();
    const person = await createPerson(db, {
      name: "Baris",
      nowIso: "2026-09-05T09:00:00.000Z",
    });
    const topic = await createTopic(db, {
      personId: person.id,
      title: "konu",
      nowIso: "2026-09-05T10:00:00.000Z",
    });
    const tag = await addTagToTopic(db, topic.id, {
      name: "eski",
      color: "slate",
    });

    const updated = await updateTopicTag(db, tag.id, {
      name: "yeni",
      color: "indigo",
    });
    expect(updated).toEqual(
      expect.objectContaining({ name: "yeni", color: "indigo" }),
    );

    await deleteTopicTag(db, tag.id);
    const listed = await listTopicsWithNotesForPerson(db, person.id);
    expect(listed.topics[0].tags).toEqual([]);
    db.close();
  });
});
