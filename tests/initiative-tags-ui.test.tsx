// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppDb } from "../src/db/appDb";
import type { Initiative, InitiativeTag } from "../src/lib/types";
import InitiativeDetailView from "../src/views/InitiativeDetailView";

afterEach(() => {
  cleanup();
});

const baseInitiative: Initiative = {
  id: 1,
  name: "Atlas",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-06T10:00:00.000Z",
  lastActivityAt: "2026-09-06T10:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
  tags: [],
};

function detailDb(overrides: Partial<AppDb> = {}): AppDb {
  return {
    listNotesForInitiative: vi.fn(async () => []),
    listTopicsWithNotesForInitiative: vi.fn(async () => ({
      topics: [],
      untopicNotes: [],
    })),
    listNoteTags: vi.fn(async () => []),
    listTopicTags: vi.fn(async () => []),
    listInitiativeTags: vi.fn(async () => [] as InitiativeTag[]),
    addTagToInitiative: vi.fn(),
    linkTagToInitiative: vi.fn(),
    updateInitiativeTag: vi.fn(),
    deleteInitiativeTag: vi.fn(),
    removeTagFromInitiative: vi.fn(),
    updateInitiative: vi.fn(async () => baseInitiative),
    createReminder: vi.fn(),
    createNote: vi.fn(),
    createTopic: vi.fn(),
    updateNote: vi.fn(),
    softDeleteNote: vi.fn(),
    updateTopic: vi.fn(),
    addTagToNote: vi.fn(),
    linkTagToNote: vi.fn(),
    updateNoteTag: vi.fn(),
    deleteNoteTag: vi.fn(),
    addTagToTopic: vi.fn(),
    linkTagToTopic: vi.fn(),
    updateTopicTag: vi.fn(),
    deleteTopicTag: vi.fn(),
    linkNoteToTopics: vi.fn(),
    saveNoteImage: vi.fn(),
    getNoteImage: vi.fn(),
    ...overrides,
  } as unknown as AppDb;
}

describe("initiative tags UI", () => {
  it("adds a tag on initiative detail", async () => {
    const created: InitiativeTag = {
      id: 9,
      name: "acil",
      color: "rose",
      createdAt: "2026-09-06T10:05:00.000Z",
    };
    const addTagToInitiative = vi.fn(async () => created);
    const listInitiativeTags = vi.fn(async () => [] as InitiativeTag[]);

    render(
      <InitiativeDetailView
        db={detailDb({
          listInitiativeTags,
          addTagToInitiative,
          updateInitiative: vi.fn(async () => ({
            ...baseInitiative,
            tags: [created],
          })),
        })}
        initiative={baseInitiative}
        onBack={() => undefined}
        onToast={() => undefined}
      />,
    );

    await waitFor(() => {
      expect(listInitiativeTags).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByPlaceholderText("Etiket ekle…"), {
      target: { value: "acil" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ekle" }));

    await waitFor(() => {
      expect(addTagToInitiative).toHaveBeenCalledWith(1, {
        name: "acil",
        color: expect.any(String),
      });
    });
  });
});
