// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppDb } from "../src/db/appDb";
import type { Initiative, Note } from "../src/lib/types";
import InitiativeDetailView from "../src/views/InitiativeDetailView";

afterEach(cleanup);

const initiative: Initiative = {
  id: 2,
  name: "Lansman",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-06T09:00:00.000Z",
  lastActivityAt: "2026-09-06T09:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
};

const note: Note = {
  id: 51,
  body: "RFC guncelleme",
  createdAt: "2026-09-06T01:24:50.000Z",
  updatedAt: "2026-09-06T01:25:12.000Z",
  deletedAt: null,
  tags: [],
  personIds: [],
  initiativeIds: [2],
  topicIds: [],
  nextReminderDueAt: null,
};

describe("InitiativeDetailView note tags", () => {
  it("adds a note tag on a linked initiative note", async () => {
    const tagged = {
      ...note,
      tags: [{ id: 9, name: "rfc", color: "blue" }],
    };
    const addTagToNote = vi.fn().mockResolvedValue(tagged.tags[0]);
    const listTopicsWithNotesForInitiative = vi
      .fn()
      .mockResolvedValueOnce({ topics: [], untopicNotes: [note] })
      .mockResolvedValue({ topics: [], untopicNotes: [tagged] });
    const listNoteTags = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValue(tagged.tags);

    const db = {
      createReminder: vi.fn(),
      createNote: vi.fn(),
      createTopic: vi.fn(),
      listTopicsWithNotesForInitiative,
      updateInitiative: vi.fn(),
      updateNote: vi.fn(),
      softDeleteNote: vi.fn(),
      updateTopic: vi.fn(),
      addTagToTopic: vi.fn(),
      linkTagToTopic: vi.fn(),
      listTopicTags: vi.fn().mockResolvedValue([]),
      updateTopicTag: vi.fn(),
      deleteTopicTag: vi.fn(),
      linkNoteToTopics: vi.fn(),
      addTagToNote,
      linkTagToNote: vi.fn(),
      listNoteTags,
      updateNoteTag: vi.fn(),
      deleteNoteTag: vi.fn(),
      saveNoteImage: vi.fn(),
      getNoteImage: vi.fn(),
    } as unknown as AppDb;

    render(
      <InitiativeDetailView
        db={db}
        initiative={initiative}
        onBack={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    const list = await screen.findByRole("list", { name: "Konusuz notlar" });
    fireEvent.change(within(list).getByPlaceholderText("Etiket ekle…"), {
      target: { value: "rfc" },
    });
    fireEvent.click(within(list).getByRole("button", { name: "Ekle" }));

    await waitFor(() => {
      expect(addTagToNote).toHaveBeenCalledWith(51, {
        name: "rfc",
        color: expect.any(String),
      });
      expect(within(list).getByText("rfc")).toBeTruthy();
    });
  });
});
