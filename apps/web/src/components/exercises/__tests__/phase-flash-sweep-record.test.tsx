/**
 * The record block and replay CTA, asserted in the DOM.
 *
 * ⛔ These can NEVER be covered by the VR. `hub-clean` runs at
 * `maxDiffPixelRatio: 0.005` — ~1.646 px on 390×844 — and a chip this size is
 * ~450 px. A green photo proves nothing about whether any of this rendered, so
 * every element here is anchored by an assertion instead.
 */
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PhaseFlash } from "@/components/exercises/mission-panel-candy";
import { toSweepResultPresentation } from "@/lib/game/sweep-result-cta";
import type { BoardPosition, Exercise } from "@/lib/game/types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const at = (file: number, rank: number): BoardPosition => ({ file, rank });

const sweep = (optimalMoves: number): Exercise => ({
  id: "rook-2",
  startPos: at(4, 1),
  targetPos: at(4, 7),
  optimalMoves,
  targets: [at(4, 7), at(1, 7), at(1, 3)],
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

/** The flash holds its banner back by a ~600ms entry beat so the player sees the
 *  piece land before the celebration covers it. `awaitTap` is what the host arms
 *  on every success path, and it also stops the auto-dismiss from racing the
 *  assertions. */
const revealFlash = () => act(() => void vi.advanceTimersByTime(1000));

const renderFlash = (
  args: { runMoves: number; previousBest: number | undefined; optimal: number },
  onSweepReplay = vi.fn(),
  onSweepCtaShown = vi.fn(),
) => {
  const sweepResult = toSweepResultPresentation({
    exercise: sweep(args.optimal),
    runMoves: args.runMoves,
    previousBest: args.previousBest,
  });
  render(
    <PhaseFlash
      phase="success"
      awaitTap
      sweepResult={sweepResult}
      onSweepReplay={onSweepReplay}
      onSweepCtaShown={onSweepCtaShown}
    />,
  );
  revealFlash();
  return { onSweepReplay, onSweepCtaShown, sweepResult };
};

describe("the two anchored cases, rendered", () => {
  it("a worse run shows the OLD record and its gap (10 played, 9 best, 7 perfect)", () => {
    renderFlash({ runMoves: 10, previousBest: 9, optimal: 7 });

    expect(screen.getByTestId("sweep-best")).toHaveTextContent("9");
    expect(screen.getByTestId("sweep-perfect")).toHaveTextContent("7");
    const cta = screen.getByTestId("sweep-replay-cta");
    // ⛔ 2, never 3: measured from the record, not from the run just played.
    expect(cta).toHaveAttribute("data-gap", "2");
    expect(cta).toHaveTextContent("2 to go");
    expect(cta.textContent).not.toContain("3");
  });

  it("a perfect run takes the record and offers NO replay", () => {
    renderFlash({ runMoves: 7, previousBest: 9, optimal: 7 });

    // The best number survives — it is what the player owns — and the right-hand
    // term switches from the goal to the achievement, so the pill never says
    // "PERFECT RUN · PERFECT 7".
    expect(screen.getByTestId("sweep-best")).toHaveTextContent("7");
    expect(screen.getByTestId("sweep-perfect-run")).toBeInTheDocument();
    expect(screen.queryByTestId("sweep-perfect")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sweep-replay-cta")).not.toBeInTheDocument();
  });
});

describe("the CTA is a real control", () => {
  it("calls back when tapped", () => {
    const { onSweepReplay } = renderFlash({
      runMoves: 10,
      previousBest: 9,
      optimal: 7,
    });
    fireEvent.click(screen.getByTestId("sweep-replay-cta"));
    expect(onSweepReplay).toHaveBeenCalledTimes(1);
  });

  it("does NOT also advance to the next exercise", () => {
    // The scrim carries `onClick={handleTapContinue}` whenever `awaitTap` is
    // armed — which is every success path — and the CTA sits inside it. Without
    // stopPropagation the tap replays the board AND advances, so the player asks
    // to beat their record and gets moved somewhere else.
    // ⚠️ Asserting only that `onSweepReplay` fired passes with the bug present:
    // it takes asserting the thing that must NOT happen.
    const onContinue = vi.fn();
    const onSweepReplay = vi.fn();
    const sweepResult = toSweepResultPresentation({
      exercise: sweep(7),
      runMoves: 10,
      previousBest: 9,
    });
    render(
      <PhaseFlash
        phase="success"
        awaitTap
        onContinue={onContinue}
        sweepResult={sweepResult}
        onSweepReplay={onSweepReplay}
      />,
    );
    revealFlash();

    fireEvent.click(screen.getByTestId("sweep-replay-cta"));
    act(() => void vi.advanceTimersByTime(600)); // past the fade that calls onContinue

    expect(onSweepReplay).toHaveBeenCalledTimes(1);
    expect(onContinue).not.toHaveBeenCalled();
  });

  it("still advances when the player taps the scrim itself", () => {
    // The guard must be scoped to the button: tap-to-continue is the normal way
    // out of the flash and stopping it everywhere would trap the player.
    const onContinue = vi.fn();
    const sweepResult = toSweepResultPresentation({
      exercise: sweep(7),
      runMoves: 10,
      previousBest: 9,
    });
    render(
      <PhaseFlash
        phase="success"
        awaitTap
        onContinue={onContinue}
        sweepResult={sweepResult}
        onSweepReplay={vi.fn()}
      />,
    );
    // Tap-to-continue is armed a beat AFTER the reveal, on purpose, so an eager
    // tap cannot skip the celebration. Wait past both beats before tapping.
    revealFlash();
    act(() => void vi.advanceTimersByTime(3000));

    fireEvent.click(screen.getByTestId("sweep-record").parentElement!);
    act(() => void vi.advanceTimersByTime(600));

    expect(onContinue).toHaveBeenCalledTimes(1);
  });

  it("reports 'shown' exactly once per success", () => {
    // A render-time report would fire on every re-render of the same flash and
    // inflate the denominator of the conversion rate the experiment reads.
    const { onSweepCtaShown } = renderFlash({
      runMoves: 10,
      previousBest: 9,
      optimal: 7,
    });
    expect(onSweepCtaShown).toHaveBeenCalledTimes(1);
    expect(onSweepCtaShown).toHaveBeenCalledWith(
      expect.objectContaining({ bestMoves: 9, optimalMoves: 7, gapToPerfect: 2 }),
    );
  });
});

describe("boards outside the experiment", () => {
  it("render no record block at all", () => {
    render(<PhaseFlash phase="success" awaitTap />);
    revealFlash();
    // The flash itself is up — this is not a vacuous pass.
    expect(screen.queryByTestId("sweep-record")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain("YOUR BEST");
  });

  it("render nothing during failure", () => {
    const sweepResult = toSweepResultPresentation({
      exercise: sweep(7),
      runMoves: 10,
      previousBest: 9,
    });
    render(<PhaseFlash phase="failure" awaitTap sweepResult={sweepResult} />);
    revealFlash();
    expect(screen.queryByTestId("sweep-record")).not.toBeInTheDocument();
  });
});
