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
  };
}

function createDb(
  overrides: Partial<AppDb> = {},
): Pick<
  AppDb,
  "advanceOrCompleteReminder" | "listActiveNotes" | "listDueRemindersForBugun"
> {
  return {
    advanceOrCompleteReminder: vi.fn().mockResolvedValue(undefined),
    listActiveNotes: vi.fn().mockResolvedValue([]),
    listDueRemindersForBugun: vi.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("Task 14 Bugün view", () => {
  it("shows today's reminders and only the ten most recent active notes", async () => {
    const notes = Array.from({ length: 12 }, (_, index) => note(12 - index));
    const db = createDb({
      listActiveNotes: vi.fn().mockResolvedValue(notes),
      listDueRemindersForBugun: vi.fn().mockResolvedValue([dueReminder]),
    });

    render(
      <BugunView
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
      <BugunView
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
      <BugunView
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
      <BugunView
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
      <BugunView
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
