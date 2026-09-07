// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import Sidebar from "../src/components/Sidebar";

afterEach(cleanup);

describe("Sidebar version", () => {
  it("shows the version at the bottom of the sidebar", () => {
    render(
      <Sidebar
        activeView="bugun"
        onViewChange={() => undefined}
        version="0.1.2"
      />,
    );

    const label = screen.getByLabelText("Uygulama sürümü");
    expect(label.textContent).toBe("v0.1.2");
  });
});
