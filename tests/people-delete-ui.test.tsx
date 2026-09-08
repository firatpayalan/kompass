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
import type { Person } from "../src/lib/types";
import PeopleView from "../src/views/PeopleView";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "Ayşe",
  roleOrNotes: "Ürün lideri",
  createdAt: "2026-09-05T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

describe("PeopleView archive", () => {
  it("archives a person after right-click confirm", async () => {
    const archivePerson = vi.fn().mockResolvedValue(undefined);
    const listPeople = vi
      .fn()
      .mockResolvedValueOnce([person])
      .mockResolvedValue([]);
    const onToast = vi.fn();

    const db = {
      createPerson: vi.fn(),
      listPeople,
      reorderPeople: vi.fn(),
      archivePerson,
      updatePerson: vi.fn(),
      listPersonLabels: vi.fn().mockResolvedValue([]),
      createPersonLabel: vi.fn(),
      updatePersonLabel: vi.fn(),
      deletePersonLabel: vi.fn(),
    } as unknown as AppDb;

    render(<PeopleView db={db} onToast={onToast} />);

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Ayşe" }));
    fireEvent.click(screen.getByRole("button", { name: "Kişiyi arşivle" }));

    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Kişiyi arşivle" }),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Arşivle" }));

    await waitFor(() => {
      expect(archivePerson).toHaveBeenCalledWith(1, expect.any(String));
      expect(onToast).toHaveBeenCalledWith("Kişi arşivlendi");
      expect(screen.queryByRole("button", { name: "Ayşe" })).toBeNull();
    });
  });

  it("does not archive when confirm is cancelled", async () => {
    const archivePerson = vi.fn();
    const db = {
      createPerson: vi.fn(),
      listPeople: vi.fn().mockResolvedValue([person]),
      reorderPeople: vi.fn(),
      archivePerson,
      updatePerson: vi.fn(),
      listPersonLabels: vi.fn().mockResolvedValue([]),
      createPersonLabel: vi.fn(),
      updatePersonLabel: vi.fn(),
      deletePersonLabel: vi.fn(),
    } as unknown as AppDb;

    render(<PeopleView db={db} onToast={vi.fn()} />);

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Ayşe" }));
    fireEvent.click(screen.getByRole("button", { name: "Kişiyi arşivle" }));
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(archivePerson).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ayşe" })).toBeTruthy();
  });
});
