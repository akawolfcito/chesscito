import { describe, it, expect, vi, afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import {
  renderWithIntl as render,
  screen,
  fireEvent,
} from "@/test-utils/render-with-intl";

import { FailRescueModal, type FailRescueModalProps } from "../fail-rescue-modal";

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

  it("shows the 2 Peones cost as a companion pill", () => {
    renderModal();

    expect(screen.getByText("2 Peones")).toBeInTheDocument();
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
