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
import type { Initiative, Note, Person } from "../src/lib/types";
import InboxView from "../src/views/InboxView";

afterEach(cleanup);

const person: Person = {
  id: 1,
  name: "Ayşe",
  roleOrNotes: null,
  createdAt: "2026-09-05T08:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const initiative: Initiative = {
  id: 2,
  name: "Atlas",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-05T09:00:00.000Z",
  lastActivityAt: "2026-09-05T09:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
  tags: [],
};

const inboxNote: Note = {
  id: 3,
  body: "toplantida gidip yapacagiz",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [],
  initiativeIds: [],
  topicIds: [],
  nextReminderDueAt: null,
};

type InboxTestDb = Pick<
  AppDb,
  | "listInboxNotes"
  | "listPeople"
  | "listInitiatives"
  | "linkNoteToPeople"
  | "linkNoteToInitiatives"
  | "softDeleteNote"
  | "updateNote"
  | "createReminder"
  | "setReminderForTarget"
  | "saveNoteImage"
  | "getNoteImage"
>;

function createDb(overrides: Partial<InboxTestDb> = {}): InboxTestDb {
  return {
    listInboxNotes: vi.fn().mockResolvedValue([inboxNote]),
    listPeople: vi.fn().mockResolvedValue([person]),
    listInitiatives: vi.fn().mockResolvedValue([initiative]),
    linkNoteToPeople: vi.fn().mockResolvedValue(undefined),
    linkNoteToInitiatives: vi.fn().mockResolvedValue(undefined),
    softDeleteNote: vi.fn(),
    updateNote: vi.fn().mockResolvedValue(inboxNote),
    createReminder: vi.fn().mockResolvedValue(undefined),
    setReminderForTarget: vi.fn().mockResolvedValue({ id: 1 }),
    saveNoteImage: vi.fn(),
    getNoteImage: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

describe("InboxView", () => {
  it("moves an inbox note onto a person and removes it from Gelen", async () => {
    const listInboxNotes = vi
      .fn()
      .mockResolvedValueOnce([inboxNote])
      .mockResolvedValue([]);
    const linkNoteToPeople = vi.fn().mockResolvedValue(undefined);
    const linkNoteToInitiatives = vi.fn().mockResolvedValue(undefined);
    const updateNote = vi.fn().mockResolvedValue(inboxNote);
    const onToast = vi.fn();

    const db = createDb({
      listInboxNotes,
      linkNoteToPeople,
      linkNoteToInitiatives,
      updateNote,
    });

    render(<InboxView db={db} onToast={onToast} />);

    expect(await screen.findByText(inboxNote.body)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Taşı" }));
    fireEvent.click(screen.getByLabelText("Ayşe"));
    fireEvent.click(screen.getByRole("button", { name: "Taşı" }));

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith(3, inboxNote.body);
      expect(linkNoteToPeople).toHaveBeenCalledWith(3, [1]);
      expect(linkNoteToInitiatives).toHaveBeenCalledWith(3, []);
      expect(onToast).toHaveBeenCalledWith("Not taşındı");
      expect(screen.queryByText(inboxNote.body)).toBeNull();
    });
  });

  it("edits an inbox note body without moving it", async () => {
    const updated: Note = {
      ...inboxNote,
      body: "güncellenmiş toplantı notu",
      updatedAt: "2026-09-05T11:00:00.000Z",
    };
    const listInboxNotes = vi
      .fn()
      .mockResolvedValueOnce([inboxNote])
      .mockResolvedValue([updated]);
    const updateNote = vi.fn().mockResolvedValue(updated);
    const onToast = vi.fn();

    const db = createDb({ listInboxNotes, updateNote });

    render(<InboxView db={db} onToast={onToast} />);

    expect(await screen.findByText(inboxNote.body)).toBeTruthy();
    fireEvent.click(screen.getByText(inboxNote.body));
    fireEvent.change(screen.getByLabelText("Not metni"), {
      target: { value: updated.body },
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Değişiklikleri kaydet" }),
    );

    await waitFor(() => {
      expect(updateNote).toHaveBeenCalledWith(3, updated.body);
      expect(db.linkNoteToPeople).not.toHaveBeenCalled();
      expect(db.linkNoteToInitiatives).not.toHaveBeenCalled();
      expect(screen.getByText(updated.body)).toBeTruthy();
    });
  });
});
