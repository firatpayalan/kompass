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
    topicIds: [5],
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
    topicIds: [5],
  },
];

const topicWithNotes = {
  id: 5,
  personId: 1,
  title: "1:1",
  createdAt: "2026-09-05T09:30:00.000Z",
  notes,
};

describe("Task 13 people and initiatives UI", () => {
  it("navigates from the people list to a person detail view", async () => {
    const db = {
      createPerson: vi.fn(),
      listPeople: vi.fn().mockResolvedValue([person]),
      listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
        topics: [topicWithNotes],
        untopicNotes: [],
      }),
      createTopic: vi.fn(),
      createNote: vi.fn(),
    } as unknown as AppDb;
    render(<App db={db} />);

    fireEvent.click(screen.getByRole("button", { name: "Kişiler" }));
    fireEvent.click(await screen.findByRole("button", { name: "Ayşe" }));

    expect(
      await screen.findByRole("heading", { level: 1, name: "Ayşe" }),
    ).toBeTruthy();
    expect(db.listTopicsWithNotesForPerson).toHaveBeenCalledWith(1);
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

  it("shows person topics with nested notes", async () => {
    render(
      <PersonDetailView
        db={{
          createNote: vi.fn(),
          createTopic: vi.fn(),
          listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
            topics: [topicWithNotes],
            untopicNotes: [],
          }),
        }}
        onBack={vi.fn()}
        person={person}
      />,
    );

    const toggle = await screen.findByRole("button", {
      name: /1:1/,
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("list", { name: "1:1 notları" })).toBeNull();

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const list = await screen.findByRole("list", { name: "1:1 notları" });
    expect(
      within(list).getAllByRole("listitem").map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining("Yeni görüşme"),
      expect.stringContaining("İlk görüşme"),
    ]);
  });

  it("creates a topic and adds a note under it", async () => {
    const createTopic = vi.fn().mockResolvedValue({
      id: 5,
      personId: person.id,
      title: "USS Fishkill",
      createdAt: "2026-09-05T12:00:00.000Z",
    });
    const createNote = vi.fn().mockResolvedValue({
      id: 99,
      body: "küfür etti",
      createdAt: "2026-09-05T12:01:00.000Z",
      updatedAt: "2026-09-05T12:01:00.000Z",
      deletedAt: null,
      tags: [],
      personIds: [person.id],
      initiativeIds: [],
      topicIds: [5],
    });
    const listTopicsWithNotesForPerson = vi
      .fn()
      .mockResolvedValueOnce({ topics: [], untopicNotes: [] })
      .mockResolvedValueOnce({
        topics: [
          {
            id: 5,
            personId: person.id,
            title: "USS Fishkill",
            createdAt: "2026-09-05T12:00:00.000Z",
            notes: [],
          },
        ],
        untopicNotes: [],
      })
      .mockResolvedValueOnce({
        topics: [
          {
            id: 5,
            personId: person.id,
            title: "USS Fishkill",
            createdAt: "2026-09-05T12:00:00.000Z",
            notes: [
              {
                id: 99,
                body: "küfür etti",
                createdAt: "2026-09-05T12:01:00.000Z",
                updatedAt: "2026-09-05T12:01:00.000Z",
                deletedAt: null,
                tags: [],
                personIds: [person.id],
                initiativeIds: [],
                topicIds: [5],
              },
            ],
          },
        ],
        untopicNotes: [],
      });
    const onToast = vi.fn();

    render(
      <PersonDetailView
        db={{ createNote, createTopic, listTopicsWithNotesForPerson }}
        onBack={vi.fn()}
        onToast={onToast}
        person={person}
      />,
    );

    await screen.findByText("Henüz konu yok. Yukarıdan bir konu ekleyin.");
    fireEvent.change(screen.getByLabelText("Yeni konu"), {
      target: { value: "USS Fishkill" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Konu ekle" }));

    const toggle = await screen.findByRole("button", { name: /USS Fishkill/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    fireEvent.change(screen.getByLabelText("Not ekle"), {
      target: { value: "küfür etti" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Not ekle" }));

    await waitFor(() => {
      expect(createTopic).toHaveBeenCalledWith({
        personId: person.id,
        title: "USS Fishkill",
      });
      expect(createNote).toHaveBeenCalledWith({
        body: "küfür etti",
        personIds: [person.id],
        initiativeIds: [],
        topicIds: [5],
      });
      expect(screen.getByText("küfür etti")).toBeTruthy();
    });
  });

  it("shows initiative status, blocker, and linked notes", async () => {
    render(
      <InitiativeDetailView
        db={{
          createReminder: vi.fn(),
          listNotesForInitiative: vi.fn().mockResolvedValue(notes),
          updateInitiative: vi.fn(),
        }}
        initiative={initiative}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Aktif", { selector: "span" })).toBeTruthy();
    expect(
      (screen.getByLabelText("Durum") as HTMLSelectElement).value,
    ).toBe("aktif");
    expect(
      (screen.getByLabelText("Engel özeti") as HTMLTextAreaElement).value,
    ).toBe("Bütçe onayı");
    expect(
      await screen.findByRole("list", { name: "Bağlı notlar" }),
    ).toBeTruthy();
  });
});
