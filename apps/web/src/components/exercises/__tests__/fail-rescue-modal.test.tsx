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

  it("shows the shield rescue price as a companion pill", () => {
    renderModal();

    // Reads the canonical price so the pill can never advertise a
    // number the spend call does not charge.
    expect(
      screen.getByText(`${SHIELD_RESCUE_PEONES_COST} Peones`),
    ).toBeInTheDocument();
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
