// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import App from "../src/App";
import type { AppDb } from "../src/db/appDb";
import type { Initiative, Note, Person } from "../src/lib/types";
import SearchView from "../src/views/SearchView";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "Ayşe Demir",
  roleOrNotes: "Ürün lideri",
  createdAt: "2026-09-05T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const initiative: Initiative = {
  id: 2,
  name: "Phoenix Lansmanı",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-05T09:00:00.000Z",
  lastActivityAt: "2026-09-05T09:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
};

const resultNote: Note = {
  id: 3,
  body: "Strateji toplantısı notları",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
  deletedAt: null,
  tags: [{ id: 1, name: "strateji", color: "slate" }],
  personIds: [],
  initiativeIds: [],
    topicIds: [],
    nextReminderDueAt: null,
  };

function createDb(overrides: Partial<AppDb> = {}): AppDb {
  return {
    advanceOrCompleteReminder: vi.fn(),
    createInitiative: vi.fn(),
    createNote: vi.fn(),
    createPerson: vi.fn(),
    createReminder: vi.fn(),
    createTopic: vi.fn(),
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
    updateTopic: vi.fn(),
    deleteInitiative: vi.fn(),
    deletePerson: vi.fn(),
    listArchivedPeople: vi.fn().mockResolvedValue([]),
    listArchivedInitiatives: vi.fn().mockResolvedValue([]),
    archivePerson: vi.fn(),
    archiveInitiative: vi.fn(),
    restorePerson: vi.fn(),
    restoreInitiative: vi.fn(),
    findPersonByName: vi.fn(),
    getNote: vi.fn(),
    linkNoteToInitiatives: vi.fn(),
    linkNoteToTopics: vi.fn(),
    linkNoteToPeople: vi.fn(),
    listActiveNotes: vi.fn().mockResolvedValue([]),
    listInboxNotes: vi.fn().mockResolvedValue([]),
    listDeletedNotes: vi.fn().mockResolvedValue([]),
    listDueRemindersForBugun: vi.fn().mockResolvedValue([]),
    listOverdueReminders: vi.fn().mockResolvedValue([]),
    listUpcomingReminders: vi.fn().mockResolvedValue([]),
    listInitiatives: vi.fn().mockResolvedValue([initiative]),
    listNotesForInitiative: vi.fn().mockResolvedValue([]),
    listNotesForPerson: vi.fn().mockResolvedValue([]),
    listPeople: vi.fn().mockResolvedValue([person]),
    listPersonLabels: vi.fn().mockResolvedValue([]),
    createPersonLabel: vi.fn(),
          updatePersonLabel: vi.fn(),
          deletePersonLabel: vi.fn(),
    updatePerson: vi.fn(),
    listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({ topics: [], untopicNotes: [] }),
    markReminderDone: vi.fn(),
    permanentlyDeleteNote: vi.fn(),
    restoreNote: vi.fn(),
    searchNotes: vi.fn().mockResolvedValue([]),
    softDeleteNote: vi.fn(),
    updateInitiative: vi.fn(),
    updateNote: vi.fn(),
    reorderPeople: vi.fn(),
    reorderInitiatives: vi.fn(),
    ...overrides,
  };
}

describe("Task 15 search and keyboard navigation", () => {
  it("searches notes with searchNotes and renders Turkish results", async () => {
    const searchNotes = vi.fn().mockResolvedValue([resultNote]);
    render(<SearchView db={{ searchNotes }} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Notlarda ara" }), {
      target: { value: "strateji" },
    });

    expect(await screen.findByText("Strateji toplantısı notları")).toBeTruthy();
    expect(searchNotes).toHaveBeenCalledWith("strateji");
  });

  it("supports quick note, palette, search, numbered views, and escape", async () => {
    render(<App db={createDb()} />);

    fireEvent.keyDown(window, { key: "n", metaKey: true });
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    const numberedViews = [
      ["1", "Bugün"],
      ["2", "Notlar"],
      ["3", "Kişiler"],
      ["4", "İşler"],
    ] as const;
    for (const [key, heading] of numberedViews) {
      fireEvent.keyDown(window, { key, metaKey: true });
      expect(
        await screen.findByRole("heading", { level: 1, name: heading }),
      ).toBeTruthy();
    }

    fireEvent.keyDown(window, { key: "f", metaKey: true });
    const searchInput = await screen.findByRole("searchbox", {
      name: "Notlarda ara",
    });
    expect(document.activeElement).toBe(searchInput);

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByRole("dialog", { name: "Komut paleti" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Arşiv" })).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Komut paleti" })).toBeNull();
  });

  it("filters people and initiatives by name and jumps to the selection", async () => {
    render(<App db={createDb()} />);
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    const input = screen.getByRole("combobox", { name: "Komut ara" });
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Ayşe Demir" })).toBeTruthy(),
    );
    fireEvent.change(input, { target: { value: "Ayşe" } });
    fireEvent.click(screen.getByRole("option", { name: "Ayşe Demir" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Ayşe Demir" }),
    ).toBeTruthy();

    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const reopenedInput = screen.getByRole("combobox", { name: "Komut ara" });
    await waitFor(() =>
      expect(
        screen.getByRole("option", { name: "Phoenix Lansmanı" }),
      ).toBeTruthy(),
    );
    fireEvent.change(reopenedInput, { target: { value: "Phoenix" } });
    fireEvent.click(
      screen.getByRole("option", { name: "Phoenix Lansmanı" }),
    );

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Phoenix Lansmanı",
      }),
    ).toBeTruthy();
  });
});
