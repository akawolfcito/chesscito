import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContextualActionSlot } from "../contextual-action-slot";

const noop = () => {};

const baseHandlers = {
  onSubmitScore: noop,
  onUseShield: noop,
  onClaimBadge: noop,
  onRetry: noop,
  onConnectWallet: noop,
  onSwitchNetwork: noop,
};

describe("ContextualActionSlot — compact label", () => {
  it("renders a compact label below the pin so retry isn't icon-only", () => {
    const onRetry = vi.fn();
    render(
      <ContextualActionSlot
        action="retry"
        shieldsAvailable={0}
        isBusy={false}
        compact
        {...baseHandlers}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    // The compact label is a <span> rendered next to the button. Since it
    // mirrors the button's own a11y name in this case, scope by tag to
    // avoid the duplicate-match ambiguity.
    const label = screen
      .getAllByText("Retry")
      .find((el) => el.tagName === "SPAN");
    expect(label).toBeDefined();
    fireEvent.click(screen.getByRole("button"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("uses the short compactLabel ('Submit'), not the long 'Submit Score'", () => {
    render(
      <ContextualActionSlot
        action="submitScore"
        shieldsAvailable={0}
        isBusy={false}
        compact
        {...baseHandlers}
      />,
    );
    const label = screen
      .getAllByText(/Submit/)
      .find((el) => el.tagName === "SPAN");
    expect(label).toBeDefined();
    expect(label!.textContent).toBe("Submit");
    expect(screen.queryByText("Submit Score")).not.toBeInTheDocument();
  });
});
