// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import QuickNoteModal from "../src/components/QuickNoteModal";
import NoteEditor from "../src/components/NoteEditor";
import NoteList from "../src/components/NoteList";
import { useAppShortcuts } from "../src/hooks/useAppShortcuts";
import { createDraftStore } from "../src/lib/drafts";

afterEach(cleanup);

function ShortcutHarness({ onQuickNote }: { onQuickNote: () => void }) {
  useAppShortcuts({ onQuickNote });
  return null;
}

describe("Task 12 notes UI", () => {
  it("opens quick note capture through Cmd+N", () => {
    const onQuickNote = vi.fn();
    render(<ShortcutHarness onQuickNote={onQuickNote} />);

    fireEvent.keyDown(window, { key: "n", metaKey: true });

    expect(onQuickNote).toHaveBeenCalledOnce();
  });

  it("saves a note with selected links and an optional reminder", async () => {
    const createNote = vi.fn().mockResolvedValue({ id: 42 });
    const createReminder = vi.fn().mockResolvedValue({});
    const onSaved = vi.fn();
    render(
      <QuickNoteModal
        db={{
          createNote,
          createReminder,
          listPeople: vi.fn().mockResolvedValue([
            { id: 1, name: "Ayşe", roleOrNotes: null, createdAt: "" },
          ]),
          listInitiatives: vi.fn().mockResolvedValue([
            {
              id: 2,
              name: "Lansman",
              status: "aktif",
              blockerSummary: null,
              createdAt: "",
            },
          ]),
        }}
        draftStore={createDraftStore()}
        onClose={vi.fn()}
        onSaved={onSaved}
        onToast={vi.fn()}
      />,
    );

    expect(document.activeElement).toBe(screen.getByLabelText("Not"));
    fireEvent.change(screen.getByLabelText("Not"), {
      target: { value: "Takip #aksiyon" },
    });
    await screen.findByLabelText("Ayşe");
    fireEvent.click(screen.getByLabelText("Ayşe"));
    fireEvent.click(screen.getByLabelText("Lansman"));
    fireEvent.click(screen.getByLabelText("Hatırlatma ekle"));
    fireEvent.change(screen.getByLabelText("Hatırlatma zamanı"), {
      target: { value: "2026-09-06T09:30" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(createNote).toHaveBeenCalledWith({
      body: "Takip #aksiyon",
      personIds: [1],
      initiativeIds: [2],
    });
    expect(createReminder).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: "note",
        targetId: 42,
        period: "once",
      }),
    );
  });

  it("keeps the draft and shows a Turkish toast when saving fails", async () => {
    const draftStore = createDraftStore();
    const onToast = vi.fn();
    render(
      <QuickNoteModal
        db={{
          createNote: vi.fn().mockRejectedValue(new Error("disk")),
          createReminder: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([]),
          listInitiatives: vi.fn().mockResolvedValue([]),
        }}
        draftStore={draftStore}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onToast={onToast}
      />,
    );

    fireEvent.change(screen.getByLabelText("Not"), {
      target: { value: "Kaybolmamalı" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() =>
      expect(onToast).toHaveBeenCalledWith(
        "Kayıt başarısız; taslak korundu",
      ),
    );
    expect(draftStore.getDraft()).toBe("Kaybolmamalı");
  });

  it("rejects an empty body before calling the database", async () => {
    const createNote = vi.fn();
    const onToast = vi.fn();
    render(
      <QuickNoteModal
        db={{
          createNote,
          createReminder: vi.fn(),
          listPeople: vi.fn().mockResolvedValue([]),
          listInitiatives: vi.fn().mockResolvedValue([]),
        }}
        draftStore={createDraftStore()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onToast={onToast}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Kaydet" }));

    expect(createNote).not.toHaveBeenCalled();
    expect(onToast).toHaveBeenCalledWith("Not boş olamaz");
  });

  it("edits and saves a note body", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);

    function Harness() {
      const [editing, setEditing] = useState(false);
      return (
        <NoteEditor
          editing={editing}
          note={{
            id: 7,
            body: "Eski",
            createdAt: "",
            updatedAt: "",
            deletedAt: null,
            tags: [],
            personIds: [],
            initiativeIds: [],
          }}
          onEdit={() => setEditing(true)}
          onSave={onSave}
          onCancel={() => setEditing(false)}
        />
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Eski" }));
    fireEvent.change(screen.getByLabelText("Not metni"), {
      target: { value: "Yeni" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Değişiklikleri kaydet" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("Yeni", null));
  });

  it("soft-deletes a note from the active list", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <NoteList
        editingNoteId={null}
        notes={[
          {
            id: 9,
            body: "Silinecek",
            createdAt: "2026-09-05T10:00:00.000Z",
            updatedAt: "2026-09-05T10:00:00.000Z",
            deletedAt: null,
            tags: [],
            personIds: [],
            initiativeIds: [],
          },
        ]}
        onDelete={onDelete}
        onEdit={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Sil" }));

    expect(onDelete).toHaveBeenCalledWith(9);
  });
});
