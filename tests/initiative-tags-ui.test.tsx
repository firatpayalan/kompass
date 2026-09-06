// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppDb } from "../src/db/appDb";
import type { Initiative, InitiativeTag } from "../src/lib/types";
import InitiativeDetailView from "../src/views/InitiativeDetailView";
import InitiativesView from "../src/views/InitiativesView";

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

  it("filters initiatives list by selected tags with AND", async () => {
    const listInitiatives = vi.fn(async () => initiatives);
    const initiatives: Initiative[] = [
      {
        ...baseInitiative,
        id: 1,
        name: "Sadece acil",
        tags: [
          {
            id: 1,
            name: "acil",
            color: "rose",
            createdAt: "2026-09-06T10:00:00.000Z",
          },
        ],
      },
      {
        ...baseInitiative,
        id: 2,
        name: "Acil ve q3",
        tags: [
          {
            id: 1,
            name: "acil",
            color: "rose",
            createdAt: "2026-09-06T10:00:00.000Z",
          },
          {
            id: 2,
            name: "q3",
            color: "teal",
            createdAt: "2026-09-06T10:00:00.000Z",
          },
        ],
      },
    ];

    render(
      <InitiativesView
        db={
          {
            listInitiatives,
            listInitiativeTags: vi.fn(async () => [
              {
                id: 1,
                name: "acil",
                color: "rose",
                createdAt: "2026-09-06T10:00:00.000Z",
              },
              {
                id: 2,
                name: "q3",
                color: "teal",
                createdAt: "2026-09-06T10:00:00.000Z",
              },
            ]),
            createInitiative: vi.fn(),
            createNote: vi.fn(),
            reorderInitiatives: vi.fn(),
            archiveInitiative: vi.fn(),
          } as never
        }
      />,
    );

    await screen.findByRole("button", { name: "Sadece acil" });
    expect(listInitiatives).toHaveBeenCalled();

    const acilRow = screen.getByRole("button", { name: "Sadece acil" });
    expect(
      within(acilRow).getByText("acil", { selector: ".person-label-badge" }),
    ).toBeTruthy();

    const filter = screen.getByRole("group", { name: "Etiket filtresi" });
    expect(
      within(filter).getByRole("button", { name: "Tümü" }).getAttribute(
        "aria-pressed",
      ),
    ).toBe("true");

    fireEvent.click(within(filter).getByRole("button", { name: "acil" }));
    fireEvent.click(within(filter).getByRole("button", { name: "q3" }));

    expect(screen.queryByRole("button", { name: "Sadece acil" })).toBeNull();
    expect(screen.getByRole("button", { name: "Acil ve q3" })).toBeTruthy();

    fireEvent.click(within(filter).getByRole("button", { name: "Tümü" }));

    expect(screen.getByRole("button", { name: "Sadece acil" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Acil ve q3" })).toBeTruthy();
  });

  it("shows empty filter state when no initiative matches", async () => {
    render(
      <InitiativesView
        db={
          {
            listInitiatives: vi.fn(async () => [
              {
                ...baseInitiative,
                name: "Sadece acil",
                tags: [
                  {
                    id: 1,
                    name: "acil",
                    color: "rose",
                    createdAt: "2026-09-06T10:00:00.000Z",
                  },
                ],
              },
            ]),
            listInitiativeTags: vi.fn(async () => [
              {
                id: 1,
                name: "acil",
                color: "rose",
                createdAt: "2026-09-06T10:00:00.000Z",
              },
              {
                id: 2,
                name: "q3",
                color: "teal",
                createdAt: "2026-09-06T10:00:00.000Z",
              },
            ]),
            createInitiative: vi.fn(),
            createNote: vi.fn(),
            reorderInitiatives: vi.fn(),
            archiveInitiative: vi.fn(),
          } as never
        }
      />,
    );

    await screen.findByRole("button", { name: "Sadece acil" });

    const filter = screen.getByRole("group", { name: "Etiket filtresi" });
    fireEvent.click(within(filter).getByRole("button", { name: "q3" }));

    expect(screen.queryByRole("button", { name: "Sadece acil" })).toBeNull();
    expect(screen.getByText("Bu etiketlere uyan iş yok.")).toBeTruthy();
    expect(screen.queryByText("Henüz iş yok.")).toBeNull();
  });
});
