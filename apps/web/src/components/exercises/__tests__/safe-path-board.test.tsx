import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";

import { SafePathBoard } from "@/components/exercises/safe-path-board";
import messages from "@/lib/content/messages/en";
import type { Exercise } from "@/lib/game/types";

/** Stage 5. The board's job is the founder's model: a danger maze, not a wall
 *  maze. The two tests that matter are that a watched square is TAPPABLE and
 *  that tapping it loses — the opposite of <QueensBoard>, where an illegal tap
 *  is refused and costs nothing. */

/** King a1, refuge c3, black knight d3 watching b2 — the diagonal shortcut.
 *  So the safe route is a1 -> b1 -> c2 -> c3 (3), and b2 is a legal trap. */
const LEVEL: Exercise = {
  id: "sp-test",
  startPos: { file: 0, rank: 0 },
  targetPos: { file: 2, rank: 2 },
  optimalMoves: 3,
  enemies: [{ pos: { file: 3, rank: 2 }, piece: "knight" }],
};

const renderBoard = (props: Partial<Parameters<typeof SafePathBoard>[0]> = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SafePathBoard level={LEVEL} {...props} />
    </NextIntlClientProvider>,
  );

const tap = async (sq: string) => {
  const cell = document.querySelector(`[data-square="${sq}"]`);
  if (!cell) throw new Error(`no cell for ${sq}`);
  await userEvent.click(cell as HTMLElement);
};

/** The king deselects after every move (board.tsx:231), so every step is
 *  pick-up-then-place. Spelling that out in each test would bury what the test
 *  is actually about. */
const step = async (from: string, to: string) => {
  await tap(from);
  await tap(to);
};

describe("SafePathBoard — the danger maze", () => {
  it("draws the enemy as its real piece, not as a generic blocker", () => {
    // The FEN carries the type and the art can finally tell the truth (stage 1).
    renderBoard();

    expect(screen.getByTestId("sp-enemy-d3")).toHaveAttribute(
      "data-piece",
      "knight",
    );
  });

  it("does NOT draw the watched squares — reading them is the game (D2)", () => {
    renderBoard();

    expect(screen.queryByTestId("sp-watched-b2")).toBeNull();
  });

  it("draws them when authoring asks (D3)", () => {
    renderBoard({ showWatched: true });

    expect(screen.getByTestId("sp-watched-b2")).toBeInTheDocument();
  });

  it("lets the king walk INTO a watched square, and catches him there", async () => {
    // The heart of it. A wall maze would refuse this tap; the danger maze takes
    // it and ends the run — "puedes pasar físicamente por ahí, pero no debes".
    const onCaught = vi.fn();
    renderBoard({ onCaught });

    await step("a1", "b2");

    expect(onCaught).toHaveBeenCalledWith("b2");
    expect(screen.getByTestId("sp-caught-b2")).toBeInTheDocument();
    expect(screen.getByTestId("sp-king-b2")).toBeInTheDocument();
  });

  it("names the enemy that saw him — a red flash teaches nothing", async () => {
    renderBoard();

    await step("a1", "b2");

    expect(screen.getByTestId("sp-killer-d3")).toBeInTheDocument();
  });

  it("fires the shot FROM the enemy that saw him, along the real line", async () => {
    // The beam is the lesson drawn: it has to leave the piece that took the
    // shot, or it is decoration.
    //
    // ⚠️ SCREEN space, not board space: b2 sits BELOW d3 on the screen, so dy
    // is POSITIVE even though the rank went down. d3(43.75, 68.75) ->
    // b2(18.75, 81.25) is dx=-25 dy=+12.5 => 153.43deg, length 27.95%.
    renderBoard();

    await step("a1", "b2");

    const beam = screen.getByTestId("sp-beam-d3");
    expect(beam).toBeInTheDocument();
    // Anchored on the knight's own centre (d3 => file 3, rank 2).
    expect(beam).toHaveStyle({ left: "43.75%", top: "68.75%" });
    expect(beam.getAttribute("style")).toContain("rotate(153.4");
    expect(beam.getAttribute("style")).toContain("width: 27.9");
  });

  it("draws no shot while nothing has been caught", () => {
    renderBoard();

    expect(document.querySelectorAll('[data-testid^="sp-beam-"]')).toHaveLength(0);
  });

  it("stops taking moves once he is caught", async () => {
    const onComplete = vi.fn();
    renderBoard({ onComplete });

    await step("a1", "b2"); // caught
    await step("b2", "c3"); // the refuge is adjacent, but the run is over

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("sends him back to the START on reset, not to where he died (D5)", async () => {
    const { rerender } = renderBoard();

    await step("a1", "b2");
    expect(screen.getByTestId("sp-king-b2")).toBeInTheDocument();

    rerender(
      <NextIntlClientProvider locale="en" messages={messages}>
        <SafePathBoard level={LEVEL} resetKey={1} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByTestId("sp-king-a1")).toBeInTheDocument();
    expect(screen.queryByTestId("sp-caught-b2")).toBeNull();
  });

  it("completes on the refuge and reports the moves it took", async () => {
    const onComplete = vi.fn();
    renderBoard({ onComplete });

    await step("a1", "b1");
    await step("b1", "c2");
    await step("c2", "c3");

    expect(onComplete).toHaveBeenCalledWith(3, 3);
  });

  it("cannot step onto the enemy — the king never captures (D1)", async () => {
    renderBoard();

    await step("a1", "b1");
    await step("b1", "c2");
    await step("c2", "d2"); // adjacent to the knight
    await step("d2", "d3"); // try to take it

    expect(screen.queryByTestId("sp-king-d3")).toBeNull();
  });
});

describe("SafePathBoard — the select gate", () => {
  it("starts with the king NOT picked up (founder, 2026-07-16)", () => {
    renderBoard();

    expect(screen.getByTestId("sp-king-a1")).toHaveAttribute(
      "data-selected",
      "false",
    );
  });

  it("shows no destinations until he is picked up — they are the answer", () => {
    renderBoard();

    expect(document.querySelectorAll(".playhub-board-cell.is-highlighted"))
      .toHaveLength(0);
  });

  it("picks him up on a tap, and zooms him", async () => {
    renderBoard();

    await tap("a1");

    expect(screen.getByTestId("sp-king-a1")).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(screen.getByTestId("sp-king-a1").className).toContain("is-selected");
    expect(
      document.querySelectorAll(".playhub-board-cell.is-highlighted").length,
    ).toBeGreaterThan(0);
  });

  it("says 'tap your piece first' instead of doing nothing", async () => {
    // A silent board is what made first-timers tap the goal over and over and
    // give up — the field report behind board.tsx's own hint.
    renderBoard();

    await tap("b1");

    expect(screen.getByTestId("sp-select-hint")).toBeInTheDocument();
    expect(screen.getByTestId("sp-king-a1")).toBeInTheDocument();
  });

  it("drops the hint once he finds the piece", async () => {
    renderBoard();

    await tap("b1");
    expect(screen.getByTestId("sp-select-hint")).toBeInTheDocument();

    await tap("a1");
    expect(screen.queryByTestId("sp-select-hint")).toBeNull();
  });

  it("does not move on a bare destination tap — the gate is the rule", async () => {
    const onCaught = vi.fn();
    renderBoard({ onCaught });

    await tap("b2"); // watched, but he was never picked up

    expect(onCaught).not.toHaveBeenCalled();
    expect(screen.getByTestId("sp-king-a1")).toBeInTheDocument();
  });

  it("puts him down again after every move", async () => {
    renderBoard();

    await step("a1", "b1");

    expect(screen.getByTestId("sp-king-b1")).toHaveAttribute(
      "data-selected",
      "false",
    );
  });

  it("ignores a re-tap on an already-picked-up king", async () => {
    // A fat-finger re-tap must never silently drop the selection.
    renderBoard();

    await tap("a1");
    await tap("a1");

    expect(screen.getByTestId("sp-king-a1")).toHaveAttribute(
      "data-selected",
      "true",
    );
  });
});
