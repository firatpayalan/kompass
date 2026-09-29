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
import type { ArchivedTopic, TopicWithNotes } from "../src/db/topicsRepo";
import type { Initiative } from "../src/lib/types";
import ArchiveView from "../src/views/ArchiveView";
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
  archivedAt: null,
  tags: [],
  notes: [],
};

function detailDb(overrides: Partial<AppDb> = {}) {
  return {
    createReminder: vi.fn(),
    createNote: vi.fn(),
    createTopic: vi.fn(),
    listTopicsWithNotesForInitiative: vi.fn().mockResolvedValue({
      topics: [topic],
      untopicNotes: [],
    }),
    promoteTopicToInitiative: vi.fn(),
    archiveTopic: vi.fn().mockResolvedValue(undefined),
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
    linkNoteToTopics: vi.fn(),
    saveNoteImage: vi.fn(),
    getNoteImage: vi.fn(),
    ...overrides,
  } as unknown as AppDb;
}

describe("topic archive UI", () => {
  it("archives a topic from the initiative context menu", async () => {
    const archiveTopic = vi.fn().mockResolvedValue(undefined);
    const listTopicsWithNotesForInitiative = vi
      .fn()
      .mockResolvedValueOnce({ topics: [topic], untopicNotes: [] })
      .mockResolvedValue({ topics: [], untopicNotes: [] });
    const onToast = vi.fn();

    render(
      <InitiativeDetailView
        db={detailDb({ archiveTopic, listTopicsWithNotesForInitiative })}
        initiative={initiative}
        onBack={vi.fn()}
        onToast={onToast}
      />,
    );

    expect(await screen.findByText("RFC")).toBeTruthy();
    fireEvent.contextMenu(screen.getByText("RFC"));
    fireEvent.click(screen.getByRole("button", { name: "Arşivle" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Arşivle" }));

    await waitFor(() => {
      expect(archiveTopic).toHaveBeenCalledWith(
        10,
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      );
      expect(onToast).toHaveBeenCalledWith("Konu arşivlendi");
    });
    expect(screen.queryByText("RFC")).toBeNull();
  });

  it("restores an archived topic from Archive", async () => {
    const archived: ArchivedTopic = {
      ...topic,
      archivedAt: "2026-09-06T11:00:00.000Z",
      ownerKind: "initiative",
      ownerName: "Lansman",
    };
    const listArchivedTopics = vi
      .fn()
      .mockResolvedValueOnce([archived])
      .mockResolvedValue([]);
    const restoreTopic = vi.fn().mockResolvedValue({
      ...topic,
      archivedAt: null,
    });
    const onToast = vi.fn();

    render(
      <ArchiveView
        db={{
          listArchivedPeople: vi.fn().mockResolvedValue([]),
          listArchivedInitiatives: vi.fn().mockResolvedValue([]),
          listArchivedTopics,
          listTopicsWithNotesForPerson: vi.fn(),
          listNotesForInitiative: vi.fn(),
          restorePerson: vi.fn(),
          restoreInitiative: vi.fn(),
          restoreTopic,
          listDeletedNotes: vi.fn().mockResolvedValue([]),
          restoreNote: vi.fn(),
          permanentlyDeleteNote: vi.fn(),
          getNoteImage: vi.fn(),
        }}
        onToast={onToast}
      />,
    );

    expect(await screen.findByText("RFC")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Geri yükle" }));

    await waitFor(() => {
      expect(restoreTopic).toHaveBeenCalledWith(10);
      expect(onToast).toHaveBeenCalledWith("Konu geri yüklendi");
    });
  });
});
