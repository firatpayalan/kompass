// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import PersonForm from "../src/components/PersonForm";
import InitiativeForm from "../src/components/InitiativeForm";

afterEach(cleanup);

describe("create form errors", () => {
  it("shows the underlying person create error on screen", async () => {
    const onToast = vi.fn();
    render(
      <PersonForm
        createPerson={vi
          .fn()
          .mockRejectedValue("error returned from database: no such column")}
        createPersonLabel={vi.fn()}
        deletePersonLabel={vi.fn()}
        listPersonLabels={vi.fn().mockResolvedValue([])}
        updatePersonLabel={vi.fn()}
        onCreated={vi.fn()}
        onDuplicate={vi.fn()}
        onToast={onToast}
      />,
    );

    fireEvent.change(await screen.findByLabelText("Ad"), {
      target: { value: "Ayşe" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Kişi ekle" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(
      "error returned from database: no such column",
    );
    expect(onToast).toHaveBeenCalledWith(
      "error returned from database: no such column",
    );
  });

  it("shows the underlying initiative create error on screen", async () => {
    const onToast = vi.fn();
    render(
      <InitiativeForm
        createInitiative={vi
          .fn()
          .mockRejectedValue(new Error("RETURNING expression failed"))}
        createNote={vi.fn()}
        onCreated={vi.fn()}
        onDuplicate={vi.fn()}
        onToast={onToast}
      />,
    );

    fireEvent.change(screen.getByLabelText("İş adı"), {
      target: { value: "Atlas" },
    });
    fireEvent.click(screen.getByRole("button", { name: "İş ekle" }));

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "RETURNING expression failed",
      );
      expect(onToast).toHaveBeenCalledWith("RETURNING expression failed");
    });
  });
});
