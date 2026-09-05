// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppDb } from "../src/db/appDb";
import type { Note } from "../src/lib/types";
import ArchiveView from "../src/views/ArchiveView";

afterEach(cleanup);

const deletedNote: Note = {
  id: 7,
  body: "Arşivlenmiş toplantı notu",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
  deletedAt: "2026-09-05T11:00:00.000Z",
  tags: [{ id: 1, name: "toplantı", color: "slate" }],
  personIds: [],
  initiativeIds: [],
  topicIds: [],
};

function createDb(
  overrides: Partial<
    Pick<
      AppDb,
      | "listDeletedNotes"
      | "listArchivedPeople"
      | "listArchivedInitiatives"
      | "listTopicsWithNotesForPerson"
      | "listNotesForInitiative"
      | "restorePerson"
      | "restoreInitiative"
      | "permanentlyDeleteNote"
      | "restoreNote"
    >
  > = {},
) {
  return {
    listDeletedNotes: vi.fn().mockResolvedValue([deletedNote]),
    listArchivedPeople: vi.fn().mockResolvedValue([]),
    listArchivedInitiatives: vi.fn().mockResolvedValue([]),
    listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
      topics: [],
      untopicNotes: [],
    }),
    listNotesForInitiative: vi.fn().mockResolvedValue([]),
    restorePerson: vi.fn(),
    restoreInitiative: vi.fn(),
    permanentlyDeleteNote: vi.fn().mockResolvedValue(undefined),
    restoreNote: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("Archive notes", () => {
  it("lists archived notes and restores a note", async () => {
    const listDeletedNotes = vi
      .fn()
      .mockResolvedValueOnce([deletedNote])
      .mockResolvedValue([]);
    const restoreNote = vi.fn().mockResolvedValue(undefined);
    const db = createDb({ listDeletedNotes, restoreNote });

    render(<ArchiveView db={db} />);

    expect(await screen.findByText(deletedNote.body)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Geri yükle" }));

    await waitFor(() => {
      expect(restoreNote).toHaveBeenCalledWith(deletedNote.id);
      expect(screen.queryByText(deletedNote.body)).toBeNull();
    });
  });

  it("asks for confirmation before permanently deleting a note", async () => {
    const listDeletedNotes = vi
      .fn()
      .mockResolvedValueOnce([deletedNote])
      .mockResolvedValue([]);
    const permanentlyDeleteNote = vi.fn().mockResolvedValue(undefined);
    const db = createDb({ listDeletedNotes, permanentlyDeleteNote });

    render(<ArchiveView db={db} />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Kalıcı sil" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(
      screen.getByText("Bu not kalıcı olarak silinecek. Emin misiniz?"),
    ).toBeTruthy();
    expect(permanentlyDeleteNote).not.toHaveBeenCalled();

    fireEvent.click(
      screen.getByRole("button", { name: "Kalıcı olarak sil" }),
    );

    await waitFor(() => {
      expect(permanentlyDeleteNote).toHaveBeenCalledWith(deletedNote.id);
      expect(dialog.isConnected).toBe(false);
      expect(screen.queryByText(deletedNote.body)).toBeNull();
    });
  });

  it("cancels permanent deletion without deleting the note", async () => {
    const db = createDb();
    render(<ArchiveView db={db} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Kalıcı sil" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(db.permanentlyDeleteNote).not.toHaveBeenCalled();
    expect(screen.getByText(deletedNote.body)).toBeTruthy();
  });

  it("lists archived initiatives and restores them", async () => {
    const archivedInitiative = {
      id: 4,
      name: "Atlas taşıma",
      status: "aktif" as const,
      blockerSummary: null,
      createdAt: "2026-09-05T09:00:00.000Z",
      sortOrder: 0,
      archivedAt: "2026-09-05T12:00:00.000Z",
    };
    const listArchivedInitiatives = vi
      .fn()
      .mockResolvedValueOnce([archivedInitiative])
      .mockResolvedValue([]);
    const restoreInitiative = vi.fn().mockResolvedValue(archivedInitiative);
    const db = createDb({
      listDeletedNotes: vi.fn().mockResolvedValue([]),
      listArchivedInitiatives,
      restoreInitiative,
    });

    render(<ArchiveView db={db} />);

    expect(await screen.findByText("Atlas taşıma")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Geri yükle" }));

    await waitFor(() => {
      expect(restoreInitiative).toHaveBeenCalledWith(4);
      expect(screen.queryByText("Atlas taşıma")).toBeNull();
    });
  });
});
