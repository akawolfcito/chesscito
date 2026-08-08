import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";

vi.mock("@/lib/telemetry", () => ({
  track: vi.fn(),
}));

// `result-overlay.tsx` imports LottieAnimation at module-load, which
// pulls lottie-web → triggers a JSDOM canvas/fillStyle crash. The
// piece-complete prompt itself never renders a Lottie, so a no-op mock
// is safe here and keeps the test surface tiny.
vi.mock("@/components/ui/lottie-animation", () => ({
  LottieAnimation: () => null,
}));

// ShareModal mounts heavy share/og dependencies on import; PieceComplete
// does not render it, but the result-overlay module still pulls it.
vi.mock("@/components/share/share-modal", () => ({
  ShareModal: () => null,
}));

import { PieceCompletePrompt } from "../result-overlay";
import { renderWithIntl as render, screen } from "@/test-utils/render-with-intl";

const baseProps = {
  pieceType: "king" as const,
  nextPiece: null,
  hasClaimedBadge: true,
  totalStars: 12,
  maxPossibleStars: 30,
  onNextPiece: vi.fn(),
  onArena: vi.fn(),
  onPracticeAgain: vi.fn(),
};

/* ⚠️ Every CTA and the X go through `handleAction`, which plays a 250ms exit
 * animation BEFORE running the callback. A test that clicks and asserts
 * immediately reads the state before the handler ever fired — so a bare
 * `expect(fn).not.toHaveBeenCalled()` passes on any implementation, including
 * one that calls it. Drain the animation, then assert both directions. */
function drainExitAnimation() {
  act(() => {
    vi.advanceTimersByTime(300);
  });
}

describe("PieceCompletePrompt — CTA hierarchy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("primary = Try Labyrinth even when nextPiece exists (Slice 3E sequence fix)", () => {
    // The blocker this fixes: players finished the exercises, tapped the
    // big "Start {next}" button and NEVER saw the labyrinths. A pending
    // labyrinth IS the natural continuation of the piece — it outranks
    // the next piece.
    const onTryLabyrinth = vi.fn();
    render(
      <PieceCompletePrompt
        {...baseProps}
        pieceType="rook"
        nextPiece="bishop"
        onTryLabyrinth={onTryLabyrinth}
      />,
    );
    expect(
      screen.getAllByRole("button", { name: "Try Labyrinth" }).length,
    ).toBeGreaterThanOrEqual(1);
    // Next piece survives as a secondary text-link, never disappears.
    expect(
      screen.getByRole("button", { name: "Start Bishop" }),
    ).toBeInTheDocument();
  });

  it("dismiss with a pending labyrinth stays on the piece (no silent piece jump)", () => {
    const onTryLabyrinth = vi.fn();
    const onNextPiece = vi.fn();
    const onPracticeAgain = vi.fn();
    render(
      <PieceCompletePrompt
        {...baseProps}
        pieceType="rook"
        nextPiece="bishop"
        onNextPiece={onNextPiece}
        onPracticeAgain={onPracticeAgain}
        onTryLabyrinth={onTryLabyrinth}
      />,
    );
    // The shell's close affordance carries the closeLabel aria-label
    // ("Practice Again" for this prompt).
    screen.getByRole("button", { name: /Practice Again/i }).click();
    drainExitAnimation();
    expect(onPracticeAgain).toHaveBeenCalledTimes(1);
    expect(onNextPiece).not.toHaveBeenCalled();
  });

  /* ⛔ Founder decision 2026-08-08. Without a pending labyrinth the X used to
   * call `onNextPiece` — closing the bishop's panel deposited you on the
   * knight, abandoning a badge the same panel had just called ready to claim.
   *
   * The old rationale ("avoids the stuck on the last level") no longer holds:
   * the persistent dock, the exercise drawer and the contextual claimBadge pin
   * are all on screen behind this panel, so closing strands nobody — it leaves
   * the player on the one screen that carries the Claim. And the X already
   * announces itself as "Practice Again" (`closeLabel`), so the jump also
   * contradicted its own accessible name. */
  it("dismiss WITHOUT a pending labyrinth also stays on the piece", () => {
    const onNextPiece = vi.fn();
    const onPracticeAgain = vi.fn();
    render(
      <PieceCompletePrompt
        {...baseProps}
        pieceType="bishop"
        nextPiece="knight"
        hasClaimedBadge={false}
        hasEarnedBadge
        onNextPiece={onNextPiece}
        onPracticeAgain={onPracticeAgain}
      />,
    );
    screen.getByRole("button", { name: /Practice Again/i }).click();
    drainExitAnimation();
    expect(onPracticeAgain).toHaveBeenCalledTimes(1);
    expect(onNextPiece).not.toHaveBeenCalled();
  });

  it("dismiss on the final piece stays too (no next piece to jump to)", () => {
    const onNextPiece = vi.fn();
    const onPracticeAgain = vi.fn();
    render(
      <PieceCompletePrompt
        {...baseProps}
        onNextPiece={onNextPiece}
        onPracticeAgain={onPracticeAgain}
        onChoosePiece={vi.fn()}
      />,
    );
    screen.getByRole("button", { name: /Practice Again/i }).click();
    drainExitAnimation();
    expect(onPracticeAgain).toHaveBeenCalledTimes(1);
    expect(onNextPiece).not.toHaveBeenCalled();
  });

  it("primary = Start {nextPiece} when nextPiece exists", () => {
    render(
      <PieceCompletePrompt
        {...baseProps}
        pieceType="queen"
        nextPiece="king"
      />,
    );
    // Two matches are expected: the primary CTA button and the
    // CandyGlassShell close affordance whose aria-label mirrors the
    // primary action (existing UX pattern, not introduced by Phase B.1).
    expect(
      screen.getAllByRole("button", { name: "Start King" }).length,
    ).toBeGreaterThanOrEqual(1);
    // ARENA must NOT be the primary in this branch.
    expect(
      screen.queryByRole("button", { name: "ARENA" }),
    ).not.toBeInTheDocument();
    // Secondary "Try Arena" text-link is suppressed when nextPiece exists
    // (the Coach hint covers the Arena bridge instead — see comment in
    // result-overlay.tsx).
    expect(
      screen.queryByRole("button", { name: "Try Arena" }),
    ).not.toBeInTheDocument();
  });

  it("primary = Try Labyrinth when no nextPiece and onTryLabyrinth defined", () => {
    const onTryLabyrinth = vi.fn();
    render(
      <PieceCompletePrompt {...baseProps} onTryLabyrinth={onTryLabyrinth} />,
    );
    expect(
      screen.getByRole("button", { name: "Try Labyrinth" }),
    ).toBeInTheDocument();
    // ARENA uppercase primary must not surface in this branch.
    expect(
      screen.queryByRole("button", { name: "ARENA" }),
    ).not.toBeInTheDocument();
  });

  it("primary = Choose another piece when no nextPiece + no labyrinth + onChoosePiece defined", () => {
    const onChoosePiece = vi.fn();
    render(
      <PieceCompletePrompt {...baseProps} onChoosePiece={onChoosePiece} />,
    );
    expect(
      screen.getByRole("button", { name: "Choose another piece" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "ARENA" }),
    ).not.toBeInTheDocument();
  });

  it("renders Arena as secondary text-link when primary != Arena and nextPiece is null", () => {
    const onChoosePiece = vi.fn();
    render(
      <PieceCompletePrompt {...baseProps} onChoosePiece={onChoosePiece} />,
    );
    expect(
      screen.getByRole("button", { name: "Try Arena" }),
    ).toBeInTheDocument();
  });

  it("falls back to Arena primary when nextPiece null + no labyrinth + no onChoosePiece", () => {
    render(<PieceCompletePrompt {...baseProps} />);
    expect(
      screen.getByRole("button", { name: "ARENA" }),
    ).toBeInTheDocument();
    // In the fallback branch the primary IS Arena, so there must not be
    // a duplicate "Try Arena" text-link below it.
    expect(
      screen.queryByRole("button", { name: "Try Arena" }),
    ).not.toBeInTheDocument();
  });
});

describe("PieceCompletePrompt — the subtitle must not contradict the badge modal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* Playtest 2026-08-08: the player cleared the gate, the milestone modal said
   * "Badge Ready to Claim", they dismissed it, and THIS prompt said "Keep
   * pushing. More stars unlock your badge!" seconds later. Two surfaces, one
   * moment, opposite claims — and the second one is false twice over, because
   * stars have never been what unlocks the badge (the gate is 80% COMPLETION;
   * `BADGE_THRESHOLD` was removed). The bug is the branch: it forked on
   * CLAIMED, so "earned but unclaimed" fell into the not-yet bucket. */

  it("tells a player who EARNED the badge that it is waiting, not to keep pushing", () => {
    render(
      <PieceCompletePrompt
        {...baseProps}
        hasClaimedBadge={false}
        hasEarnedBadge
      />,
    );

    expect(screen.getByText(/badge is ready/i)).toBeInTheDocument();
    expect(screen.queryByText(/keep pushing/i)).not.toBeInTheDocument();
  });

  it("never tells anyone that STARS unlock the badge", () => {
    // The genuine not-yet-earned case still gets an encouragement — it just
    // has to name the real gate, which is exercises completed.
    render(
      <PieceCompletePrompt
        {...baseProps}
        hasClaimedBadge={false}
        hasEarnedBadge={false}
      />,
    );

    // The invariant is the NEGATIVE one: whatever the encouragement says, it
    // must not teach a gate the game does not have. Pinning the sentence
    // itself would make this test a second place to edit copy.
    expect(screen.queryByText(/stars unlock/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/more stars/i)).not.toBeInTheDocument();
    // …and it must not claim a badge that has not been earned.
    expect(screen.queryByText(/badge is ready/i)).not.toBeInTheDocument();
  });
});
