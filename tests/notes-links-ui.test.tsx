// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppDb } from "../src/db/appDb";
import type { Initiative, Note, Person } from "../src/lib/types";
import NotesView from "../src/views/NotesView";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "Ayşe",
  roleOrNotes: null,
  createdAt: "2026-09-05T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const initiative: Initiative = {
  id: 2,
  name: "Lansman",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-05T09:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
};

const linkedNote: Note = {
  id: 9,
  body: "Bağlı not",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [1],
  initiativeIds: [2],
  topicIds: [],
  nextReminderDueAt: null,
};

describe("NotesView links", () => {
  it("shows linked people and initiatives on notes", async () => {
    const db = {
      listActiveNotes: vi.fn().mockResolvedValue([linkedNote]),
      listPeople: vi.fn().mockResolvedValue([person]),
      listInitiatives: vi.fn().mockResolvedValue([initiative]),
      listNoteTags: vi.fn().mockResolvedValue([]),
      createReminder: vi.fn(),
      softDeleteNote: vi.fn(),
      updateNote: vi.fn(),
      addTagToNote: vi.fn(),
      linkTagToNote: vi.fn(),
      updateNoteTag: vi.fn(),
      deleteNoteTag: vi.fn(),
    } as unknown as AppDb;

    render(<NotesView db={db} />);

    expect(await screen.findByText("Ayşe")).toBeTruthy();
    expect(screen.getByText("Lansman")).toBeTruthy();
    expect(screen.getByLabelText("Bağlantılar")).toBeTruthy();
  });
});
