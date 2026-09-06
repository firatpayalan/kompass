import { describe, expect, it } from "vitest";
import {
  groupNotesForWeek,
  stripNoteImagesForLlm,
} from "../src/lib/weeklyDigest";
import type { Initiative, Note, Person } from "../src/lib/types";

const baseNote = (partial: Partial<Note> & Pick<Note, "id" | "body">): Note => ({
  createdAt: "2026-09-08T10:00:00.000Z",
  updatedAt: "2026-09-08T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [],
  initiativeIds: [],
  topicIds: [],
  nextReminderDueAt: null,
  ...partial,
});

describe("weeklyDigest", () => {
  it("groups into both sections when note has person and initiative", () => {
    const people: Person[] = [
      {
        id: 1,
        name: "Ayşe",
        roleOrNotes: null,
        createdAt: "2026-09-01T00:00:00.000Z",
        sortOrder: 0,
        label: null,
        archivedAt: null,
      },
    ];
    const initiatives: Initiative[] = [
      {
        id: 2,
        name: "Atlas",
        status: "aktif",
        blockerSummary: null,
        createdAt: "2026-09-01T00:00:00.000Z",
        lastActivityAt: "2026-09-01T00:00:00.000Z",
        sortOrder: 0,
        archivedAt: null,
        tags: [],
      },
    ];
    const notes = [
      baseNote({ id: 10, body: "hem", personIds: [1], initiativeIds: [2] }),
      baseNote({ id: 11, body: "inbox" }),
    ];
    const g = groupNotesForWeek(notes, people, initiatives);
    expect(g.noteCount).toBe(1);
    expect(g.personCount).toBe(1);
    expect(g.initiativeCount).toBe(1);
    expect(g.peopleSections[0].notes.map((n) => n.id)).toEqual([10]);
    expect(g.initiativeSections[0].notes.map((n) => n.id)).toEqual([10]);
  });

  it("strips dlt-img markers", () => {
    expect(stripNoteImagesForLlm("metin ![görsel](dlt-img:abc) son")).toBe(
      "metin son",
    );
  });
});
