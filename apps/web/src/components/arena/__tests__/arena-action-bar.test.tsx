import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup, fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { ArenaActionBar } from "../arena-action-bar";

afterEach(cleanup);

describe("ArenaActionBar — resign confirmation modal", () => {
  it("resign tap opens the modal instead of resigning immediately", () => {
    const onResign = vi.fn();
    render(
      <ArenaActionBar onResign={onResign} canUndo={false} isEndState={false} />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Resign" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onResign).not.toHaveBeenCalled();
  });

  it("confirming the modal fires onResign once", () => {
    const onResign = vi.fn();
    render(
      <ArenaActionBar onResign={onResign} canUndo={false} isEndState={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Resign" }));
    fireEvent.click(screen.getByTestId("arena-resign-confirm"));
    expect(onResign).toHaveBeenCalledTimes(1);
  });

  it("cancelling the modal does not resign", () => {
    const onResign = vi.fn();
    render(
      <ArenaActionBar onResign={onResign} canUndo={false} isEndState={false} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Resign" }));
    fireEvent.click(screen.getByText("Keep playing"));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onResign).not.toHaveBeenCalled();
  });

  it("end-state hides the bar (aria-hidden) so resign is unreachable", () => {
    const onResign = vi.fn();
    render(
      <ArenaActionBar onResign={onResign} canUndo={false} isEndState />,
    );
    // The bar keeps its footprint but is aria-hidden + visually hidden, so
    // its controls leave the a11y tree and no modal can be summoned.
    expect(
      document.querySelector(".arena-action-bar")?.getAttribute("aria-hidden"),
    ).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onResign).not.toHaveBeenCalled();
  });
});
