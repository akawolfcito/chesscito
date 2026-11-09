import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render, screen, fireEvent } from "@/test-utils/render-with-intl";
import { ContextualActionSlot } from "../contextual-action-slot";

const noop = () => {};

const baseHandlers = {
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
    expect(screen.getByRole("button", { name: "RETRY" })).toBeInTheDocument();
    // The compact label is a <span> rendered next to the button. Since it
    // mirrors the button's own a11y name in this case, scope by tag to
    // avoid the duplicate-match ambiguity.
    const label = screen
      .getAllByText("RETRY")
      .find((el) => el.tagName === "SPAN");
    expect(label).toBeDefined();
    fireEvent.click(screen.getByRole("button"));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  // MiniPay Lote 2 F1: the off-chain SAVE pin was removed from the action
  // slot (off-chain save auto-runs). CLAIM is the compact reward pin now.
  it("uses the compactLabel ('CLAIM') for the claimBadge action", () => {
    render(
      <ContextualActionSlot
        action="claimBadge"
        shieldsAvailable={0}
        isBusy={false}
        compact
        {...baseHandlers}
      />,
    );
    const label = screen
      .getAllByText("CLAIM")
      .find((el) => el.tagName === "SPAN");
    expect(label).toBeDefined();
    expect(label!.textContent).toBe("CLAIM");
  });
});
