import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import {
  renderWithIntl as render,
  screen,
  fireEvent,
} from "@/test-utils/render-with-intl";

import { FailRescueModal, type FailRescueModalProps } from "../fail-rescue-modal";
import { SHIELD_RESCUE_PEONES_COST } from "@/lib/peones/shield-spend-fallback";

afterEach(() => {
  cleanup();
});

function renderModal(overrides: Partial<FailRescueModalProps> = {}) {
  const handlers = {
    onUseShield: vi.fn(),
    onRetryAnyway: vi.fn(),
    onClaimFree: vi.fn(),
  };

  render(
    <FailRescueModal
      visible
      variant="D"
      shieldsCount={0}
      onUseShield={handlers.onUseShield}
      onRetryAnyway={handlers.onRetryAnyway}
      onClaimFree={handlers.onClaimFree}
      {...overrides}
    />,
  );

  return handlers;
}

describe("FailRescueModal — variant D (0 shields, Peones fallback)", () => {
  it("taps the primary CTA and calls onUseShield, not a dead Shop deep link", () => {
    const handlers = renderModal();

    fireEvent.click(screen.getByRole("button", { name: /use peones/i }));

    expect(handlers.onUseShield).toHaveBeenCalledTimes(1);
  });

  it("shows the price as a cost ribbon, in the app's sprite+number language", () => {
    const { container } = render(
      <FailRescueModal
        visible
        variant="D"
        shieldsCount={0}
        onUseShield={() => {}}
        onRetryAnyway={() => {}}
        onClaimFree={() => {}}
      />,
    );

    // Moved off a "5 Peones" text pill onto the same ribbon the Coach
    // CTAs use (founder pass 2026-07-22): a paid action is marked
    // visually, not narrated. Still asserted against the canonical
    // constant so the ribbon can never advertise a number the spend call
    // does not charge.
    const ribbon = container.querySelector(".coach-cost-ribbon__label");
    expect(ribbon).not.toBeNull();
    expect(ribbon).toHaveTextContent(String(SHIELD_RESCUE_PEONES_COST));
  });

  it("keeps the price reachable for assistive tech — the ribbon is decorative", () => {
    renderModal();

    // The ribbon is aria-hidden, so the cost has to travel in the label.
    expect(
      screen.getByRole("button", {
        name: new RegExp(`${SHIELD_RESCUE_PEONES_COST} Peones`, "i"),
      }),
    ).toBeInTheDocument();
  });

  it("does not narrate the price anywhere else", () => {
    renderModal();

    // The old build said it three times: footer sentence, companion
    // pill, and the CTA. One visual marker is the whole point.
    expect(screen.queryByText(/costs \d+ peones/i)).toBeNull();
    expect(
      screen.queryByText(`${SHIELD_RESCUE_PEONES_COST} Peones`),
    ).toBeNull();
  });
});

describe("FailRescueModal — variant C regression guard (unaffected by the D fix)", () => {
  it("still calls onClaimFree, not onUseShield, when the welcome pack pitch is tapped", () => {
    const handlers = renderModal({ variant: "C" });

    fireEvent.click(screen.getByRole("button", { name: /claim 3 shields/i }));

    expect(handlers.onClaimFree).toHaveBeenCalledTimes(1);
    expect(handlers.onUseShield).not.toHaveBeenCalled();
  });
});
