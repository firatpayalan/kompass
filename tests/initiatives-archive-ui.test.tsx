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
import type { Initiative } from "../src/lib/types";
import InitiativesView from "../src/views/InitiativesView";

afterEach(cleanup);

const initiative: Initiative = {
  id: 1,
  name: "Atlas taşıma",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-05T09:00:00.000Z",
  lastActivityAt: "2026-09-05T09:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
  tags: [],
};

describe("InitiativesView archive", () => {
  it("archives an initiative after right-click confirm", async () => {
    const archiveInitiative = vi.fn().mockResolvedValue(undefined);
    const listInitiatives = vi
      .fn()
      .mockResolvedValueOnce([initiative])
      .mockResolvedValue([]);
    const onToast = vi.fn();

    const db = {
      createInitiative: vi.fn(),
      createNote: vi.fn(),
      listInitiatives,
      listInitiativeTags: vi.fn().mockResolvedValue([]),
      reorderInitiatives: vi.fn(),
      archiveInitiative,
    } as unknown as AppDb;

    render(<InitiativesView db={db} onToast={onToast} />);

    fireEvent.contextMenu(
      await screen.findByRole("button", { name: "Atlas taşıma" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "İşi arşivle" }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "İşi arşivle" }),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Arşivle" }));

    await waitFor(() => {
      expect(archiveInitiative).toHaveBeenCalledWith(1, expect.any(String));
      expect(onToast).toHaveBeenCalledWith("İş arşivlendi");
      expect(screen.queryByRole("button", { name: "Atlas taşıma" })).toBeNull();
    });
  });

  it("does not archive when confirm is cancelled", async () => {
    const archiveInitiative = vi.fn();
    const db = {
      createInitiative: vi.fn(),
      createNote: vi.fn(),
      listInitiatives: vi.fn().mockResolvedValue([initiative]),
      listInitiativeTags: vi.fn().mockResolvedValue([]),
      reorderInitiatives: vi.fn(),
      archiveInitiative,
    } as unknown as AppDb;

    render(<InitiativesView db={db} onToast={vi.fn()} />);

    fireEvent.contextMenu(
      await screen.findByRole("button", { name: "Atlas taşıma" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "İşi arşivle" }));
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(archiveInitiative).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Atlas taşıma" })).toBeTruthy();
  });
});
