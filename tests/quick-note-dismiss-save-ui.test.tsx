// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import QuickNoteModal from "../src/components/QuickNoteModal";
import { createDraftStore } from "../src/lib/drafts";

afterEach(cleanup);

function renderModal(
  overrides: {
    createNote?: ReturnType<typeof vi.fn>;
    onClose?: ReturnType<typeof vi.fn>;
    onSaved?: ReturnType<typeof vi.fn>;
    onToast?: ReturnType<typeof vi.fn>;
    draftStore?: ReturnType<typeof createDraftStore>;
  } = {},
) {
  const createNote =
    overrides.createNote ?? vi.fn().mockResolvedValue({ id: 1 });
  const onClose = overrides.onClose ?? vi.fn();
  const onSaved = overrides.onSaved ?? vi.fn();
  const onToast = overrides.onToast ?? vi.fn();
  const draftStore = overrides.draftStore ?? createDraftStore();
  render(
    <QuickNoteModal
      db={{
        createNote,
        createReminder: vi.fn(),
        saveNoteImage: vi.fn(),
      }}
      draftStore={draftStore}
      onClose={onClose}
      onSaved={onSaved}
      onToast={onToast}
    />,
  );
  return { createNote, onClose, onSaved, onToast, draftStore };
}

describe("QuickNote dismiss saves", () => {
  it("saves on Escape when the body is non-empty", async () => {
    const { createNote, onSaved, onClose } = renderModal();
    fireEvent.change(screen.getByLabelText("Not"), {
      target: { value: "Kaçmadan kaydet" },
    });
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(createNote).toHaveBeenCalledWith({
      body: "Kaçmadan kaydet",
      personIds: [],
      initiativeIds: [],
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("saves when the close (×) button is clicked", async () => {
    const { createNote, onSaved } = renderModal();
    fireEvent.change(screen.getByLabelText("Not"), {
      target: { value: "Çarpı ile kaydet" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kapat" }));

    await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
    expect(createNote).toHaveBeenCalledWith({
      body: "Çarpı ile kaydet",
      personIds: [],
      initiativeIds: [],
    });
  });

  it("does not save when Vazgeç is clicked", async () => {
    const draftStore = createDraftStore();
    const { createNote, onClose, onSaved } = renderModal({ draftStore });
    fireEvent.change(screen.getByLabelText("Not"), {
      target: { value: "Vazgeçilecek" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(createNote).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
    expect(draftStore.getDraft()).toBeNull();
  });

  it("closes without saving when Escape is pressed on an empty note", async () => {
    const { createNote, onClose, onSaved } = renderModal();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(createNote).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
