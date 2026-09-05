/** @vitest-environment jsdom */
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReminderTicker } from "../src/hooks/useReminderTicker";
import type { Initiative, Note, Person } from "../src/lib/types";
import BugunView from "../src/views/BugunView";

afterEach(() => cleanup());

const ticker: ReminderTicker = {
  completeReminder: vi.fn(),
  loadFailed: false,
  loading: false,
  permissionDenied: false,
  refresh: vi.fn(),
  overdueReminders: [],
  reminders: [],
  upcomingReminders: [],
};

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

describe("Bugün recent-note navigation", () => {
  it("opens a menu of people and initiatives and navigates on choose", async () => {
    const onOpenPerson = vi.fn();
    const onOpenInitiative = vi.fn();
    const linked = makeNote({
      id: 10,
      body: "Bağlı not",
      personIds: [person.id],
      initiativeIds: [initiative.id],
    });

    render(
      <BugunView
        db={{
          listActiveNotes: vi.fn().mockResolvedValue([linked]),
          softDeleteNote: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([person]),
          listInitiatives: vi.fn().mockResolvedValue([initiative]),
        }}
        onOpenInitiative={onOpenInitiative}
        onOpenPerson={onOpenPerson}
        onToast={vi.fn()}
        ticker={ticker}
      />,
    );

    fireEvent.click(await screen.findByText("Bağlı not"));
    expect(
      await screen.findByRole("button", { name: "Kişi: Ayşe" }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "İş: Lansman" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Kişi: Ayşe" }));
    expect(onOpenPerson).toHaveBeenCalledWith(person);

    fireEvent.click(await screen.findByText("Bağlı not"));
    fireEvent.click(await screen.findByRole("button", { name: "İş: Lansman" }));
    expect(onOpenInitiative).toHaveBeenCalledWith(initiative);
  });

  it("does not open a menu for unlinked notes", async () => {
    const onOpenPerson = vi.fn();
    const onOpenInitiative = vi.fn();
    const unlinked = makeNote({ id: 11, body: "Bağlantısız not" });

    render(
      <BugunView
        db={{
          listActiveNotes: vi.fn().mockResolvedValue([unlinked]),
          softDeleteNote: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([person]),
          listInitiatives: vi.fn().mockResolvedValue([initiative]),
        }}
        onOpenInitiative={onOpenInitiative}
        onOpenPerson={onOpenPerson}
        onToast={vi.fn()}
        ticker={ticker}
      />,
    );

    fireEvent.click(await screen.findByText("Bağlantısız not"));
    expect(screen.queryByRole("button", { name: /Kişi:/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /İş:/ })).toBeNull();
    expect(onOpenPerson).not.toHaveBeenCalled();
    expect(onOpenInitiative).not.toHaveBeenCalled();
  });

  it("toasts when linked ids cannot be resolved", async () => {
    const onToast = vi.fn();
    const linked = makeNote({
      id: 12,
      body: "Ölü bağlantı",
      personIds: [99],
      initiativeIds: [88],
    });

    render(
      <BugunView
        db={{
          listActiveNotes: vi.fn().mockResolvedValue([linked]),
          softDeleteNote: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([]),
          listInitiatives: vi.fn().mockResolvedValue([]),
        }}
        onOpenInitiative={vi.fn()}
        onOpenPerson={vi.fn()}
        onToast={onToast}
        ticker={ticker}
      />,
    );

    fireEvent.click(await screen.findByText("Ölü bağlantı"));
    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Bağlantı bulunamadı");
    });
  });
});
