import { describe, expect, it } from "vitest";

import { createInitiative, listInitiatives } from "../src/db/initiativesRepo";
import {
  addTagToInitiative,
  deleteInitiativeTag,
  ensureInitiativeTagsSchema,
  linkTagToInitiative,
  listInitiativeTags,
  listTagsForInitiative,
  removeTagFromInitiative,
  updateInitiativeTag,
} from "../src/db/initiativeTagsRepo";
import { openTestAsyncDb } from "../src/db/testDb";

describe("initiativeTagsRepo", () => {
  it("adds multiple tags to an initiative and lists them", async () => {
    const db = openTestAsyncDb();
    await ensureInitiativeTagsSchema(db);
    const initiative = await createInitiative(db, {
      name: "Atlas",
      status: "aktif",
      nowIso: "2026-09-06T10:00:00.000Z",
    });

    await addTagToInitiative(db, initiative.id, {
      name: "acil",
      color: "rose",
    });
    await addTagToInitiative(db, initiative.id, {
      name: "q3",
      color: "teal",
    });

    const tags = await listTagsForInitiative(db, initiative.id);
    expect(tags.map((tag) => tag.name)).toEqual(["acil", "q3"]);
    const catalog = await listInitiativeTags(db);
    expect(catalog).toHaveLength(2);
    db.close();
  });

  it("updates and deletes an initiative tag", async () => {
    const db = openTestAsyncDb();
    await ensureInitiativeTagsSchema(db);
    const initiative = await createInitiative(db, {
      name: "Beta",
      status: "aktif",
      nowIso: "2026-09-06T10:00:00.000Z",
    });
    const tag = await addTagToInitiative(db, initiative.id, {
      name: "eski",
      color: "slate",
    });

    const updated = await updateInitiativeTag(db, tag.id, {
      name: "yeni",
      color: "indigo",
    });
    expect(updated).toEqual(
      expect.objectContaining({ name: "yeni", color: "indigo" }),
    );

    await deleteInitiativeTag(db, tag.id);
    expect(await listTagsForInitiative(db, initiative.id)).toEqual([]);
    db.close();
  });

  it("links an existing catalog tag onto another initiative and unlinks", async () => {
    const db = openTestAsyncDb();
    await ensureInitiativeTagsSchema(db);
    const first = await createInitiative(db, {
      name: "Bir",
      status: "aktif",
      nowIso: "2026-09-06T10:00:00.000Z",
    });
    const second = await createInitiative(db, {
      name: "Iki",
      status: "aktif",
      nowIso: "2026-09-06T10:01:00.000Z",
    });
    const tag = await addTagToInitiative(db, first.id, {
      name: "ortak",
      color: "amber",
    });

    await linkTagToInitiative(db, second.id, tag.id);
    expect(
      (await listTagsForInitiative(db, second.id)).map((item) => item.name),
    ).toEqual(["ortak"]);
    expect(await listInitiativeTags(db)).toHaveLength(1);

    await removeTagFromInitiative(db, second.id, tag.id);
    expect(await listTagsForInitiative(db, second.id)).toEqual([]);
    expect(await listTagsForInitiative(db, first.id)).toHaveLength(1);
    db.close();
  });

  it("listInitiatives includes tags on each initiative", async () => {
    const db = openTestAsyncDb();
    await ensureInitiativeTagsSchema(db);
    const initiative = await createInitiative(db, {
      name: "Gamma",
      status: "aktif",
      nowIso: "2026-09-06T11:00:00.000Z",
    });
    await addTagToInitiative(db, initiative.id, {
      name: "platform",
      color: "sky",
    });

    const listed = await listInitiatives(db);
    const row = listed.find((item) => item.id === initiative.id)!;
    expect(row.tags.map((tag) => tag.name)).toEqual(["platform"]);
    db.close();
  });
});
