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

    await tap("b2");

    expect(onCaught).toHaveBeenCalledWith("b2");
    expect(screen.getByTestId("sp-caught-b2")).toBeInTheDocument();
    expect(screen.getByTestId("sp-king-b2")).toBeInTheDocument();
  });

  it("names the enemy that saw him — a red flash teaches nothing", async () => {
    renderBoard();

    await tap("b2");

    expect(screen.getByTestId("sp-killer-d3")).toBeInTheDocument();
  });

  it("stops taking moves once he is caught", async () => {
    const onComplete = vi.fn();
    renderBoard({ onComplete });

    await tap("b2"); // caught
    await tap("c3"); // the refuge is adjacent, but the run is over

    expect(onComplete).not.toHaveBeenCalled();
  });

  it("sends him back to the START on reset, not to where he died (D5)", async () => {
    const { rerender } = renderBoard();

    await tap("b2");
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

    await tap("b1");
    await tap("c2");
    await tap("c3");

    expect(onComplete).toHaveBeenCalledWith(3, 3);
  });

  it("ignores a tap that is not a king step", async () => {
    const onCaught = vi.fn();
    const onComplete = vi.fn();
    renderBoard({ onCaught, onComplete });

    await tap("h8");

    expect(onCaught).not.toHaveBeenCalled();
    expect(screen.getByTestId("sp-king-a1")).toBeInTheDocument();
  });

  it("cannot step onto the enemy — the king never captures (D1)", async () => {
    renderBoard();

    // Walk him next to the knight, then try to take it.
    await tap("b1");
    await tap("c2");
    await tap("d2"); // adjacent to d3
    await tap("d3"); // the knight

    expect(screen.queryByTestId("sp-king-d3")).toBeNull();
  });
});
