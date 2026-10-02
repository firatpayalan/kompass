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
import type { Note, Person } from "../src/lib/types";
import { toDatetimeLocalValue } from "../src/lib/reminders";
import PersonDetailView from "../src/views/PersonDetailView";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "Ayşe",
  roleOrNotes: null,
  createdAt: "2026-09-06T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const note: Note = {
  id: 20,
  body: "Pazartesi gunu one-pager deadline",
  createdAt: "2026-09-06T10:00:00.000Z",
  updatedAt: "2026-09-06T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [1],
  initiativeIds: [],
  topicIds: [],
  nextReminderDueAt: null,
};

function baseDb(overrides: Partial<AppDb> = {}) {
  return {
    createNote: vi.fn(),
    createTopic: vi.fn(),
    createReminder: vi.fn(),
    setReminderForTarget: vi.fn().mockResolvedValue({ id: 1 }),
    listTopicsWithNotesForPerson: vi.fn().mockResolvedValue({
      topics: [],
      untopicNotes: [note],
    }),
    updateNote: vi.fn().mockResolvedValue(note),
    softDeleteNote: vi.fn(),
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
    linkNoteToTopics: vi.fn(),
    ...overrides,
  } as unknown as AppDb;
}

describe("linked note edit reminders", () => {
  it("sets a note reminder when saving with due time", async () => {
    const setReminderForTarget = vi.fn().mockResolvedValue({ id: 9 });
    const updateNote = vi.fn().mockResolvedValue(note);
    const onToast = vi.fn();

    render(
      <PersonDetailView
        db={baseDb({ setReminderForTarget, updateNote })}
        onBack={vi.fn()}
        onToast={onToast}
        person={person}
      />,
    );

    const list = await screen.findByRole("list", { name: "Konusuz notlar" });
    fireEvent.click(within(list).getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByLabelText("Hatırlatma"));
    fireEvent.change(screen.getByLabelText("Hatırlatma zamanı"), {
      target: { value: "2026-09-08T09:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith(note.id, note.body);
      expect(setReminderForTarget).toHaveBeenCalledWith({
        targetType: "note",
        targetId: note.id,
        dueAt: expect.any(String),
        period: "once",
        nowIso: expect.any(String),
      });
    });
    expect(
      new Date(setReminderForTarget.mock.calls[0][0].dueAt).toISOString(),
    ).toBe(new Date("2026-09-08T09:00").toISOString());
  });

  it("prefills and replaces an existing reminder due date", async () => {
    const existingDue = "2026-09-07T06:00:00.000Z";
    const noteWithReminder: Note = {
      ...note,
      nextReminderDueAt: existingDue,
    };
    const setReminderForTarget = vi.fn().mockResolvedValue({ id: 10 });
    const updateNote = vi.fn().mockResolvedValue(noteWithReminder);
    const listTopicsWithNotesForPerson = vi
      .fn()
      .mockResolvedValueOnce({
        topics: [],
        untopicNotes: [noteWithReminder],
      })
      .mockResolvedValue({
        topics: [],
        untopicNotes: [
          {
            ...noteWithReminder,
            nextReminderDueAt: new Date("2026-09-10T09:00").toISOString(),
          },
        ],
      });

    render(
      <PersonDetailView
        db={baseDb({
          setReminderForTarget,
          updateNote,
          listTopicsWithNotesForPerson,
        })}
        onBack={vi.fn()}
        onToast={vi.fn()}
        person={person}
      />,
    );

    const list = await screen.findByRole("list", { name: "Konusuz notlar" });
    fireEvent.click(within(list).getByRole("button", { name: "Düzenle" }));

    const dueInput = screen.getByLabelText(
      "Hatırlatma zamanı",
    ) as HTMLInputElement;
    expect(dueInput.value).toBe(toDatetimeLocalValue(existingDue));

    fireEvent.change(dueInput, { target: { value: "2026-09-10T09:00" } });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(setReminderForTarget).toHaveBeenCalledWith({
        targetType: "note",
        targetId: note.id,
        dueAt: new Date("2026-09-10T09:00").toISOString(),
        period: "once",
        nowIso: expect.any(String),
      });
    });
  });

  it("blocks save when reminder is enabled without due time", async () => {
    const setReminderForTarget = vi.fn();
    const updateNote = vi.fn();
    const onToast = vi.fn();

    render(
      <PersonDetailView
        db={baseDb({ setReminderForTarget, updateNote })}
        onBack={vi.fn()}
        onToast={onToast}
        person={person}
      />,
    );

    const list = await screen.findByRole("list", { name: "Konusuz notlar" });
    fireEvent.click(within(list).getByRole("button", { name: "Düzenle" }));
    fireEvent.click(screen.getByLabelText("Hatırlatma"));
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Hatırlatma zamanı gerekli");
    });
    expect(updateNote).not.toHaveBeenCalled();
    expect(setReminderForTarget).not.toHaveBeenCalled();
  });

  it("updates the note only when reminder is off", async () => {
    const setReminderForTarget = vi.fn();
    const updateNote = vi.fn().mockResolvedValue(note);

    render(
      <PersonDetailView
        db={baseDb({ setReminderForTarget, updateNote })}
        onBack={vi.fn()}
        onToast={vi.fn()}
        person={person}
      />,
    );

    const list = await screen.findByRole("list", { name: "Konusuz notlar" });
    fireEvent.click(within(list).getByRole("button", { name: "Düzenle" }));
    fireEvent.change(screen.getByLabelText("Notu düzenle"), {
      target: { value: "Guncellenmis not" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith(note.id, "Guncellenmis not");
    });
    expect(setReminderForTarget).not.toHaveBeenCalled();
  });
});
