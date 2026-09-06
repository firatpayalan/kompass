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
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const initiative: Initiative = {
  id: 2,
  name: "Lansman",
  status: "aktif",
  blockerSummary: "Bütçe onayı",
  createdAt: "2026-09-05T09:00:00.000Z",
  lastActivityAt: "2026-09-05T09:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
  tags: [],
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
  initiativeId: null,
  title: "1:1",
  createdAt: "2026-09-05T09:30:00.000Z",
  notes,
  tags: [],
};

describe("Task 13 people and initiatives UI", () => {
  it("navigates from the people list to a person detail view", async () => {
    const db = {
      createPerson: vi.fn(),
      listPeople: vi.fn().mockResolvedValue([person]),
      listInitiatives: vi.fn().mockResolvedValue([]),
      listActiveNotes: vi.fn().mockResolvedValue([]),
      listDueRemindersForBugun: vi.fn().mockResolvedValue([]),
      listOverdueReminders: vi.fn().mockResolvedValue([]),
      listUpcomingReminders: vi.fn().mockResolvedValue([]),
      advanceOrCompleteReminder: vi.fn(),
      softDeleteNote: vi.fn(),
      listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
        topics: [topicWithNotes],
        untopicNotes: [],
      }),
      createTopic: vi.fn(),
          addTagToTopic: vi.fn(),
          linkTagToTopic: vi.fn(),
          listTopicTags: vi.fn().mockResolvedValue([]),
          updateTopicTag: vi.fn(),
          deleteTopicTag: vi.fn(),
          addTagToInitiative: vi.fn(),
          linkTagToInitiative: vi.fn(),
          listInitiativeTags: vi.fn(async () => []),
          updateInitiativeTag: vi.fn(),
          deleteInitiativeTag: vi.fn(),
          removeTagFromInitiative: vi.fn(),
          addTagToNote: vi.fn(),
          linkTagToNote: vi.fn(),
          listNoteTags: vi.fn().mockResolvedValue([]),
          updateNoteTag: vi.fn(),
          deleteNoteTag: vi.fn(),
      createNote: vi.fn(),
      updateTopic: vi.fn(),
      updateNote: vi.fn(),
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
          reorderPeople: vi.fn(),
        }}
        onSelectPerson={onSelectPerson}
        onToast={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Ayşe" }));

    expect(onSelectPerson).toHaveBeenCalledWith(person);
  });

  it("reorders people when a row is dragged onto another", async () => {
    const baris: Person = {
      id: 1,
      name: "baris",
      roleOrNotes: "software engineer 2",
      createdAt: "2026-09-05T08:00:00.000Z",
      sortOrder: 0,
      label: null,
  archivedAt: null,
    };
    const cartman: Person = {
      id: 2,
      name: "cartman",
      roleOrNotes: null,
      createdAt: "2026-09-05T08:00:00.000Z",
      sortOrder: 1,
      label: null,
  archivedAt: null,
    };
    const reorderPeople = vi.fn().mockResolvedValue(undefined);
    render(
      <PeopleView
        db={{
          createPerson: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([baris, cartman]),
          reorderPeople,
        }}
        onSelectPerson={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    await screen.findByRole("button", { name: "baris" });
    const handle = screen.getByRole("button", {
      name: "baris sırasını değiştir",
    });
    const target = screen.getByRole("button", { name: "cartman" }).closest("li");
    expect(target).toBeTruthy();
    Object.defineProperty(target!, "getBoundingClientRect", {
      value: () => ({
        top: 100,
        height: 60,
        bottom: 160,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: 100,
        toJSON: () => undefined,
      }),
    });
    const source = handle.closest("li");
    Object.defineProperty(source!, "getBoundingClientRect", {
      value: () => ({
        top: 20,
        height: 60,
        bottom: 80,
        left: 0,
        right: 100,
        width: 100,
        x: 0,
        y: 20,
        toJSON: () => undefined,
      }),
    });

    fireEvent.pointerDown(handle, { button: 0, clientY: 40 });
    fireEvent.pointerMove(window, { clientY: 50 });
    fireEvent.pointerMove(window, { clientY: 130 });
    fireEvent.pointerUp(window);

    await waitFor(() => {
      expect(reorderPeople).toHaveBeenCalledWith([2, 1]);
    });
    const rows = screen.getAllByRole("listitem");
    expect(within(rows[0]).getByRole("button", { name: "cartman" })).toBeTruthy();
    expect(within(rows[1]).getByRole("button", { name: "baris" })).toBeTruthy();
  });

  it("shows a relationship badge on the people list", async () => {
    const labeled: Person = {
      ...person,
      label: {
        id: 9,
        name: "Lider",
        color: "sky",
        createdAt: "2026-09-05T00:00:00.000Z",
      },
    };
    render(
      <PeopleView
        db={{
          createPerson: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([labeled]),
          listPersonLabels: vi.fn().mockResolvedValue([labeled.label!]),
          createPersonLabel: vi.fn(),
          updatePersonLabel: vi.fn(),
          deletePersonLabel: vi.fn(),
          reorderPeople: vi.fn(),
        }}
        onSelectPerson={vi.fn()}
        onToast={vi.fn()}
      />,
    );

    expect(
      await screen.findByText("Lider", { selector: ".person-label-badge" }),
    ).toBeTruthy();
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
          reorderPeople: vi.fn(),
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
    const createNote = vi.fn().mockResolvedValue({ id: 99 });
    const onSelectInitiative = vi.fn();
    render(
      <InitiativesView
        db={{
          createInitiative,
          createNote,
          listInitiatives: vi.fn().mockResolvedValue([]),
          reorderInitiatives: vi.fn(),
        }}
        onSelectInitiative={onSelectInitiative}
        onToast={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("İş adı"), {
      target: { value: "Lansman" },
    });
    fireEvent.change(screen.getByLabelText("Durum"), {
      target: { value: "beklemede" },
    });
    fireEvent.change(screen.getByLabelText("Engel özeti"), {
      target: { value: "Bütçe onayı" },
    });
    fireEvent.click(screen.getByRole("button", { name: "İş ekle" }));

    await waitFor(() =>
      expect(createInitiative).toHaveBeenCalledWith({
        name: "Lansman",
        status: "beklemede",
        blockerSummary: "Bütçe onayı",
        nowIso: expect.any(String),
      }),
    );
    expect(createNote).toHaveBeenCalledWith({
      body: "Bütçe onayı",
      initiativeIds: [initiative.id],
      personIds: [],
    });
    expect(onSelectInitiative).toHaveBeenCalledWith(initiative);
  });

  it("shows person topics with nested notes", async () => {
    render(
      <PersonDetailView
        db={{
          createNote: vi.fn(),
          createTopic: vi.fn(),
          addTagToTopic: vi.fn(),
          linkTagToTopic: vi.fn(),
          listTopicTags: vi.fn().mockResolvedValue([]),
          updateTopicTag: vi.fn(),
          deleteTopicTag: vi.fn(),
          addTagToInitiative: vi.fn(),
          linkTagToInitiative: vi.fn(),
          listInitiativeTags: vi.fn(async () => []),
          updateInitiativeTag: vi.fn(),
          deleteInitiativeTag: vi.fn(),
          removeTagFromInitiative: vi.fn(),
          addTagToNote: vi.fn(),
          linkTagToNote: vi.fn(),
          listNoteTags: vi.fn().mockResolvedValue([]),
          updateNoteTag: vi.fn(),
          deleteNoteTag: vi.fn(),
          updateNote: vi.fn(),
          updateTopic: vi.fn(),
          updatePerson: vi.fn(),
          listPersonLabels: vi.fn().mockResolvedValue([]),
          createPersonLabel: vi.fn(),
          updatePersonLabel: vi.fn(),
          deletePersonLabel: vi.fn(),
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
            tags: [],
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
            tags: [],
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
        db={{
          createNote,
          createTopic,
          updateNote: vi.fn(),
          updateTopic: vi.fn(),
          updatePerson: vi.fn(),
          listPersonLabels: vi.fn().mockResolvedValue([]),
          createPersonLabel: vi.fn(),
          updatePersonLabel: vi.fn(),
          deletePersonLabel: vi.fn(),
                    addTagToTopic: vi.fn(),
          linkTagToTopic: vi.fn(),
          listTopicTags: vi.fn().mockResolvedValue([]),
          updateTopicTag: vi.fn(),
          deleteTopicTag: vi.fn(),
          addTagToInitiative: vi.fn(),
          linkTagToInitiative: vi.fn(),
          listInitiativeTags: vi.fn(async () => []),
          updateInitiativeTag: vi.fn(),
          deleteInitiativeTag: vi.fn(),
          removeTagFromInitiative: vi.fn(),
          addTagToNote: vi.fn(),
          linkTagToNote: vi.fn(),
          listNoteTags: vi.fn().mockResolvedValue([]),
          updateNoteTag: vi.fn(),
          deleteNoteTag: vi.fn(),
          listTopicsWithNotesForPerson,
        }}
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

  it("renames a topic and updates a note", async () => {
    const updateTopic = vi.fn().mockResolvedValue({
      id: 5,
      personId: person.id,
      title: "Yeni konu",
      createdAt: topicWithNotes.createdAt,
    });
    const updateNote = vi.fn().mockResolvedValue({
      ...notes[0],
      body: "güncellenmiş not",
      updatedAt: "2026-09-05T12:00:00.000Z",
    });
    const listTopicsWithNotesForPerson = vi
      .fn()
      .mockResolvedValueOnce({
        topics: [topicWithNotes],
        untopicNotes: [],
      })
      .mockResolvedValueOnce({
        topics: [{ ...topicWithNotes, title: "Yeni konu" }],
        untopicNotes: [],
      })
      .mockResolvedValueOnce({
        topics: [
          {
            ...topicWithNotes,
            title: "Yeni konu",
            notes: [
              {
                ...notes[0],
                body: "güncellenmiş not",
                updatedAt: "2026-09-05T12:00:00.000Z",
              },
              notes[1],
            ],
          },
        ],
        untopicNotes: [],
      });

    render(
      <PersonDetailView
        db={{
          createNote: vi.fn(),
          createTopic: vi.fn(),
          addTagToTopic: vi.fn(),
          linkTagToTopic: vi.fn(),
          listTopicTags: vi.fn().mockResolvedValue([]),
          updateTopicTag: vi.fn(),
          deleteTopicTag: vi.fn(),
          addTagToInitiative: vi.fn(),
          linkTagToInitiative: vi.fn(),
          listInitiativeTags: vi.fn(async () => []),
          updateInitiativeTag: vi.fn(),
          deleteInitiativeTag: vi.fn(),
          removeTagFromInitiative: vi.fn(),
          addTagToNote: vi.fn(),
          linkTagToNote: vi.fn(),
          listNoteTags: vi.fn().mockResolvedValue([]),
          updateNoteTag: vi.fn(),
          deleteNoteTag: vi.fn(),
          updateNote,
          updateTopic,
          updatePerson: vi.fn(),
          listPersonLabels: vi.fn().mockResolvedValue([]),
          createPersonLabel: vi.fn(),
          updatePersonLabel: vi.fn(),
          deletePersonLabel: vi.fn(),
          listTopicsWithNotesForPerson,
        }}
        onBack={vi.fn()}
        onToast={vi.fn()}
        person={person}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /1:1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Yeniden adlandır" }));
    fireEvent.change(screen.getByLabelText("Konu adı"), {
      target: { value: "Yeni konu" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateTopic).toHaveBeenCalledWith(5, "Yeni konu");
      expect(screen.getByText("Yeni konu")).toBeTruthy();
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Düzenle" })[0]);
    fireEvent.change(screen.getByLabelText("Notu düzenle"), {
      target: { value: "güncellenmiş not" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith(11, "güncellenmiş not");
      expect(screen.getByText("güncellenmiş not")).toBeTruthy();
      expect(screen.getByText(/Düzenlendi:/)).toBeTruthy();
    });
  });

  it("shows initiative status, blocker, and topics", async () => {
    const initiativeTopic = {
      id: 5,
      personId: null,
      initiativeId: 2,
      title: "Lansman hazırlık",
      createdAt: "2026-09-05T09:30:00.000Z",
      notes,
      tags: [],
    };
    render(
      <InitiativeDetailView
        db={{
          createReminder: vi.fn(),
          createNote: vi.fn(),
          createTopic: vi.fn(),
          listTopicsWithNotesForInitiative: vi.fn().mockResolvedValue({
            topics: [initiativeTopic],
            untopicNotes: [],
          }),
          updateInitiative: vi.fn(),
          updateNote: vi.fn(),
          softDeleteNote: vi.fn(),
          updateTopic: vi.fn(),
          addTagToTopic: vi.fn(),
          linkTagToTopic: vi.fn(),
          listTopicTags: vi.fn().mockResolvedValue([]),
          updateTopicTag: vi.fn(),
          deleteTopicTag: vi.fn(),
          addTagToInitiative: vi.fn(),
          linkTagToInitiative: vi.fn(),
          listInitiativeTags: vi.fn(async () => []),
          updateInitiativeTag: vi.fn(),
          deleteInitiativeTag: vi.fn(),
          removeTagFromInitiative: vi.fn(),
          linkNoteToTopics: vi.fn(),
          addTagToNote: vi.fn(),
          linkTagToNote: vi.fn(),
          listNoteTags: vi.fn().mockResolvedValue([]),
          updateNoteTag: vi.fn(),
          deleteNoteTag: vi.fn(),
          saveNoteImage: vi.fn(),
          getNoteImage: vi.fn(),
        }}
        initiative={initiative}
        onBack={vi.fn()}
      />,
    );

    expect(screen.getByText("Aktif", { selector: "span" })).toBeTruthy();
    expect(
      (screen.getByLabelText("Durum") as HTMLSelectElement).value,
    ).toBe("aktif");
    expect(screen.queryByLabelText("Engel özeti")).toBeNull();
    expect(await screen.findByText("Lansman hazırlık")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Lansman hazırlık/ }));
    expect(
      await screen.findByRole("list", { name: "Lansman hazırlık notları" }),
    ).toBeTruthy();
  });
});
