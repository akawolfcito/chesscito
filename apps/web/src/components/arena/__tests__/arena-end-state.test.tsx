import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// Echo-mock: useTranslations returns the i18n key (ignores interpolation
// values) so assertions stay key-stable across copy edits.
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

// lottie-web drives a real canvas — importing it under jsdom throws on a null
// 2d context. The win branch renders it; nothing here asserts on the animation.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

import { ArenaEndState, type ClaimData, type ClaimPhase } from "../arena-end-state";

const baseClaimData: ClaimData = {
  tokenId: null,
  claimTxHash: null,
  shareCardUrl: null,
  shareLinkUrl: null,
};

function renderLoss(overrides: Partial<React.ComponentProps<typeof ArenaEndState>> = {}) {
  const props: React.ComponentProps<typeof ArenaEndState> = {
    status: "resigned",
    isPlayerWin: false,
    onPlayAgain: vi.fn(),
    onBackToHub: vi.fn(),
    claimPhase: "ready" as ClaimPhase,
    shareStatus: "locked",
    claimData: baseClaimData,
    moves: 18,
    elapsedMs: 90000,
    difficulty: "easy",
    // Save tile prerequisites: a claimable, persisted mint.
    onClaimVictory: vi.fn(),
    gameRecordPersisted: true,
    claimPrice: "$0.50",
    ...overrides,
  };
  return { props, ...render(<ArenaEndState {...props} />) };
}

beforeEach(() => trackMock.mockClear());

describe("ArenaEndState — F8 phase (b) Save on loss/draw/resign", () => {
  it("renders the Save tile with the neutral 'saveMatch' label on a loss", () => {
    renderLoss();
    expect(screen.getByRole("button", { name: "saveMatchAriaLabel" })).toBeInTheDocument();
    expect(screen.getByText("saveMatch")).toBeInTheDocument();
    // Never the celebratory win label on a non-win outcome.
    expect(screen.queryByText("saveVictory")).not.toBeInTheDocument();
  });

  it("renders the Save tile for draw and stalemate too", () => {
    renderLoss({ status: "draw" });
    expect(screen.getByText("saveMatch")).toBeInTheDocument();
  });

  it("hides Save for a guest (no onClaimVictory wired)", () => {
    renderLoss({ onClaimVictory: undefined });
    expect(screen.queryByText("saveMatch")).not.toBeInTheDocument();
  });

  it("hides Save when the record has not persisted yet", () => {
    renderLoss({ gameRecordPersisted: false });
    expect(screen.queryByText("saveMatch")).not.toBeInTheDocument();
  });

  it("hides Save for a 0-move game (double-blocked with the contract)", () => {
    renderLoss({ moves: 0 });
    expect(screen.queryByText("saveMatch")).not.toBeInTheDocument();
  });

  it("on Save tap, fires save_victory_tap with the result and calls onClaimVictory", () => {
    const { props } = renderLoss({ status: "resigned" });
    fireEvent.click(screen.getByRole("button", { name: "saveMatchAriaLabel" }));
    expect(props.onClaimVictory).toHaveBeenCalledTimes(1);
    expect(trackMock).toHaveBeenCalledWith(
      "monetization.save_victory_tap",
      expect.objectContaining({ result: "resigned", context: "endgame_resign" }),
    );
  });

  it("shows the busy label while claiming and disables the button", () => {
    renderLoss({ claimPhase: "claiming" });
    const btn = screen.getByRole("button", { name: "saveMatchAriaLabel" });
    expect(btn).toBeDisabled();
    expect(screen.getByText("savingMatch")).toBeInTheDocument();
  });

  it("renders the neutral success toast and fires save_victory_success once on success", () => {
    renderLoss({
      claimPhase: "success",
      claimData: { ...baseClaimData, tokenId: 42n },
    });
    expect(screen.getByText("mintSavedToast")).toBeInTheDocument();
    expect(trackMock).toHaveBeenCalledWith(
      "monetization.save_victory_success",
      expect.objectContaining({ result: "resigned" }),
    );
  });

  it("after success, swaps Save for a non-tappable 'Saved' state (no re-tap → no cooldown revert)", () => {
    renderLoss({
      claimPhase: "success",
      claimData: { ...baseClaimData, tokenId: 42n },
    });
    // The tappable Save button is gone…
    expect(screen.queryByRole("button", { name: "saveMatchAriaLabel" })).not.toBeInTheDocument();
    // …replaced by a "Saved" confirmation that is not a button.
    expect(screen.getByText("saved")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "saved" })).not.toBeInTheDocument();
  });

  it("renders an inline retry row on failure (with reassurance) and retries on tap", () => {
    const { props } = renderLoss({ claimPhase: "error", claimError: "boom" });
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("boom");
    // T4 reassurance line so a failed save never reads as a lost game.
    expect(alert).toHaveTextContent("saveErrorHint");
    fireEvent.click(screen.getByRole("button", { name: "saveRetry" }));
    expect(props.onClaimVictory).toHaveBeenCalledTimes(1);
  });
});

describe("ArenaEndState — a cancelled claim never costs the victory screen", () => {
  function renderWin(
    overrides: Partial<React.ComponentProps<typeof ArenaEndState>> = {},
  ) {
    const props: React.ComponentProps<typeof ArenaEndState> = {
      status: "checkmate",
      isPlayerWin: true,
      onPlayAgain: vi.fn(),
      onBackToHub: vi.fn(),
      claimPhase: "ready" as ClaimPhase,
      shareStatus: "locked",
      claimData: baseClaimData,
      moves: 24,
      elapsedMs: 90000,
      difficulty: "easy",
      onClaimVictory: vi.fn(),
      gameRecordPersisted: true,
      claimPrice: "$0.50",
      ...overrides,
    };
    return { props, ...render(<ArenaEndState {...props} />) };
  }

  it("shows the 'Not saved yet' toast over the celebration, not an error popup", () => {
    renderWin({ justCancelled: true });
    expect(screen.getByText("cancelledToast")).toBeInTheDocument();
    // The dead end: VictoryClaimError's Try Again used to be the only exit.
    expect(screen.queryByText("tryAgain")).not.toBeInTheDocument();
  });

  it("keeps the claim reachable after a cancellation", () => {
    const { props } = renderWin({ justCancelled: true });
    fireEvent.click(screen.getByRole("button", { name: "primaryLabel · $0.50" }));
    expect(props.onClaimVictory).toHaveBeenCalledTimes(1);
  });

  it("self-dismisses the toast after 3200ms", () => {
    vi.useFakeTimers();
    try {
      renderWin({ justCancelled: true });
      expect(screen.getByText("cancelledToast")).toBeInTheDocument();
      act(() => void vi.advanceTimersByTime(3200));
      expect(screen.queryByText("cancelledToast")).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("renders no toast when nothing was cancelled", () => {
    renderWin();
    expect(screen.queryByText("cancelledToast")).not.toBeInTheDocument();
  });
});
