import { describe, it, expect, vi, beforeEach } from "vitest";

import { renderWithIntl, screen } from "@/test-utils/render-with-intl";
import { BadgeEarnedPrompt, ResultOverlay } from "../result-overlay";

// Lottie loads JSON via import — under jsdom the animation doesn't
// paint, which is fine since we're only asserting DOM + interactivity.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

// ShareModal is irrelevant to error-path assertions and pulls in
// dynamic locale data that the test bundle doesn't need.
vi.mock("@/components/share/share-modal", () => ({
  ShareModal: () => null,
}));

// AddCashCta reads useMiniPay — control it per test so we can assert
// both the in-MiniPay (CTA visible) and out-of-MiniPay (CTA hidden)
// branches of the insufficient-funds recovery affordance.
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

describe("ResultOverlay — Add Cash deeplink CTA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const errorProps = {
    variant: "error" as const,
    errorKind: "error" as const,
    errorMessage: "Insufficient balance",
    onDismiss: vi.fn(),
  };

  it("renders the AddCashCta when txErrorKind=insufficientFunds inside MiniPay", () => {
    setMiniPay(true);
    renderWithIntl(
      <ResultOverlay {...errorProps} txErrorKind="insufficientFunds" />,
    );
    const link = screen.getByRole("link", { name: /Deposit in MiniPay/i });
    expect(link).toHaveAttribute("href", "https://minipay.opera.com/add_cash");
  });

  it("hides the AddCashCta outside MiniPay even when txErrorKind=insufficientFunds", () => {
    setMiniPay(false);
    renderWithIntl(
      <ResultOverlay {...errorProps} txErrorKind="insufficientFunds" />,
    );
    expect(
      screen.queryByRole("link", { name: /Deposit in MiniPay/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the AddCashCta when txErrorKind is undefined (non-shop error paths)", () => {
    setMiniPay(true);
    renderWithIntl(
      <ResultOverlay {...errorProps} />,
    );
    expect(
      screen.queryByRole("link", { name: /Deposit in MiniPay/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the AddCashCta when txErrorKind is a non-insufficient kind (e.g. network)", () => {
    setMiniPay(true);
    renderWithIntl(
      <ResultOverlay {...errorProps} txErrorKind="network" />,
    );
    expect(
      screen.queryByRole("link", { name: /Deposit in MiniPay/i }),
    ).not.toBeInTheDocument();
  });

  it("hides the AddCashCta on success variants even with txErrorKind set", () => {
    setMiniPay(true);
    renderWithIntl(
      <ResultOverlay
        variant="shop"
        itemLabel="Founder Badge"
        onDismiss={vi.fn()}
        txErrorKind="insufficientFunds"
      />,
    );
    expect(
      screen.queryByRole("link", { name: /Deposit in MiniPay/i }),
    ).not.toBeInTheDocument();
  });
});

describe("ResultOverlay — SaveScore recovery + quota communication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("insufficient save: recoveryCta becomes the primary button (Get Peones)", () => {
    const onPress = vi.fn();
    renderWithIntl(
      <ResultOverlay
        variant="error"
        errorMessage="You're out of free saves."
        recoveryCta={{ label: "Get Peones", onPress }}
        onDismiss={vi.fn()}
      />,
    );
    const cta = screen.getByRole("button", { name: /Get Peones/i });
    cta.click();
    expect(onPress).toHaveBeenCalledTimes(1);
    // Secondary is the calm "Not now", not "Try again".
    expect(screen.getByText(/Not now/i)).toBeInTheDocument();
    expect(screen.queryByText(/Try again/i)).not.toBeInTheDocument();
  });

  // MiniPay Lote 2 (B2): off-chain save is free → the score overlay shows NO
  // Peones-spent or free-saves-left pill, only the stars earned.
  it("score save: shows stars but no Peones/free-saves pill", () => {
    renderWithIntl(
      <ResultOverlay
        variant="score"
        pieceType="rook"
        totalStars={9}
        maxPossibleStars={30}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.queryByTestId("score-free-saves-left")).not.toBeInTheDocument();
    expect(screen.queryByTestId("score-peones-spent")).not.toBeInTheDocument();
  });
});

/* Regression (2026-07-09): both star readouts divided by the deprecated
 * `EXERCISES_PER_PIECE` (5) instead of the real pool, so a piece with 10
 * exercises reported "12/15" on a 30★ ceiling. Seen on the founder's device
 * right after the rook badge minted. */
describe("star readouts use the real pool, not the legacy 5-exercise constant", () => {
  beforeEach(() => vi.clearAllMocks());

  it("BadgeEarnedPrompt shows totalStars over the piece's real max", () => {
    renderWithIntl(
      <BadgeEarnedPrompt
        pieceType="rook"
        totalStars={12}
        maxPossibleStars={30}
        onContinue={vi.fn()}
      />,
    );
    expect(screen.getByText("12/30")).toBeInTheDocument();
    expect(screen.queryByText("12/15")).not.toBeInTheDocument();
  });

  it("the badge ResultOverlay stat pill shows the real max", () => {
    renderWithIntl(
      <ResultOverlay
        variant="badge"
        pieceType="rook"
        totalStars={24}
        maxPossibleStars={30}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("24/30")).toBeInTheDocument();
  });

  it("the star meter stays a 5-segment bar and fills proportionally", () => {
    // 12 of 30 is 40% → 2 of 5 segments. Under the old constant this read
    // 4 of 5, telling a player at 40% they were nearly done.
    const { container } = renderWithIntl(
      <BadgeEarnedPrompt
        pieceType="rook"
        totalStars={12}
        maxPossibleStars={30}
        onContinue={vi.fn()}
      />,
    );
    const glyphs = Array.from(container.querySelectorAll('span[aria-hidden="true"]'))
      .map((n) => n.textContent)
      .filter((t) => t === "★" || t === "☆");
    expect(glyphs).toEqual(["★", "★", "☆", "☆", "☆"]);
  });

  it("a 15★ ceiling still fills exactly as it did before", () => {
    // Behavior parity for any piece whose pool really is 5 exercises.
    const { container } = renderWithIntl(
      <BadgeEarnedPrompt
        pieceType="rook"
        totalStars={12}
        maxPossibleStars={15}
        onContinue={vi.fn()}
      />,
    );
    const glyphs = Array.from(container.querySelectorAll('span[aria-hidden="true"]'))
      .map((n) => n.textContent)
      .filter((t) => t === "★" || t === "☆");
    expect(glyphs).toEqual(["★", "★", "★", "★", "☆"]);
  });
});

describe("ResultOverlay — top-screen transaction celebration", () => {
  const CONFETTI = '[data-testid="tx-celebration-top"]';

  it("rains confetti when a score save is confirmed on-chain (txHash present)", () => {
    const { container } = renderWithIntl(
      <ResultOverlay variant="score" txHash="0xabc" onDismiss={vi.fn()} />,
    );
    expect(container.querySelector(CONFETTI)).toBeInTheDocument();
  });

  it("does NOT celebrate the free off-chain score save (no txHash)", () => {
    const { container } = renderWithIntl(
      <ResultOverlay variant="score" onDismiss={vi.fn()} />,
    );
    expect(container.querySelector(CONFETTI)).not.toBeInTheDocument();
  });

  it("rains confetti on a confirmed badge claim", () => {
    const { container } = renderWithIntl(
      <ResultOverlay variant="badge" pieceType="rook" txHash="0xdef" onDismiss={vi.fn()} />,
    );
    expect(container.querySelector(CONFETTI)).toBeInTheDocument();
  });

  it("rains confetti on a confirmed shop purchase", () => {
    const { container } = renderWithIntl(
      <ResultOverlay variant="shop" itemLabel="Founder Badge" txHash="0x123" onDismiss={vi.fn()} />,
    );
    expect(container.querySelector(CONFETTI)).toBeInTheDocument();
  });

  it("never celebrates the error variant", () => {
    const { container } = renderWithIntl(
      <ResultOverlay variant="error" errorMessage="Boom" onDismiss={vi.fn()} />,
    );
    expect(container.querySelector(CONFETTI)).not.toBeInTheDocument();
  });
});
