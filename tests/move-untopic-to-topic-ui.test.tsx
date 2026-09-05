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
import type { Note, Person } from "../src/lib/types";
import type { TopicWithNotes } from "../src/db/topicsRepo";
import PersonDetailView from "../src/views/PersonDetailView";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "tayfun",
  roleOrNotes: null,
  createdAt: "2026-09-06T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const topic: TopicWithNotes = {
  id: 10,
  personId: 1,
  title: "Faruk mentorluk",
  createdAt: "2026-09-06T09:00:00.000Z",
  tags: [],
  notes: [],
};

const untopicNote: Note = {
  id: 20,
  body: "faruk haftaya az calisacagini tayfuna soyledi",
  createdAt: "2026-09-06T10:00:00.000Z",
  updatedAt: "2026-09-06T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [1],
  initiativeIds: [],
  topicIds: [],
  nextReminderDueAt: null,
};

function baseDb(overrides: Partial<AppDb> = {}) {
  return {
    createNote: vi.fn(),
    createTopic: vi.fn(),
    listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
      topics: [topic],
      untopicNotes: [untopicNote],
    }),
    updateNote: vi.fn(),
    softDeleteNote: vi.fn(),
    updateTopic: vi.fn(),
    updatePerson: vi.fn(),
    listPersonLabels: vi.fn().mockResolvedValue([]),
    createPersonLabel: vi.fn(),
    updatePersonLabel: vi.fn(),
    deletePersonLabel: vi.fn(),
    addTagToTopic: vi.fn(),
    linkTagToTopic: vi.fn(),
    listTopicTags: vi.fn().mockResolvedValue([]),
    updateTopicTag: vi.fn(),
    deleteTopicTag: vi.fn(),
    addTagToNote: vi.fn(),
    linkTagToNote: vi.fn(),
    listNoteTags: vi.fn().mockResolvedValue([]),
    updateNoteTag: vi.fn(),
    deleteNoteTag: vi.fn(),
    linkNoteToTopics: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as AppDb;
}

describe("move untopic notes to topics", () => {
  it("moves an untopic note into the selected topic", async () => {
    const linkNoteToTopics = vi.fn().mockResolvedValue(undefined);
    const listTopicsWithNotesForPerson = vi
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
      <PersonDetailView
        db={baseDb({ linkNoteToTopics, listTopicsWithNotesForPerson })}
        onBack={vi.fn()}
        onToast={onToast}
        person={person}
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

  it("hides move controls when the person has no topics", async () => {
    render(
      <PersonDetailView
        db={baseDb({
          listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
            topics: [],
            untopicNotes: [untopicNote],
          }),
        })}
        onBack={vi.fn()}
        person={person}
      />,
    );

    expect(await screen.findByText(untopicNote.body)).toBeTruthy();
    expect(screen.queryByLabelText("Konuya taşı")).toBeNull();
    expect(screen.queryByRole("button", { name: "Taşı" })).toBeNull();
  });

  it("toasts when Taşı is clicked without a topic", async () => {
    const linkNoteToTopics = vi.fn();
    const onToast = vi.fn();

    render(
      <PersonDetailView
        db={baseDb({ linkNoteToTopics })}
        onBack={vi.fn()}
        onToast={onToast}
        person={person}
      />,
    );

    const untopic = await screen.findByRole("list", { name: "Konusuz notlar" });
    fireEvent.click(within(untopic).getByRole("button", { name: "Taşı" }));

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Konu seçin");
    });
    expect(linkNoteToTopics).not.toHaveBeenCalled();
  });
});
