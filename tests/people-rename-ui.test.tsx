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

function mockDb(overrides: Partial<AppDb> = {}): AppDb {
  return {
    createPerson: vi.fn(),
    listPeople: vi.fn().mockResolvedValue([person]),
    reorderPeople: vi.fn(),
    archivePerson: vi.fn(),
    updatePerson: vi.fn(),
    listPersonLabels: vi.fn().mockResolvedValue([]),
    createPersonLabel: vi.fn(),
    updatePersonLabel: vi.fn(),
    deletePersonLabel: vi.fn(),
    ...overrides,
  } as unknown as AppDb;
}

describe("PeopleView rename", () => {
  it("renames a person from the context menu inline", async () => {
    const updatePerson = vi.fn().mockResolvedValue({
      ...person,
      name: "Ayşe Yılmaz",
    });
    const onToast = vi.fn();

    render(
      <PeopleView db={mockDb({ updatePerson })} onToast={onToast} />,
    );

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Ayşe" }));
    fireEvent.click(screen.getByRole("button", { name: "İsmi değiştir" }));

    const input = screen.getByRole("textbox", {
      name: "Kişi adını düzenle",
    }) as HTMLInputElement;
    expect(input).toHaveProperty("value", "Ayşe");
    fireEvent.focus(input);
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe("Ayşe".length);
    fireEvent.change(input, { target: { value: "Ayşe Yılmaz" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(updatePerson).toHaveBeenCalledWith(1, { name: "Ayşe Yılmaz" });
      expect(screen.getByRole("button", { name: "Ayşe Yılmaz" })).toBeTruthy();
    });
  });

  it("cancels rename with Escape without calling updatePerson", async () => {
    const updatePerson = vi.fn();
    render(<PeopleView db={mockDb({ updatePerson })} onToast={vi.fn()} />);

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Ayşe" }));
    fireEvent.click(screen.getByRole("button", { name: "İsmi değiştir" }));

    const input = screen.getByRole("textbox", { name: "Kişi adını düzenle" });
    fireEvent.change(input, { target: { value: "Başka" } });
    fireEvent.keyDown(input, { key: "Escape" });
    fireEvent.blur(input);

    expect(updatePerson).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ayşe" })).toBeTruthy();
  });

  it("toasts when rename draft is empty", async () => {
    const updatePerson = vi.fn();
    const onToast = vi.fn();
    render(<PeopleView db={mockDb({ updatePerson })} onToast={onToast} />);

    fireEvent.contextMenu(await screen.findByRole("button", { name: "Ayşe" }));
    fireEvent.click(screen.getByRole("button", { name: "İsmi değiştir" }));

    const input = screen.getByRole("textbox", { name: "Kişi adını düzenle" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onToast).toHaveBeenCalledWith("İsim boş olamaz");
    expect(updatePerson).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Kişi adını düzenle" })).toBeTruthy();
  });
});
