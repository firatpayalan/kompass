/** @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  BugunReminder,
  ReminderTicker,
} from "../src/hooks/useReminderTicker";
import type { Initiative, Note, Person } from "../src/lib/types";
import BugunView from "../src/views/BugunView";

afterEach(() => cleanup());

const person: Person = {
  id: 1,
  name: "Ayşe",
  roleOrNotes: null,
  createdAt: "2026-09-05T09:00:00.000Z",
  sortOrder: 0,
  label: null,
  archivedAt: null,
};

const initiative: Initiative = {
  id: 2,
  name: "Lansman",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-05T09:00:00.000Z",
  lastActivityAt: "2026-09-05T09:00:00.000Z",
  sortOrder: 0,
  archivedAt: null,
  tags: [],
};

function makeNote(partial: Partial<Note> & Pick<Note, "id" | "body">): Note {
  return {
    createdAt: "2026-09-05T10:00:00.000Z",
    updatedAt: "2026-09-05T10:00:00.000Z",
    deletedAt: null,
    tags: [],
    personIds: [],
    initiativeIds: [],
    topicIds: [],
    nextReminderDueAt: null,
    ...partial,
  };
}

function makeTicker(
  overrides: Partial<ReminderTicker> = {},
): ReminderTicker {
  return {
    completeReminder: vi.fn().mockResolvedValue(undefined),
    loadFailed: false,
    loading: false,
    permissionDenied: false,
    refresh: vi.fn(),
    overdueReminders: [],
    reminders: [],
    upcomingReminders: [],
    ...overrides,
  };
}

describe("Bugün reminder navigation", () => {
  it("opens person/initiative menu for a note reminder", async () => {
    const onOpenPerson = vi.fn();
    const onOpenInitiative = vi.fn();
    const completeReminder = vi.fn().mockResolvedValue(undefined);
    const note = makeNote({
      id: 10,
      body: "Bağlı not",
      personIds: [person.id],
      initiativeIds: [initiative.id],
    });
    const reminder: BugunReminder = {
      id: 5,
      targetType: "note",
      targetId: note.id,
      dueAt: "2026-09-07T00:54:00.000Z",
      period: "once",
      done: false,
      createdAt: "2026-09-06T00:00:00.000Z",
      title: "Pazartesi gunu one-pager deadline",
    };

    render(
      <BugunView
        db={{
          listActiveNotes: vi.fn().mockResolvedValue([]),
          softDeleteNote: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([person]),
          listInitiatives: vi.fn().mockResolvedValue([initiative]),
          getNote: vi.fn().mockResolvedValue(note),
        }}
        onOpenInitiative={onOpenInitiative}
        onOpenPerson={onOpenPerson}
        onToast={vi.fn()}
        ticker={makeTicker({
          upcomingReminders: [reminder],
          completeReminder,
        })}
      />,
    );

    fireEvent.click(
      await screen.findByText("Pazartesi gunu one-pager deadline"),
    );
    expect(
      await screen.findByRole("button", { name: "Kişi: Ayşe" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "İş: Lansman" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Kişi: Ayşe" }));
    expect(onOpenPerson).toHaveBeenCalledWith(person);

    fireEvent.click(screen.getByRole("button", { name: "Tamamla: Pazartesi gunu one-pager deadline" }));
    expect(completeReminder).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Kişi:/ })).toBeNull();
  });

  it("opens initiative menu for an initiative reminder", async () => {
    const onOpenInitiative = vi.fn();
    const reminder: BugunReminder = {
      id: 6,
      targetType: "initiative",
      targetId: initiative.id,
      dueAt: "2026-09-07T01:00:00.000Z",
      period: "once",
      done: false,
      createdAt: "2026-09-06T00:00:00.000Z",
      title: "İş hatırlatması",
    };

    render(
      <BugunView
        db={{
          listActiveNotes: vi.fn().mockResolvedValue([]),
          softDeleteNote: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([]),
          listInitiatives: vi.fn().mockResolvedValue([initiative]),
          getNote: vi.fn(),
        }}
        onOpenInitiative={onOpenInitiative}
        onOpenPerson={vi.fn()}
        onToast={vi.fn()}
        ticker={makeTicker({ upcomingReminders: [reminder] })}
      />,
    );

    fireEvent.click(await screen.findByText("İş hatırlatması"));
    fireEvent.click(await screen.findByRole("button", { name: "İş: Lansman" }));
    expect(onOpenInitiative).toHaveBeenCalledWith(initiative);
  });

  it("toasts when a note reminder has no resolvable links", async () => {
    const onToast = vi.fn();
    const reminder: BugunReminder = {
      id: 7,
      targetType: "note",
      targetId: 99,
      dueAt: "2026-09-07T01:00:00.000Z",
      period: "once",
      done: false,
      createdAt: "2026-09-06T00:00:00.000Z",
      title: "Ölü hatırlatma",
    };

    render(
      <BugunView
        db={{
          listActiveNotes: vi.fn().mockResolvedValue([]),
          softDeleteNote: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([]),
          listInitiatives: vi.fn().mockResolvedValue([]),
          getNote: vi.fn().mockResolvedValue(null),
        }}
        onOpenInitiative={vi.fn()}
        onOpenPerson={vi.fn()}
        onToast={onToast}
        ticker={makeTicker({ upcomingReminders: [reminder] })}
      />,
    );

    fireEvent.click(await screen.findByText("Ölü hatırlatma"));
    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Bağlantı bulunamadı");
    });
  });
});
