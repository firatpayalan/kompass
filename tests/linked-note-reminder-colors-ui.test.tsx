// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import LinkedNotes from "../src/components/LinkedNotes";
import type { Note } from "../src/lib/types";

afterEach(cleanup);

const base: Note = {
  id: 1,
  body: "Mail grubu olusturma",
  createdAt: "2026-09-06T01:00:00.000Z",
  updatedAt: "2026-09-06T01:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [],
  initiativeIds: [],
  topicIds: [],
  nextReminderDueAt: null,
};

describe("LinkedNotes reminder colors", () => {
  it("applies overdue class when reminder is past", () => {
    const { container } = render(
      <LinkedNotes
        loading={false}
        notes={[{ ...base, nextReminderDueAt: "2026-09-01T10:00:00.000Z" }]}
        now={() => new Date(2026, 8, 6, 12)}
      />,
    );
    expect(
      container.querySelector(".linked-note-list__item--overdue"),
    ).toBeTruthy();
    expect(screen.getByText("5 gün gecikti")).toBeTruthy();
  });

  it("applies soon class when due within 3 days", () => {
    const { container } = render(
      <LinkedNotes
        loading={false}
        notes={[{ ...base, nextReminderDueAt: "2026-09-08T10:00:00.000Z" }]}
        now={() => new Date(2026, 8, 6, 12)}
      />,
    );
    expect(
      container.querySelector(".linked-note-list__item--soon"),
    ).toBeTruthy();
    expect(screen.getByText("2 gün kaldı")).toBeTruthy();
  });

  it("shows Bugün when due today", () => {
    render(
      <LinkedNotes
        loading={false}
        notes={[{ ...base, nextReminderDueAt: "2026-09-06T08:00:00.000Z" }]}
        now={() => new Date(2026, 8, 6, 12)}
      />,
    );
    expect(screen.getByText("Bugün")).toBeTruthy();
  });
});
