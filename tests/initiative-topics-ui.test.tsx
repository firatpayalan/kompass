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
import type { TopicWithNotes } from "../src/db/topicsRepo";
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
  tags: [],
};

const topic: TopicWithNotes = {
  id: 10,
  personId: null,
  initiativeId: 2,
  title: "RFC",
  createdAt: "2026-09-06T09:00:00.000Z",
  tags: [],
  notes: [],
};

const untopicNote: Note = {
  id: 20,
  body: "Bütçe onayı bekleniyor",
  createdAt: "2026-09-06T10:00:00.000Z",
  updatedAt: "2026-09-06T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [],
  initiativeIds: [2],
  topicIds: [],
  nextReminderDueAt: null,
};

function baseDb(overrides: Partial<AppDb> = {}) {
  return {
    createReminder: vi.fn(),
    createNote: vi.fn(),
    createTopic: vi.fn(),
    listTopicsWithNotesForInitiative: vi.fn().mockResolvedValue({
      topics: [],
      untopicNotes: [],
    }),
    updateInitiative: vi.fn(),
    updateNote: vi.fn(),
    softDeleteNote: vi.fn(),
    updateTopic: vi.fn(),
    addTagToTopic: vi.fn(),
    linkTagToTopic: vi.fn(),
    listTopicTags: vi.fn().mockResolvedValue([]),
    updateTopicTag: vi.fn(),
    deleteTopicTag: vi.fn(),
    addTagToInitiative: vi.fn(),
    linkTagToInitiative: vi.fn(),
    listInitiativeTags: vi.fn(async () => []),
    updateInitiativeTag: vi.fn(),
    deleteInitiativeTag: vi.fn(),
    removeTagFromInitiative: vi.fn(),
    addTagToNote: vi.fn(),
    linkTagToNote: vi.fn(),
    listNoteTags: vi.fn().mockResolvedValue([]),
    updateNoteTag: vi.fn(),
    deleteNoteTag: vi.fn(),
    linkNoteToTopics: vi.fn().mockResolvedValue(undefined),
    saveNoteImage: vi.fn(),
    getNoteImage: vi.fn(),
    ...overrides,
  } as unknown as AppDb;
}

describe("InitiativeDetailView topics", () => {
  it("adds a topic via Konu ekle", async () => {
    const createTopic = vi.fn().mockResolvedValue({
      id: 10,
      personId: null,
      initiativeId: 2,
      title: "RFC",
      createdAt: "2026-09-06T09:00:00.000Z",
    });
    const listTopicsWithNotesForInitiative = vi
      .fn()
      .mockResolvedValueOnce({ topics: [], untopicNotes: [] })
      .mockResolvedValue({ topics: [topic], untopicNotes: [] });
    const onToast = vi.fn();

    render(
      <InitiativeDetailView
        db={baseDb({ createTopic, listTopicsWithNotesForInitiative })}
        initiative={initiative}
        onBack={vi.fn()}
        onToast={onToast}
      />,
    );

    await screen.findByText("Henüz konu yok. Yukarıdan bir konu ekleyin.");
    fireEvent.change(screen.getByLabelText("Yeni konu"), {
      target: { value: "RFC" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konu ekle" }));

    await waitFor(() => {
      expect(createTopic).toHaveBeenCalledWith({
        initiativeId: 2,
        title: "RFC",
      });
      expect(onToast).toHaveBeenCalledWith("Konu eklendi");
      expect(screen.getByText("RFC")).toBeTruthy();
    });
  });

  it("adds a note under a topic", async () => {
    const createNote = vi.fn().mockResolvedValue({ id: 99 });
    const listTopicsWithNotesForInitiative = vi
      .fn()
      .mockResolvedValueOnce({ topics: [topic], untopicNotes: [] })
      .mockResolvedValue({
        topics: [
          {
            ...topic,
            notes: [
              {
                id: 99,
                body: "RFC taslağı hazır",
                createdAt: "2026-09-06T12:00:00.000Z",
                updatedAt: "2026-09-06T12:00:00.000Z",
                deletedAt: null,
                tags: [],
                personIds: [],
                initiativeIds: [2],
                topicIds: [10],
                nextReminderDueAt: null,
              },
            ],
          },
        ],
        untopicNotes: [],
      });
    const onToast = vi.fn();

    render(
      <InitiativeDetailView
        db={baseDb({ createNote, listTopicsWithNotesForInitiative })}
        initiative={initiative}
        onBack={vi.fn()}
        onToast={onToast}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /RFC/ }));
    fireEvent.change(screen.getByLabelText("Not ekle"), {
      target: { value: "RFC taslağı hazır" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Not ekle" }));

    await waitFor(() => {
      expect(createNote).toHaveBeenCalledWith({
        body: "RFC taslağı hazır",
        initiativeIds: [2],
        personIds: [],
        topicIds: [10],
      });
      expect(onToast).toHaveBeenCalledWith("Not eklendi");
      expect(screen.getByText("RFC taslağı hazır")).toBeTruthy();
    });
  });

  it("shows untopic notes with Taşı when topics exist", async () => {
    const linkNoteToTopics = vi.fn().mockResolvedValue(undefined);
    const listTopicsWithNotesForInitiative = vi
      .fn()
      .mockResolvedValueOnce({
        topics: [topic],
        untopicNotes: [untopicNote],
      })
      .mockResolvedValue({
        topics: [
          {
            ...topic,
            notes: [{ ...untopicNote, topicIds: [topic.id] }],
          },
        ],
        untopicNotes: [],
      });
    const onToast = vi.fn();

    render(
      <InitiativeDetailView
        db={baseDb({ linkNoteToTopics, listTopicsWithNotesForInitiative })}
        initiative={initiative}
        onBack={vi.fn()}
        onToast={onToast}
      />,
    );

    const untopic = await screen.findByRole("list", { name: "Konusuz notlar" });
    const select = within(untopic).getByLabelText("Konuya taşı");
    fireEvent.change(select, { target: { value: String(topic.id) } });
    fireEvent.click(within(untopic).getByRole("button", { name: "Taşı" }));

    await waitFor(() => {
      expect(linkNoteToTopics).toHaveBeenCalledWith(untopicNote.id, [topic.id]);
      expect(onToast).toHaveBeenCalledWith("Nota konu bağlandı");
    });

    expect(screen.queryByRole("list", { name: "Konusuz notlar" })).toBeNull();
    expect(await screen.findByText(untopicNote.body)).toBeTruthy();
  });
});
