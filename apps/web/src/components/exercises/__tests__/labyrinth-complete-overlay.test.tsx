import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent } from "@testing-library/react";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

import { LabyrinthCompleteOverlay } from "../labyrinth-complete-overlay";

vi.mock("@/lib/telemetry", () => ({ track: vi.fn() }));

vi.useFakeTimers();

function renderOverlay(
  props: Partial<React.ComponentProps<typeof LabyrinthCompleteOverlay>> = {},
) {
  const onContinue = vi.fn();
  const onRetry = vi.fn();
  render(
    <LabyrinthCompleteOverlay
      moves={3}
      optimalMoves={3}
      stars={3}
      onContinue={onContinue}
      onRetry={onRetry}
      {...props}
    />,
  );
  return { onContinue, onRetry };
}

describe("LabyrinthCompleteOverlay — continue-first (QA F3 2026-06-11)", () => {
  beforeEach(() => {
    vi.clearAllTimers();
  });

  it("primary CTA is Continue and advances the path", () => {
    const { onContinue, onRetry } = renderOverlay();

    // Shell X (absolute close asset) and primary share the Continue
    // intent — the primary is the non-close one.
    const primary = screen
      .getAllByRole("button", { name: "Continue" })
      .find((b) => !b.className.includes("candy-close-asset-button"));
    expect(primary).toBeDefined();
    fireEvent.click(primary!);
    vi.runAllTimers();
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("Try again is demoted to the secondary action", () => {
    const { onRetry } = renderOverlay();

    const retry = screen.getByRole("button", { name: "Try again" });
    expect(retry).toHaveClass("arena-result-secondary-action");
    fireEvent.click(retry);
    vi.runAllTimers();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("closing with the X also continues — never strands the player in the lab", () => {
    const { onContinue } = renderOverlay();

    const closeX = screen
      .getAllByRole("button", { name: "Continue" })
      .find((b) => b.className.includes("candy-close-asset-button"));
    expect(closeX).toBeDefined();
    fireEvent.click(closeX!);
    vi.runAllTimers();
    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("king finale keeps Enter Arena as the primary", () => {
    const onEnterArena = vi.fn();
    renderOverlay({ onEnterArena });

    fireEvent.click(screen.getByRole("button", { name: "Enter Arena" }));
    vi.runAllTimers();
    expect(onEnterArena).toHaveBeenCalledTimes(1);
  });
});
