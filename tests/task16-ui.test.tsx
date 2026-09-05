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
import TrashView from "../src/views/TrashView";

afterEach(cleanup);

const deletedNote: Note = {
  id: 7,
  body: "Silinen toplantı notu",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
  deletedAt: "2026-09-05T11:00:00.000Z",
  tags: ["toplantı"],
  personIds: [],
  initiativeIds: [],
};

function createDb(
  overrides: Partial<
    Pick<
      AppDb,
      "listDeletedNotes" | "permanentlyDeleteNote" | "restoreNote"
    >
  > = {},
) {
  return {
    listDeletedNotes: vi.fn().mockResolvedValue([deletedNote]),
    permanentlyDeleteNote: vi.fn().mockResolvedValue(undefined),
    restoreNote: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("Task 16 Silinenler view", () => {
  it("lists deleted notes and restores a note", async () => {
    const listDeletedNotes = vi
      .fn()
      .mockResolvedValueOnce([deletedNote])
      .mockResolvedValue([]);
    const restoreNote = vi.fn().mockResolvedValue(undefined);
    const db = createDb({ listDeletedNotes, restoreNote });

    render(<TrashView db={db} />);

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

    render(<TrashView db={db} />);
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
    render(<TrashView db={db} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Kalıcı sil" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(db.permanentlyDeleteNote).not.toHaveBeenCalled();
    expect(screen.getByText(deletedNote.body)).toBeTruthy();
  });
});
