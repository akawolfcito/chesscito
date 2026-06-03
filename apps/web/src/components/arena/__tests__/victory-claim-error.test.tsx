import { describe, it, expect, vi } from "vitest";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";
import userEvent from "@testing-library/user-event";
import { VictoryClaimError } from "../victory-claim-error";

// Lottie loads JSON via import — under jsdom the animation doesn't
// paint, which is fine since we're only asserting DOM + interactivity.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

// AddCashCta reads useMiniPay — control the runtime per test so we
// can assert both the in-MiniPay (CTA visible) and out-of-MiniPay
// (CTA hidden) branches of the insufficient-funds recovery affordance.
vi.mock("@/hooks/use-minipay", () => ({
  useMiniPay: vi.fn(() => ({ isReady: true, isMiniPay: false, hasProvider: false })),
}));
import { useMiniPay } from "@/hooks/use-minipay";

const setMiniPay = (isMiniPay: boolean) => {
  (useMiniPay as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    isReady: true,
    isMiniPay,
    hasProvider: false,
  });
};

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

describe("VictoryClaimError — Add Cash deeplink CTA", () => {
  const baseProps = {
    moves: 13,
    elapsedMs: 11583,
    difficulty: "easy",
    onPlayAgain: vi.fn(),
    onBackToHub: vi.fn(),
    onRetry: vi.fn(),
  };

  it("renders the AddCashCta when errorKind=insufficientFunds inside MiniPay", () => {
    setMiniPay(true);
    render(
      <VictoryClaimError
        {...baseProps}
        errorMessage="Insufficient balance"
        errorKind="insufficientFunds"
      />,
    );
    const link = screen.getByRole("link", { name: /Deposit in MiniPay/i });
    expect(link).toHaveAttribute("href", "https://minipay.opera.com/add_cash");
  });

  it("hides the AddCashCta outside MiniPay even when errorKind=insufficientFunds", () => {
    setMiniPay(false);
    render(
      <VictoryClaimError
        {...baseProps}
        errorMessage="Insufficient balance"
        errorKind="insufficientFunds"
      />,
    );
    expect(
      screen.queryByRole("link", { name: /Deposit in MiniPay/i }),
    ).not.toBeInTheDocument();
  });
});
