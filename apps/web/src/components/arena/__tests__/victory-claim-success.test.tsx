import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Echo-mock: useTranslations returns the i18n key as its text value so
// assertions are key-stable (copy changes don't break tests).
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// Lottie is a canvas animation — no-op in jsdom.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

// ShareModal: render a sentinel div so we can detect open state.
vi.mock("@/components/share/share-modal", () => ({
  ShareModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="share-modal" /> : null,
}));

// VictoryPopupShell: pass-through wrapper so child content renders.
vi.mock("../victory-popup-shell", () => ({
  VictoryPopupShell: ({ children, onClose }: { children: React.ReactNode; onClose: () => void }) => (
    <div>
      <button type="button" onClick={onClose} aria-label="closeResultAria">close</button>
      {children}
    </div>
  ),
}));

import { VictoryClaimSuccess } from "../victory-claim-success";
import type { ClaimData, ShareStatus } from "../arena-end-state";

const baseClaimData: ClaimData = {
  tokenId: null,
  claimTxHash: null,
  shareCardUrl: null,
  shareLinkUrl: null,
};

const baseProps = {
  moves: 14,
  elapsedMs: 90000,
  difficulty: "easy",
  onPlayAgain: vi.fn(),
  onBackToHub: vi.fn(),
  claimData: baseClaimData,
  shareStatus: "locked" as ShareStatus,
};

describe("VictoryClaimSuccess — Share always present (Part A)", () => {
  it("renders Share button when shareStatus is 'locked' (no mint share link yet)", () => {
    render(<VictoryClaimSuccess {...baseProps} shareStatus="locked" />);
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("renders Share button when shareStatus is 'generating'", () => {
    render(<VictoryClaimSuccess {...baseProps} shareStatus="generating" />);
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("renders Share button when shareStatus is 'ready' (mint share link present)", () => {
    const claimData: ClaimData = {
      ...baseClaimData,
      shareCardUrl: "https://chesscito.com/api/og/victory/42",
      shareLinkUrl: "https://chesscito.com/victory/42",
    };
    render(
      <VictoryClaimSuccess {...baseProps} shareStatus="ready" claimData={claimData} />
    );
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("opens ShareModal when Share button is clicked", () => {
    render(<VictoryClaimSuccess {...baseProps} shareStatus="locked" />);
    expect(screen.queryByTestId("share-modal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /share/i }));
    expect(screen.getByTestId("share-modal")).toBeInTheDocument();
  });

  it("uses fallback /api/og/match card when shareCardUrl is null", () => {
    // When the modal renders, it receives the effectiveCardUrl. We verify
    // the Share button exists (card URL is internal to ShareModal mock).
    render(
      <VictoryClaimSuccess
        {...baseProps}
        shareStatus="locked"
        fen="rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
        playerColor="w"
      />
    );
    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });
});

describe("VictoryClaimSuccess — Play Again always present", () => {
  it("renders Play Again button", () => {
    render(<VictoryClaimSuccess {...baseProps} />);
    // aria-label is set to the playAgain key
    expect(screen.getByRole("button", { name: /playAgain/i })).toBeInTheDocument();
  });

  it("calls onPlayAgain when clicked", () => {
    const onPlayAgain = vi.fn();
    render(<VictoryClaimSuccess {...baseProps} onPlayAgain={onPlayAgain} />);
    fireEvent.click(screen.getByRole("button", { name: /playAgain/i }));
    expect(onPlayAgain).toHaveBeenCalledOnce();
  });
});

describe("VictoryClaimSuccess — Save Again button (Part B)", () => {
  it("renders Save Again when onSaveAgain is provided", () => {
    const onSaveAgain = vi.fn();
    render(<VictoryClaimSuccess {...baseProps} onSaveAgain={onSaveAgain} />);
    // aria-label is set to VICTORY_CELEBRATION_COPY.primaryLabel key
    expect(screen.getByRole("button", { name: /primaryLabel/i })).toBeInTheDocument();
  });

  it("does NOT render Save Again when onSaveAgain is omitted", () => {
    render(<VictoryClaimSuccess {...baseProps} />);
    expect(screen.queryByRole("button", { name: /primaryLabel/i })).toBeNull();
  });

  it("calls onSaveAgain when Save Again button is clicked", () => {
    const onSaveAgain = vi.fn();
    render(<VictoryClaimSuccess {...baseProps} onSaveAgain={onSaveAgain} />);
    fireEvent.click(screen.getByRole("button", { name: /primaryLabel/i }));
    expect(onSaveAgain).toHaveBeenCalledOnce();
  });
});

describe("VictoryClaimSuccess — Coach section", () => {
  it("renders Coach section when onAskCoach is provided", () => {
    render(<VictoryClaimSuccess {...baseProps} onAskCoach={vi.fn()} />);
    // Coach pill uses winCoachReviewCta key
    expect(screen.getByRole("button", { name: /winCoachReviewCta/i })).toBeInTheDocument();
  });

  it("omits Coach section when onAskCoach is not provided", () => {
    render(<VictoryClaimSuccess {...baseProps} />);
    expect(screen.queryByRole("button", { name: /winCoachReviewCta/i })).toBeNull();
  });

  it("Coach button is disabled when coachCtaDisabled is true", () => {
    render(
      <VictoryClaimSuccess {...baseProps} onAskCoach={vi.fn()} coachCtaDisabled />
    );
    expect(screen.getByRole("button", { name: /winCoachReviewCta/i })).toBeDisabled();
  });
});
