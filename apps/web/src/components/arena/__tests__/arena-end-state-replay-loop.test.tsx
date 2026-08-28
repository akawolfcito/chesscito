/**
 * Post-game momentum loop — end-state CTA contract (2026-08-28).
 *
 * These tests pin the SEMANTICS the audit asked for, not the pixels:
 *
 *  - PLAY AGAIN is present on every end-state (win / loss / draw / resign)
 *    and carries the green gameplay class, never the cream secondary one.
 *  - "Change difficulty" is the only path back to the DUEL selector, and it
 *    is a distinct handler from PLAY AGAIN. Conflating them is the exact
 *    regression this change exists to prevent: before it, PLAY AGAIN went
 *    to the selector and 36–48% of taps never reached a board
 *    (docs/audits/2026-08-28-core-loop-diagnostic.md §C.5).
 *  - `play_again_tap` fires on EVERY outcome including the win, which
 *    previously had no telemetry on this button at all.
 */

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const trackMock = vi.fn();
vi.mock("@/lib/telemetry", () => ({
  track: (...args: unknown[]) => trackMock(...args),
}));

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

type EndStateProps = React.ComponentProps<typeof ArenaEndState>;

function renderEndState(overrides: Partial<EndStateProps> = {}) {
  const onPlayAgain = vi.fn();
  const onChangeDifficulty = vi.fn();
  const props: EndStateProps = {
    status: "resigned",
    isPlayerWin: false,
    onPlayAgain,
    onChangeDifficulty,
    previousGameId: "550e8400-e29b-41d4-a716-446655440000",
    onBackToHub: vi.fn(),
    claimPhase: "ready" as ClaimPhase,
    shareStatus: "locked",
    claimData: baseClaimData,
    moves: 18,
    elapsedMs: 90000,
    difficulty: "easy",
    onClaimVictory: vi.fn(),
    onAskCoach: vi.fn(),
    gameRecordPersisted: true,
    claimPrice: "$0.50",
    ...overrides,
  };
  const view = render(<ArenaEndState {...props} />);
  return { onPlayAgain, onChangeDifficulty, props, ...view };
}

/** The win branch renders VictoryCelebration, the rest the loss popup. */
const OUTCOMES: Array<{ label: string; overrides: Partial<EndStateProps>; context: string }> = [
  { label: "win", overrides: { status: "checkmate", isPlayerWin: true }, context: "endgame_win" },
  { label: "loss", overrides: { status: "checkmate", isPlayerWin: false }, context: "endgame_loss" },
  { label: "draw", overrides: { status: "draw", isPlayerWin: false }, context: "endgame_draw" },
  { label: "stalemate", overrides: { status: "stalemate", isPlayerWin: false }, context: "endgame_draw" },
  { label: "resign", overrides: { status: "resigned", isPlayerWin: false }, context: "endgame_resign" },
];

beforeEach(() => trackMock.mockClear());

describe("end-state replay CTA", () => {
  it.each(OUTCOMES)(
    "$label — PLAY AGAIN is the green gameplay CTA, not a cream secondary",
    ({ overrides }) => {
      renderEndState(overrides);
      const label = screen.getByText(
        overrides.isPlayerWin ? "playAgainShort" : "playAgain",
      );
      const button = label.closest("button");
      expect(button).not.toBeNull();
      expect(button).toHaveClass("arena-result-primary-cta--play");
      expect(button).not.toHaveClass("arena-result-secondary-action");
    },
  );

  it.each(OUTCOMES)("$label — tapping it calls onPlayAgain exactly once", ({ overrides }) => {
    const { onPlayAgain, onChangeDifficulty } = renderEndState(overrides);
    fireEvent.click(
      screen.getByText(overrides.isPlayerWin ? "playAgainShort" : "playAgain"),
    );
    expect(onPlayAgain).toHaveBeenCalledTimes(1);
    // The replay must NEVER route through the selector.
    expect(onChangeDifficulty).not.toHaveBeenCalled();
  });

  it.each(OUTCOMES)(
    "$label — fires play_again_tap with context $context and no double-log",
    ({ overrides, context }) => {
      renderEndState(overrides);
      fireEvent.click(
        screen.getByText(overrides.isPlayerWin ? "playAgainShort" : "playAgain"),
      );
      const calls = trackMock.mock.calls.filter(
        ([event]) => event === "monetization.play_again_tap",
      );
      expect(calls).toHaveLength(1);
      expect(calls[0][1]).toMatchObject({ context, difficulty: "easy" });
    },
  );

  it("forwards previous_game_id so a replay chain can be reconstructed", () => {
    renderEndState({ status: "resigned", isPlayerWin: false });
    fireEvent.click(screen.getByText("playAgain"));
    const call = trackMock.mock.calls.find(
      ([event]) => event === "monetization.play_again_tap",
    );
    expect(call?.[1]).toMatchObject({
      previous_game_id: "550e8400-e29b-41d4-a716-446655440000",
    });
  });
});

describe("end-state — change difficulty is the ONLY route to the selector", () => {
  it.each(OUTCOMES)("$label — renders the secondary reconfigure action", ({ overrides }) => {
    renderEndState(overrides);
    expect(screen.getByText("changeDifficulty")).toBeInTheDocument();
  });

  it("calls onChangeDifficulty, never onPlayAgain", () => {
    const { onPlayAgain, onChangeDifficulty } = renderEndState();
    fireEvent.click(screen.getByText("changeDifficulty"));
    expect(onChangeDifficulty).toHaveBeenCalledTimes(1);
    expect(onPlayAgain).not.toHaveBeenCalled();
  });

  it("is omitted entirely when the caller does not wire it (legacy callers)", () => {
    renderEndState({ onChangeDifficulty: undefined });
    expect(screen.queryByText("changeDifficulty")).not.toBeInTheDocument();
    // The primary must survive on its own.
    expect(screen.getByText("playAgain")).toBeInTheDocument();
  });
});

describe("end-state — Coach stays visible and is NOT the primary", () => {
  it.each(OUTCOMES)("$label — the Coach CTA is still rendered", ({ overrides }) => {
    renderEndState(overrides);
    // The purple Coach CTA must not be dropped by the reorder — Coach
    // carries the strongest D0 retention signal of any mechanic (2,25x).
    const playCtas = document.querySelectorAll(".arena-result-primary-cta--play");
    expect(playCtas).toHaveLength(1);
    expect(document.querySelector(".arena-result-coach-section")).not.toBeNull();
  });
});
