// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InitiativesView from "../src/views/InitiativesView";
import type { Initiative } from "../src/lib/types";

afterEach(cleanup);

const initiative: Initiative = {
  id: 1,
  name: "Pulse 2026 H2",
  status: "aktif",
  blockerSummary: null,
  createdAt: "2026-09-01T10:00:00.000Z",
  lastActivityAt: "2026-09-06T11:48:00.000Z",
  sortOrder: 0,
  archivedAt: null,
  tags: [],
};

describe("initiative list last activity", () => {
  it("shows relative activity left of status", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-06T12:00:00.000Z"));

    render(
      <InitiativesView
        db={{
          createInitiative: vi.fn(),
          createNote: vi.fn(),
          listInitiatives: vi.fn().mockResolvedValue([initiative]),
          listInitiativeTags: vi.fn().mockResolvedValue([]),
          reorderInitiatives: vi.fn(),
          archiveInitiative: vi.fn(),
        }}
        onToast={vi.fn()}
      />,
    );

    expect(await screen.findByText("Pulse 2026 H2")).toBeTruthy();
    expect(screen.getByText("12 dakika önce")).toBeTruthy();

    const open = screen.getByRole("button", { name: "Pulse 2026 H2" });
    const activity = open.querySelector("time");
    const status = open.querySelector(".status");
    expect(activity).not.toBeNull();
    expect(status).not.toBeNull();
    expect(
      Boolean(
        activity &&
          status &&
          Boolean(
            activity.compareDocumentPosition(status) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ),
      ),
    ).toBe(true);

    vi.useRealTimers();
  });
});
