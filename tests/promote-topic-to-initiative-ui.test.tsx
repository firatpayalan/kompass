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
import type { TopicWithNotes } from "../src/db/topicsRepo";
import type { Initiative, Person } from "../src/lib/types";
import InitiativeDetailView from "../src/views/InitiativeDetailView";
import PersonDetailView from "../src/views/PersonDetailView";

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

const createdInitiative: Initiative = {
  id: 99,
  name: "RFC",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-18T10:00:00.000Z",
  lastActivityAt: "2026-09-18T10:00:00.000Z",
  sortOrder: 1,
  archivedAt: null,
  tags: [],
};

const person: Person = {
  id: 1,
  name: "tayfun",
  roleOrNotes: null,
  createdAt: "2026-09-06T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const personTopic: TopicWithNotes = {
  id: 11,
  personId: 1,
  initiativeId: null,
  title: "Faruk mentorluk",
  createdAt: "2026-09-06T09:00:00.000Z",
  tags: [],
  notes: [],
};

function baseDb(overrides: Partial<AppDb> = {}) {
  return {
    createReminder: vi.fn(),
    createNote: vi.fn(),
    createTopic: vi.fn(),
    listTopicsWithNotesForInitiative: vi.fn().mockResolvedValue({
      topics: [topic],
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
    promoteTopicToInitiative: vi.fn(),
    ...overrides,
  } as unknown as AppDb;
}

describe("promote topic to initiative UI", () => {
  it("promotes a topic from the context menu after confirm", async () => {
    const promoteTopicToInitiative = vi
      .fn()
      .mockResolvedValue(createdInitiative);
    const onSelectInitiative = vi.fn();
    const onToast = vi.fn();

    render(
      <InitiativeDetailView
        db={baseDb({ promoteTopicToInitiative })}
        initiative={initiative}
        onBack={vi.fn()}
        onSelectInitiative={onSelectInitiative}
        onToast={onToast}
      />,
    );

    const header = (await screen.findByText("RFC")).closest(
      ".topic-card__header",
    );
    expect(header).toBeTruthy();
    fireEvent.contextMenu(header!);
    fireEvent.click(screen.getByRole("button", { name: "İşe çevir" }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "İşe çevir" }),
    ).toBeTruthy();
    expect(
      within(dialog).getByText(
        "“RFC” yeni bir iş olacak. Konu burada kalır; iki yönlü taşıma notu eklenir.",
      ),
    ).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "İşe çevir" }));

    await waitFor(() => {
      expect(promoteTopicToInitiative).toHaveBeenCalledWith(
        10,
        expect.any(String),
      );
      expect(onToast).toHaveBeenCalledWith("İş oluşturuldu");
      expect(onSelectInitiative).toHaveBeenCalledWith(createdInitiative);
    });
  });

  it("toasts formatError when promote fails", async () => {
    const promoteTopicToInitiative = vi
      .fn()
      .mockRejectedValue(new Error("Bu isimde kayıt var"));
    const onSelectInitiative = vi.fn();
    const onToast = vi.fn();

    render(
      <InitiativeDetailView
        db={baseDb({ promoteTopicToInitiative })}
        initiative={initiative}
        onBack={vi.fn()}
        onSelectInitiative={onSelectInitiative}
        onToast={onToast}
      />,
    );

    const header = (await screen.findByText("RFC")).closest(
      ".topic-card__header",
    );
    fireEvent.contextMenu(header!);
    fireEvent.click(screen.getByRole("button", { name: "İşe çevir" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "İşe çevir",
      }),
    );

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Bu isimde kayıt var");
    });
    expect(onSelectInitiative).not.toHaveBeenCalled();
  });

  it("does not open İşe çevir from the topic note field", async () => {
    render(
      <InitiativeDetailView
        db={baseDb()}
        initiative={initiative}
        onBack={vi.fn()}
        onSelectInitiative={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /RFC/ }));
    fireEvent.contextMenu(screen.getByLabelText("Not ekle"));
    expect(screen.queryByRole("button", { name: "İşe çevir" })).toBeNull();
  });

  it("does not offer İşe çevir on person detail topics", async () => {
    render(
      <PersonDetailView
        db={
          {
            createNote: vi.fn(),
            createTopic: vi.fn(),
            createReminder: vi.fn(),
            listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
              topics: [personTopic],
              untopicNotes: [],
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
            linkNoteToTopics: vi.fn(),
            saveNoteImage: vi.fn(),
            getNoteImage: vi.fn(),
          } as unknown as AppDb
        }
        onBack={vi.fn()}
        person={person}
      />,
    );

    const card = (await screen.findByText("Faruk mentorluk")).closest(
      "article",
    );
    expect(card).toBeTruthy();
    fireEvent.contextMenu(card!);
    expect(screen.queryByRole("button", { name: "İşe çevir" })).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
