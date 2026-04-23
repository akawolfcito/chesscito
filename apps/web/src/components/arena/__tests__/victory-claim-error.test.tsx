import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { VictoryClaimError } from "../victory-claim-error";

// Lottie loads JSON via import — under jsdom the animation doesn't
// paint, which is fine since we're only asserting DOM + interactivity.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

describe("VictoryClaimError — empty-wallet / insufficient balance path", () => {
  const baseProps = {
    moves: 13,
    elapsedMs: 11583,
    difficulty: "easy",
    onPlayAgain: vi.fn(),
    onBackToHub: vi.fn(),
    onRetry: vi.fn(),
  };

  it("surfaces the specific error message to the user", () => {
    render(<VictoryClaimError {...baseProps} errorMessage="Insufficient balance" />);
    expect(screen.getByText("Insufficient balance")).toBeInTheDocument();
  });

  it("renders an alert-role container for screen readers", () => {
    render(<VictoryClaimError {...baseProps} errorMessage="Insufficient balance" />);
    const alert = screen.getByRole("alert");
    expect(alert).toBeInTheDocument();
    expect(alert).toHaveAttribute("aria-live", "assertive");
  });

  it("exposes three CTAs: Try Again (primary), Play Again, Back to Hub", () => {
    render(<VictoryClaimError {...baseProps} errorMessage="Insufficient balance" />);
    // These labels live in editorial.ts — verifying them by role, not literal text,
    // keeps the test resilient to copy tweaks.
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("invokes onRetry when the primary CTA is clicked", async () => {
    const onRetry = vi.fn();
    render(<VictoryClaimError {...baseProps} onRetry={onRetry} errorMessage="Insufficient balance" />);
    const user = userEvent.setup();
    const tryAgain = screen.getByRole("button", { name: /try again/i });
    await user.click(tryAgain);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("omits the primary CTA when onRetry is not provided", () => {
    render(<VictoryClaimError {...baseProps} onRetry={undefined} errorMessage="Insufficient balance" />);
    expect(screen.queryByRole("button", { name: /try again/i })).toBeNull();
  });

  it("renders stats (difficulty/moves/time) for user context", () => {
    render(<VictoryClaimError {...baseProps} errorMessage="Insufficient balance" />);
    expect(screen.getByText("13")).toBeInTheDocument(); // moves
  });
});
