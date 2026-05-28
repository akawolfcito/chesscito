import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VictoryPopupShell } from "../victory-popup-shell";

// #114 — backdrop tap must be a no-op when the popup is in a
// mint-available state, while the X close button continues to work.
describe("VictoryPopupShell — backdrop close policy", () => {
  it("backdrop tap calls onClose by default (legacy behavior)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <VictoryPopupShell onClose={onClose} ariaLabel="Victory">
        <p>panel</p>
      </VictoryPopupShell>,
    );
    // The outermost dialog node is the backdrop.
    const backdrop = screen.getByRole("dialog", { name: "Victory" });
    await user.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("backdrop tap is a no-op when disableBackdropClose=true", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <VictoryPopupShell
        onClose={onClose}
        disableBackdropClose
        ariaLabel="Victory"
      >
        <p>panel</p>
      </VictoryPopupShell>,
    );
    const backdrop = screen.getByRole("dialog", { name: "Victory" });
    await user.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("X button still calls onClose when disableBackdropClose=true", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <VictoryPopupShell
        onClose={onClose}
        disableBackdropClose
        ariaLabel="Victory"
        closeLabel="Close victory dialog"
      >
        <p>panel</p>
      </VictoryPopupShell>,
    );
    await user.click(screen.getByRole("button", { name: "Close victory dialog" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clicking inside the panel does not trigger onClose (stopPropagation)", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <VictoryPopupShell onClose={onClose} ariaLabel="Victory">
        <button type="button">inner</button>
      </VictoryPopupShell>,
    );
    await user.click(screen.getByRole("button", { name: "inner" }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
