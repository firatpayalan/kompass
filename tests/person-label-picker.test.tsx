// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PersonLabelPicker from "../src/components/PersonLabelPicker";
import type { PersonLabel } from "../src/lib/types";

afterEach(cleanup);

const labels: PersonLabel[] = [
  {
    id: 1,
    name: "Lider",
    color: "sky",
    createdAt: "2026-09-05T00:00:00.000Z",
  },
];

describe("PersonLabelPicker context menu", () => {
  it("renames a label from the context menu", async () => {
    const onUpdate = vi.fn().mockResolvedValue({
      ...labels[0],
      name: "Yönetici",
    });
    const onToast = vi.fn();
    render(
      <PersonLabelPicker
        labels={labels}
        onChange={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToast={onToast}
        onUpdate={onUpdate}
        value={1}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("option", { name: "Lider" }));
    fireEvent.click(screen.getByRole("button", { name: "İsim değiştir" }));
    const input = screen.getByLabelText("Etiket adını düzenle");
    fireEvent.change(input, { target: { value: "Yönetici" } });
    fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(1, { name: "Yönetici" });
    });
  });

  it("recolors a label from the context menu", async () => {
    const onUpdate = vi.fn().mockResolvedValue({
      ...labels[0],
      color: "rose",
    });
    render(
      <PersonLabelPicker
        labels={labels}
        onChange={vi.fn()}
        onCreate={vi.fn()}
        onDelete={vi.fn()}
        onToast={vi.fn()}
        onUpdate={onUpdate}
        value={1}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("option", { name: "Lider" }));
    fireEvent.click(screen.getByRole("button", { name: "Renk değiştir" }));
    fireEvent.click(screen.getByRole("button", { name: "rose" }));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(1, { color: "rose" });
    });
  });

  it("deletes a label from the context menu after confirm", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <PersonLabelPicker
        labels={labels}
        onChange={onChange}
        onCreate={vi.fn()}
        onDelete={onDelete}
        onToast={vi.fn()}
        onUpdate={vi.fn()}
        value={1}
      />,
    );

    fireEvent.contextMenu(screen.getByRole("option", { name: "Lider" }));
    fireEvent.click(screen.getByRole("button", { name: "Etiket sil" }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(1);
      expect(onChange).toHaveBeenCalledWith(null);
    });
  });
});
