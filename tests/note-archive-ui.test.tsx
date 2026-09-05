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

import NoteList from "../src/components/NoteList";
import type { Note } from "../src/lib/types";

afterEach(cleanup);

const note: Note = {
  id: 9,
  body: "Arşivlenecek not",
  createdAt: "2026-09-05T10:00:00.000Z",
  updatedAt: "2026-09-05T10:00:00.000Z",
  deletedAt: null,
  tags: [],
  personIds: [],
  initiativeIds: [],
  topicIds: [],
  nextReminderDueAt: null,
};

describe("note right-click archive", () => {
  it("archives a note after context menu confirm", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <NoteList
        editingNoteId={null}
        notes={[note]}
        onDelete={onDelete}
        onEdit={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    fireEvent.contextMenu(screen.getByText("Arşivlenecek not"));
    fireEvent.click(screen.getByRole("button", { name: "Arşivle" }));

    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Arşivle" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith(9));
  });
});
