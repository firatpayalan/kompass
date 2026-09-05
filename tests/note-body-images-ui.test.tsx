/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import NoteBodyField from "../src/components/NoteBodyField";
import NoteBodyView from "../src/components/NoteBodyView";
import { formatNoteImageMarker } from "../src/lib/noteImages";

afterEach(() => cleanup());

describe("note body images UI", () => {
  it("pastes a clipboard image into the body", async () => {
    const saveNoteImage = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn();
    let value = "Merhaba";

    const { rerender } = render(
      <NoteBodyField
        onChange={(next) => {
          value = next;
          onChange(next);
        }}
        saveNoteImage={saveNoteImage}
        value={value}
      />,
    );

    const file = new File([new Uint8Array([1, 2, 3])], "shot.png", {
      type: "image/png",
    });
    const textarea = screen.getByRole("textbox");
    Object.defineProperty(textarea, "selectionStart", {
      configurable: true,
      get: () => value.length,
    });
    Object.defineProperty(textarea, "selectionEnd", {
      configurable: true,
      get: () => value.length,
    });

    fireEvent.paste(textarea, {
      clipboardData: {
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => file,
          },
        ],
      },
    });

    await waitFor(() => expect(saveNoteImage).toHaveBeenCalled());
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    const next = onChange.mock.calls.at(-1)?.[0] as string;
    expect(next).toMatch(/!\[görsel\]\(dlt-img:[0-9a-f-]{36}\)/i);
    rerender(
      <NoteBodyField
        onChange={onChange}
        saveNoteImage={saveNoteImage}
        value={next}
      />,
    );
    expect(screen.getByText(/görsel eklendi/)).toBeTruthy();
  });

  it("toasts when the image is too large", async () => {
    const onToast = vi.fn();
    const saveNoteImage = vi.fn();
    render(
      <NoteBodyField
        onChange={vi.fn()}
        onToast={onToast}
        saveNoteImage={saveNoteImage}
        value=""
      />,
    );
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "big.png", {
      type: "image/png",
    });
    fireEvent.paste(screen.getByRole("textbox"), {
      clipboardData: {
        items: [
          {
            kind: "file",
            type: "image/png",
            getAsFile: () => big,
          },
        ],
      },
    });
    await waitFor(() => {
      expect(onToast).toHaveBeenCalledWith("Görsel çok büyük");
    });
    expect(saveNoteImage).not.toHaveBeenCalled();
  });

  it("renders markers as images", async () => {
    const id = "11111111-1111-1111-1111-111111111111";
    const getNoteImage = vi.fn().mockResolvedValue({
      mime: "image/png",
      bytesBase64: "aGVsbG8=",
    });
    render(
      <NoteBodyView
        body={`Ön\n${formatNoteImageMarker(id)}\nSon`}
        getNoteImage={getNoteImage}
      />,
    );
    const img = await screen.findByRole("img", { name: "görsel" });
    expect(img.getAttribute("src")).toBe("data:image/png;base64,aGVsbG8=");
  });
});
