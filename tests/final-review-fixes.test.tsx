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
import QuickNoteModal from "../src/components/QuickNoteModal";
import type { AppDb } from "../src/db/appDb";
import { createDraftStore } from "../src/lib/drafts";
import type { Initiative, Note, Reminder } from "../src/lib/types";
import InitiativeDetailView from "../src/views/InitiativeDetailView";
import NotesView from "../src/views/NotesView";

afterEach(cleanup);

const now = () => new Date("2026-09-05T12:00:00.000Z");

const dueReminder: Reminder & { title: string } = {
  id: 1,
  targetType: "note",
  targetId: 7,
  dueAt: "2026-09-05T10:00:00.000Z",
  period: "daily",
  done: false,
  createdAt: "2026-09-05T09:00:00.000Z",
  title: "Bütçeyi takip et",
};

const initiative: Initiative = {
  id: 2,
  name: "Lansman",
  status: "aktif",
  blockerSummary: "Bütçe onayı",
  createdAt: "2026-09-05T09:00:00.000Z",
};

const note: Note = {
  id: 9,
  body: "Takip notu",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [],
  initiativeIds: [],
    topicIds: [],
  };

function createDb(overrides: Partial<AppDb> = {}): AppDb {
  return {
    advanceOrCompleteReminder: vi.fn().mockResolvedValue(undefined),
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
    updateTopic: vi.fn(),
    deleteInitiative: vi.fn(),
    deletePerson: vi.fn(),
    findPersonByName: vi.fn(),
    getNote: vi.fn(),
    linkNoteToInitiatives: vi.fn(),
    linkNoteToPeople: vi.fn(),
    listActiveNotes: vi.fn().mockResolvedValue([]),
    listInboxNotes: vi.fn().mockResolvedValue([]),
    listDeletedNotes: vi.fn().mockResolvedValue([]),
    listDueRemindersForBugun: vi.fn().mockResolvedValue([]),
    listInitiatives: vi.fn().mockResolvedValue([]),
    listNotesForInitiative: vi.fn().mockResolvedValue([]),
    listNotesForPerson: vi.fn().mockResolvedValue([]),
    listPeople: vi.fn().mockResolvedValue([]),
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
    ...overrides,
  };
}

describe("app-scoped reminder ticker", () => {
  it("keeps notifying after the user leaves the Bugün view", async () => {
    const second = { ...dueReminder, id: 5, title: "İkinci hatırlatma" };
    const listDueRemindersForBugun = vi
      .fn()
      .mockResolvedValueOnce([dueReminder])
      .mockResolvedValue([dueReminder, second]);
    const notify = vi.fn().mockResolvedValue(true);

    render(
      <App
        db={createDb({ listDueRemindersForBugun })}
        notify={notify}
        now={now}
      />,
    );
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByRole("button", { name: "Notlar" }));
    await screen.findByRole("heading", { level: 1, name: "Notlar" });
    expect(screen.queryByText("Bütçeyi takip et")).toBeNull();

    fireEvent.focus(window);

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith("Hatırlatma", "İkinci hatırlatma"),
    );
  });

  it("notifies a recurring reminder again once it advances", async () => {
    const advanced = { ...dueReminder, dueAt: "2026-09-05T11:00:00.000Z" };
    const listDueRemindersForBugun = vi
      .fn()
      .mockResolvedValueOnce([dueReminder])
      .mockResolvedValue([advanced]);
    const notify = vi.fn().mockResolvedValue(true);

    render(
      <App
        db={createDb({ listDueRemindersForBugun })}
        notify={notify}
        now={now}
      />,
    );
    await waitFor(() => expect(notify).toHaveBeenCalledTimes(1));

    fireEvent.focus(window);

    await waitFor(() => expect(notify).toHaveBeenCalledTimes(2));
  });
});

describe("initiative detail editing", () => {
  it("saves an edited status and blocker summary", async () => {
    const updateInitiative = vi.fn().mockResolvedValue({
      ...initiative,
      status: "bitti",
      blockerSummary: "Engel kalmadı",
    });
    const onToast = vi.fn();
    render(
      <InitiativeDetailView
        db={{
          createReminder: vi.fn(),
          listNotesForInitiative: vi.fn().mockResolvedValue([]),
          updateInitiative,
        }}
        initiative={initiative}
        onBack={vi.fn()}
        onToast={onToast}
      />,
    );

    fireEvent.change(screen.getByLabelText("Durum"), {
      target: { value: "bitti" },
    });
    fireEvent.change(screen.getByLabelText("Engel özeti"), {
      target: { value: "Engel kalmadı" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Değişiklikleri kaydet" }),
    );

    await waitFor(() =>
      expect(updateInitiative).toHaveBeenCalledWith(2, {
        status: "bitti",
        blockerSummary: "Engel kalmadı",
      }),
    );
    expect(onToast).toHaveBeenCalledWith("İş güncellendi");
    expect(await screen.findByText("Bitti", { selector: "span" })).toBeTruthy();
  });

  it("attaches a reminder to an existing initiative", async () => {
    const createReminder = vi.fn().mockResolvedValue({});
    const onToast = vi.fn();
    render(
      <InitiativeDetailView
        db={{
          createReminder,
          listNotesForInitiative: vi.fn().mockResolvedValue([]),
          updateInitiative: vi.fn(),
        }}
        initiative={initiative}
        onBack={vi.fn()}
        onToast={onToast}
      />,
    );

    fireEvent.click(screen.getByLabelText("Hatırlatma ekle"));
    fireEvent.change(screen.getByLabelText("Hatırlatma zamanı"), {
      target: { value: "2026-09-06T09:30" },
    });
    fireEvent.change(screen.getByLabelText("Tekrar"), {
      target: { value: "weekly" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Hatırlatmayı kaydet" }),
    );

    await waitFor(() =>
      expect(createReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: "initiative",
          targetId: 2,
          period: "weekly",
        }),
      ),
    );
    expect(onToast).toHaveBeenCalledWith("Hatırlatma eklendi");
  });
});

describe("reminders on existing notes", () => {
  it("creates a reminder for the note being edited", async () => {
    const createReminder = vi.fn().mockResolvedValue({});
    const updateNote = vi.fn().mockResolvedValue(note);
    render(
      <NotesView
        db={{
          createReminder,
          listActiveNotes: vi.fn().mockResolvedValue([note]),
          softDeleteNote: vi.fn(),
          updateNote,
        }}
        onToast={vi.fn()}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Takip notu" }));
    fireEvent.click(screen.getByLabelText("Hatırlatma ekle"));
    fireEvent.change(screen.getByLabelText("Hatırlatma zamanı"), {
      target: { value: "2026-09-06T09:30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Değişiklikleri kaydet" }),
    );

    await waitFor(() =>
      expect(createReminder).toHaveBeenCalledWith(
        expect.objectContaining({
          targetType: "note",
          targetId: 9,
          period: "once",
        }),
      ),
    );
    expect(updateNote).toHaveBeenCalledWith(9, "Takip notu");
  });

  it("reports a failed reminder without claiming the note was lost", async () => {
    const onToast = vi.fn();
    render(
      <NotesView
        db={{
          createReminder: vi.fn().mockRejectedValue(new Error("disk")),
          listActiveNotes: vi.fn().mockResolvedValue([note]),
          softDeleteNote: vi.fn(),
          updateNote: vi.fn().mockResolvedValue(note),
        }}
        onToast={onToast}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: "Takip notu" }));
    fireEvent.click(screen.getByLabelText("Hatırlatma ekle"));
    fireEvent.change(screen.getByLabelText("Hatırlatma zamanı"), {
      target: { value: "2026-09-06T09:30" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Değişiklikleri kaydet" }),
    );

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith(
        "Not kaydedildi, hatırlatma eklenemedi",
      ),
    );
  });
});

describe("quick note reminder failure", () => {
  it("keeps the saved note and drops the draft when only the reminder fails", async () => {
    const draftStore = createDraftStore();
    const onToast = vi.fn();
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(
      <QuickNoteModal
        db={{
          createNote: vi.fn().mockResolvedValue({ id: 42 }),
          createReminder: vi.fn().mockRejectedValue(new Error("disk")),
        }}
        draftStore={draftStore}
        onClose={onClose}
        onSaved={onSaved}
        onToast={onToast}
      />,
    );

    fireEvent.change(screen.getByLabelText("Not"), {
      target: { value: "Kaydedilmiş not" },
    });
    fireEvent.click(screen.getByLabelText("Hatırlatma ekle"));
    fireEvent.change(screen.getByLabelText("Hatırlatma zamanı"), {
      target: { value: "2026-09-06T09:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith(
        "Not kaydedildi, hatırlatma eklenemedi",
      ),
    );
    expect(onToast).not.toHaveBeenCalledWith("Kayıt başarısız; taslak korundu");
    expect(draftStore.getDraft()).toBeNull();
    expect(onSaved).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
