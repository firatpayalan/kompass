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

import App from "../src/App";
import type { AppDb } from "../src/db/appDb";
import InitiativeDetailView from "../src/views/InitiativeDetailView";
import InitiativesView from "../src/views/InitiativesView";
import PeopleView from "../src/views/PeopleView";
import PersonDetailView from "../src/views/PersonDetailView";
import type { Initiative, Note, Person } from "../src/lib/types";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "Ayşe",
  roleOrNotes: "Ürün lideri",
  createdAt: "2026-09-05T08:00:00.000Z",
};

const initiative: Initiative = {
  id: 2,
  name: "Lansman",
  status: "aktif",
  blockerSummary: "Bütçe onayı",
  createdAt: "2026-09-05T09:00:00.000Z",
};

const notes: Note[] = [
  {
    id: 11,
    body: "Yeni görüşme",
    createdAt: "2026-09-05T11:00:00.000Z",
    updatedAt: "2026-09-05T11:00:00.000Z",
    deletedAt: null,
    tags: [],
    personIds: [1],
    initiativeIds: [2],
  },
  {
    id: 10,
    body: "İlk görüşme",
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
    deletedAt: null,
    tags: [],
    personIds: [1],
    initiativeIds: [2],
  },
];

describe("Task 13 people and initiatives UI", () => {
  it("navigates from the people list to a person detail view", async () => {
    const db = {
      createPerson: vi.fn(),
      listPeople: vi.fn().mockResolvedValue([person]),
      listNotesForPerson: vi.fn().mockResolvedValue(notes),
    } as unknown as AppDb;
    render(<App db={db} />);

    fireEvent.click(screen.getByRole("button", { name: "Kişiler" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ayşe" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Ayşe" }),
    ).toBeTruthy();
    expect(db.listNotesForPerson).toHaveBeenCalledWith(1);
  });

  it("shows existing people and opens their detail view", async () => {
    const onSelectPerson = vi.fn();
    render(
      <PeopleView
        db={{
          createPerson: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([person]),
        }}
        onSelectPerson={onSelectPerson}
        onToast={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ayşe" }));

    expect(onSelectPerson).toHaveBeenCalledWith(person);
  });

  it("uses an existing person and shows a toast for a duplicate name", async () => {
    const onSelectPerson = vi.fn();
    const onToast = vi.fn();
    render(
      <PeopleView
        db={{
          createPerson: vi
            .fn()
            .mockRejectedValue(new Error("Bu isimde kayıt var")),
          listPeople: vi.fn().mockResolvedValue([person]),
        }}
        onSelectPerson={onSelectPerson}
        onToast={onToast}
      />,
    );

    await screen.findByRole("button", { name: "Ayşe" });
    fireEvent.change(screen.getByLabelText("Ad"), {
      target: { value: "Ayşe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kişi ekle" }));

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Bu isimde kayıt var");
      expect(onSelectPerson).toHaveBeenCalledWith(person);
    });
  });

  it("creates an initiative with status and blocker summary", async () => {
    const createInitiative = vi.fn().mockResolvedValue(initiative);
    const onSelectInitiative = vi.fn();
    render(
      <InitiativesView
        db={{
          createInitiative,
          listInitiatives: vi.fn().mockResolvedValue([]),
        }}
        onSelectInitiative={onSelectInitiative}
        onToast={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("İş adı"), {
      target: { value: "Lansman" },
    });
    fireEvent.change(screen.getByLabelText("Durum"), {
      target: { value: "aktif" },
    });
    fireEvent.change(screen.getByLabelText("Engel özeti"), {
      target: { value: "Bütçe onayı" },
    });
    fireEvent.click(screen.getByRole("button", { name: "İş ekle" }));

    await waitFor(() =>
      expect(createInitiative).toHaveBeenCalledWith({
        name: "Lansman",
        status: "aktif",
        blockerSummary: "Bütçe onayı",
        nowIso: expect.any(String),
      }),
    );
    expect(onSelectInitiative).toHaveBeenCalledWith(initiative);
  });

  it("shows a person's linked notes in repository chronology", async () => {
    render(
      <PersonDetailView
        db={{ listNotesForPerson: vi.fn().mockResolvedValue(notes) }}
        onBack={vi.fn()}
        person={person}
      />,
    );

    const list = await screen.findByRole("list", { name: "Bağlı notlar" });
    expect(
      within(list).getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("Yeni görüşme"),
      expect.stringContaining("İlk görüşme"),
    ]);
  });

  it("shows initiative status, blocker, and linked notes", async () => {
    render(
      <InitiativeDetailView
        db={{ listNotesForInitiative: vi.fn().mockResolvedValue(notes) }}
        initiative={initiative}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Aktif")).toBeTruthy();
    expect(screen.getByText("Bütçe onayı")).toBeTruthy();
    expect(
      await screen.findByRole("list", { name: "Bağlı notlar" }),
    ).toBeTruthy();
  });
});
