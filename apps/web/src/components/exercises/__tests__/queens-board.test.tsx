import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/lib/content/messages/en";
import { QueensBoard } from "@/components/exercises/queens-board";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const P = (sq: string): BoardPosition => ({
  file: "abcdefgh".indexOf(sq[0]),
  rank: Number(sq[1]) - 1,
});

/**
 * PINCH: every square is blocked except the a-file and h8. The queen on a1
 * holds the whole open a-file, and every ray toward h8 is walled, so h8 is the
 * ONE safe square. Place it and the board is sealed: a 2-queen ceiling that
 * ends in a single tap.
 */
const openSquares = new Set(["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "h8"]);
const PINCH_BLOCKS: BoardPosition[] = [];
for (const f of "abcdefgh") {
  for (let r = 1; r <= 8; r += 1) {
    if (!openSquares.has(`${f}${r}`)) PINCH_BLOCKS.push(P(`${f}${r}`));
  }
}

const level = (over: Partial<Exercise> = {}): Exercise => ({
  id: "queens-test",
  optimalMoves: 1,
  startPos: P("a1"),
  targetPos: P("a1"),
  obstacles: PINCH_BLOCKS,
  ...over,
});

function renderBoard(props: Partial<Parameters<typeof QueensBoard>[0]> = {}) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={enMessages as Record<string, unknown>}
      onError={() => {}}
    >
      <QueensBoard level={level()} {...props} />
    </NextIntlClientProvider>,
  );
}

/** Cells are the board's own gridcells — named "Square h8" by <GameBoard>. */
const tap = (sq: string) => screen.getByRole("gridcell", { name: `Square ${sq}` });

describe("QueensBoard — the entry ritual", () => {
  it("starts with the level's own queen on the board", () => {
    renderBoard();
    expect(screen.getByTestId("q-queen-a1")).toBeInTheDocument();
  });

  it("refuses to place until the player has tapped the queen", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(tap("h8"));
    expect(screen.queryByTestId("q-queen-h8")).not.toBeInTheDocument();
    expect(screen.getByTestId("q-piece-hint")).toBeInTheDocument();
  });

  it("never gives the safe squares away to a player", async () => {
    // The board must NOT mark them: "which squares are safe" is the puzzle, not
    // a hint. Light them up and the player taps the dot instead of thinking
    // (founder, 2026-07-16).
    const user = userEvent.setup();
    renderBoard();
    await user.click(tap("a1"));
    expect(screen.queryByTestId("q-spark-h8")).not.toBeInTheDocument();
  });

  it("lights them for authoring, where seeing the safe set IS the point", async () => {
    const user = userEvent.setup();
    renderBoard({ showSafeSquares: true });
    await user.click(tap("a1"));
    expect(screen.getByTestId("q-spark-h8")).toBeInTheDocument();
    // The whole a-file is under the queen's fire — not one of them is safe.
    expect(screen.queryByTestId("q-spark-a5")).not.toBeInTheDocument();
  });
});

describe("QueensBoard — placing", () => {
  it("places a queen on a safe square", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(tap("a1"));
    await user.click(tap("h8"));
    expect(screen.getByTestId("q-queen-h8")).toBeInTheDocument();
  });

  it("rejects an attacked square without placing and without penalty", async () => {
    const user = userEvent.setup();
    renderBoard();
    await user.click(tap("a1"));
    await user.click(tap("a5")); // under fire from a1 down the open file
    expect(screen.queryByTestId("q-queen-a5")).not.toBeInTheDocument();
    // The rejection must TEACH, not just buzz: the board rings the square AND
    // the queen watching it. With no sparks to lean on, this IS the feedback
    // loop the spec's "no penalty, retry freely" is built around.
    expect(screen.getByTestId("q-attack-a5")).toBeInTheDocument();
    expect(screen.getByTestId("q-attacker-a1")).toBeInTheDocument();
    // No penalty: the position is untouched and h8 is still placeable.
    await user.click(tap("h8"));
    expect(screen.getByTestId("q-queen-h8")).toBeInTheDocument();
  });
});

describe("QueensBoard — the run ends", () => {
  it("reports coverage against the ceiling when no safe square is left", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderBoard({ onComplete });
    await user.click(tap("a1"));
    await user.click(tap("h8"));
    // 2 queens on the board, against an exact ceiling of 2 — a full clear.
    expect(onComplete).toHaveBeenCalledWith(2, 2);
  });

  it("reports the ceiling only once, however many taps land after", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    renderBoard({ onComplete });
    await user.click(tap("a1"));
    await user.click(tap("h8"));
    await user.click(tap("a5"));
    await user.click(tap("a1"));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
