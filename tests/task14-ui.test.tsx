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
import {
  useReminderTicker,
  type ReminderNotifier,
} from "../src/hooks/useReminderTicker";
import type { Note, Reminder } from "../src/lib/types";
import BugunView from "../src/views/BugunView";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const dueReminder: Reminder & { title: string } = {
  id: 1,
  targetType: "note",
  targetId: 7,
  dueAt: "2026-09-05T10:00:00.000Z",
  period: "once",
  done: false,
  createdAt: "2026-09-05T09:00:00.000Z",
  title: "Bütçeyi takip et",
};

function note(id: number): Note {
  return {
    id,
    body: `Not ${id}`,
    createdAt: `2026-09-05T${String(id).padStart(2, "0")}:00:00.000Z`,
    updatedAt: `2026-09-05T${String(id).padStart(2, "0")}:00:00.000Z`,
    deletedAt: null,
    tags: [],
    personIds: [],
    initiativeIds: [],
    topicIds: [],
    nextReminderDueAt: null,
  };
}

function createDb(
  overrides: Partial<AppDb> = {},
): Pick<
  AppDb,
  | "advanceOrCompleteReminder"
  | "listActiveNotes"
  | "listPeople"
  | "listInitiatives"
  | "listDueRemindersForBugun"
  | "listOverdueReminders"
  | "listUpcomingReminders"
> {
  return {
    advanceOrCompleteReminder: vi.fn().mockResolvedValue(undefined),
    listActiveNotes: vi.fn().mockResolvedValue([]),
    listPeople: vi.fn().mockResolvedValue([]),
    listInitiatives: vi.fn().mockResolvedValue([]),
    listDueRemindersForBugun: vi.fn().mockResolvedValue([]),
    listOverdueReminders: vi.fn().mockResolvedValue([]),
    listUpcomingReminders: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

type BugunHarnessProps = {
  db: Pick<
    AppDb,
    | "advanceOrCompleteReminder"
    | "listActiveNotes"
    | "listPeople"
    | "listInitiatives"
    | "listDueRemindersForBugun"
    | "listOverdueReminders"
    | "listUpcomingReminders"
  >;
  notify?: ReminderNotifier;
  now?: () => Date;
};

/** Mirrors App, which owns the ticker and hands it to BugunView. */
function BugunHarness({ db, notify, now }: BugunHarnessProps) {
  const ticker = useReminderTicker({ db, notify, now });
  return <BugunView db={db} ticker={ticker} />;
}

describe("Task 14 Bugün view", () => {
  it("shows overdue, today, and upcoming reminder sections", async () => {
    const overdue = {
      ...dueReminder,
      id: 1,
      title: "Geciken iş",
      dueAt: "2026-09-04T10:00:00.000Z",
    };
    const today = {
      ...dueReminder,
      id: 2,
      title: "Bugünkü iş",
      dueAt: "2026-09-05T10:00:00.000Z",
    };
    const upcoming = {
      ...dueReminder,
      id: 3,
      title: "Yaklaşan iş",
      dueAt: "2026-09-08T10:00:00.000Z",
    };
    const advanceOrCompleteReminder = vi.fn().mockResolvedValue(undefined);
    const listOverdueReminders = vi
      .fn()
      .mockResolvedValueOnce([overdue])
      .mockResolvedValue([]);

    render(
      <BugunHarness
        db={createDb({
          advanceOrCompleteReminder,
          listOverdueReminders,
          listDueRemindersForBugun: vi.fn().mockResolvedValue([today]),
          listUpcomingReminders: vi.fn().mockResolvedValue([upcoming]),
        })}
        now={() => new Date(2026, 8, 5, 12)}
        notify={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(
      await screen.findByRole("heading", { name: "Gecikenler" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Hatırlatmalar" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Yaklaşanlar" }),
    ).toBeTruthy();
    expect(screen.getByText("Geciken iş")).toBeTruthy();
    expect(screen.getByText("Bugünkü iş")).toBeTruthy();
    expect(screen.getByText("Yaklaşan iş")).toBeTruthy();

    fireEvent.click(
      screen.getByRole("button", { name: "Tamamla: Geciken iş" }),
    );
    await waitFor(() => {
      expect(advanceOrCompleteReminder).toHaveBeenCalled();
      expect(screen.queryByText("Geciken iş")).toBeNull();
    });
  });

  it("shows today's reminders and only the ten most recent active notes", async () => {
    const notes = Array.from({ length: 12 }, (_, index) => note(12 - index));
    const db = createDb({
      listActiveNotes: vi.fn().mockResolvedValue(notes),
      listDueRemindersForBugun: vi.fn().mockResolvedValue([dueReminder]),
    });

    render(
      <BugunHarness
        db={db}
        now={() => new Date("2026-09-05T12:00:00.000Z")}
        notify={vi.fn().mockResolvedValue(true)}
      />,
    );

    expect(await screen.findByText("Bütçeyi takip et")).toBeTruthy();
    const recentNotes = screen.getByRole("list", { name: "Son notlar" });
    expect(within(recentNotes).getAllByRole("listitem")).toHaveLength(10);
    expect(within(recentNotes).queryByText("Not 2")).toBeNull();
    expect(within(recentNotes).queryByText("Not 1")).toBeNull();
  });

  it("completes a reminder through advanceOrCompleteReminder and reloads", async () => {
    const listDueRemindersForBugun = vi
      .fn()
      .mockResolvedValueOnce([dueReminder])
      .mockResolvedValue([]);
    const advanceOrCompleteReminder = vi.fn().mockResolvedValue(undefined);
    const db = createDb({
      advanceOrCompleteReminder,
      listDueRemindersForBugun,
    });
    const current = new Date("2026-09-05T12:00:00.000Z");

    render(
      <BugunHarness
        db={db}
        now={() => current}
        notify={vi.fn().mockResolvedValue(true)}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Tamamla: Bütçeyi takip et" }),
    );

    await waitFor(() => {
      expect(advanceOrCompleteReminder).toHaveBeenCalledWith(
        dueReminder,
        current,
      );
      expect(screen.queryByText("Bütçeyi takip et")).toBeNull();
    });
  });

  it("refreshes every minute and on window focus", async () => {
    vi.useFakeTimers();
    const listDueRemindersForBugun = vi.fn().mockResolvedValue([]);
    const db = createDb({ listDueRemindersForBugun });

    render(
      <BugunHarness
        db={db}
        now={() => new Date("2026-09-05T12:00:00.000Z")}
        notify={vi.fn().mockResolvedValue(true)}
      />,
    );
    await vi.waitFor(() =>
      expect(listDueRemindersForBugun).toHaveBeenCalledTimes(1),
    );

    await vi.advanceTimersByTimeAsync(60_000);
    await vi.waitFor(() =>
      expect(listDueRemindersForBugun).toHaveBeenCalledTimes(2),
    );

    fireEvent.focus(window);
    await vi.waitFor(() =>
      expect(listDueRemindersForBugun).toHaveBeenCalledTimes(3),
    );
  });

  it("notifies each newly due reminder once per session", async () => {
    vi.useFakeTimers();
    const notify = vi.fn().mockResolvedValue(true);
    const db = createDb({
      listDueRemindersForBugun: vi.fn().mockResolvedValue([dueReminder]),
    });

    render(
      <BugunHarness
        db={db}
        now={() => new Date("2026-09-05T12:00:00.000Z")}
        notify={notify}
      />,
    );
    await vi.waitFor(() => expect(notify).toHaveBeenCalledOnce());

    await vi.advanceTimersByTimeAsync(120_000);

    expect(notify).toHaveBeenCalledOnce();
    expect(notify).toHaveBeenCalledWith(
      "Hatırlatma",
      "Bütçeyi takip et",
    );
  });

  it("shows the permission warning only once when notifications are denied", async () => {
    const notify = vi.fn().mockResolvedValue(false);
    const secondReminder = {
      ...dueReminder,
      id: 2,
      title: "İkinci hatırlatma",
    };
    const db = createDb({
      listDueRemindersForBugun: vi
        .fn()
        .mockResolvedValue([dueReminder, secondReminder]),
    });

    render(
      <BugunHarness
        db={db}
        now={() => new Date("2026-09-05T12:00:00.000Z")}
        notify={notify}
      />,
    );

    expect(
      await screen.findByText(
        "Bildirim izni yok; Bugün paneli çalışmaya devam eder",
      ),
    ).toBeTruthy();
    fireEvent.focus(window);
    await waitFor(() => expect(notify).toHaveBeenCalledOnce());
  });
});
