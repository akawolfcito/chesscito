import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";

import { renderWithIntl } from "@/test-utils/render-with-intl";
import { ArenaBoard } from "../arena-board";
import type { ChessBoardPiece } from "@/lib/game/types";

const PIECES: ChessBoardPiece[] = [
  { id: "wk", square: "e1", color: "w", type: "king" },
  { id: "wr", square: "a1", color: "w", type: "rook" },
  { id: "bk", square: "e8", color: "b", type: "king" },
];

const BASE = {
  pieces: PIECES,
  selectedSquare: null,
  legalMoves: [] as string[],
  lastMove: null,
  checkSquare: null,
  isLocked: false,
  onSquareClick: () => {},
};

const FRAME_SRC = "/art/board/borde-tablero";

describe("<ArenaBoard> procedural board substrate", () => {
  it("renders the GameBoard substrate (candy frame, no background image)", () => {
    const { container } = renderWithIntl(<ArenaBoard {...BASE} />);
    expect(container.querySelector(`img[src*="${FRAME_SRC}"]`)).toBeInTheDocument();
    expect(container.querySelector(".playhub-board-img")).toBeNull();
    expect(
      screen.getAllByRole("gridcell", { name: /^Square [a-h][1-8]$/ }),
    ).toHaveLength(64);
  });

  it("renders all pieces on the board", () => {
    const { container } = renderWithIntl(<ArenaBoard {...BASE} />);
    expect(container.querySelectorAll(".arena-piece-float")).toHaveLength(PIECES.length);
  });

  it("flips the board for black (GameBoard orientation): top-left cell is h1", () => {
    renderWithIntl(<ArenaBoard {...BASE} playerColor="b" />);
    expect(screen.getAllByRole("gridcell")[0]).toHaveAttribute("aria-label", "Square h1");
  });

  it("clicks pass the LOGICAL square label regardless of orientation", () => {
    const onSquareClick = vi.fn();
    renderWithIntl(
      <ArenaBoard {...BASE} playerColor="b" onSquareClick={onSquareClick} />,
    );
    // Visual top-left under black is logical h1.
    screen.getAllByRole("gridcell")[0].click();
    expect(onSquareClick).toHaveBeenCalledWith("h1");
  });

  it("marks a highlighted empty square with a dot, and a highlighted occupied square as capturable", () => {
    const { container } = renderWithIntl(
      <ArenaBoard
        {...BASE}
        selectedSquare="a1"
        legalMoves={["a4", "e8"]} // a4 empty, e8 has the black king
      />,
    );
    expect(container.querySelector(".playhub-board-dot")).toBeInTheDocument();
    expect(container.querySelector(".arena-board-cell.is-capturable")).toBeInTheDocument();
  });
});

/**
 * The same arrow the exercises board draws, so a rook going straight and a
 * bishop going diagonally read identically on both surfaces — but persistent,
 * because in Arena the last move is state the player reasons about, not a
 * lesson beat that plays once.
 */
describe("<ArenaBoard> last-move arrow", () => {
  const arrowPoints = (container: HTMLElement): number[][] | null => {
    const poly = container.querySelector(
      '[data-testid="arena-last-move-arrow"] polygon',
    );
    if (!poly) return null;
    return (poly.getAttribute("points") ?? "")
      .split(" ")
      .map((pair) => pair.split(",").map(Number));
  };

  it("draws nothing before either side has moved", () => {
    const { container } = renderWithIntl(<ArenaBoard {...BASE} />);
    expect(
      container.querySelector('[data-testid="arena-last-move-arrow"]'),
    ).toBeNull();
  });

  it("points from the origin square to the destination", () => {
    const { container } = renderWithIntl(
      <ArenaBoard {...BASE} lastMove={{ from: "a1", to: "a4" }} />,
    );
    const points = arrowPoints(container)!;
    expect(points).toHaveLength(7);
    // a1 → a4 climbs the a-file, so the tip is the topmost point (smallest y)
    // and every point shares roughly the same x.
    const [tip] = points;
    expect(tip[1]).toBe(Math.min(...points.map(([, y]) => y)));
  });

  it("keeps the square tint — the tint says WHICH squares, the arrow says which WAY", () => {
    const { container } = renderWithIntl(
      <ArenaBoard {...BASE} lastMove={{ from: "a1", to: "a4" }} />,
    );
    expect(
      container.querySelectorAll(".arena-board-cell.is-last-move"),
    ).toHaveLength(2);
    expect(arrowPoints(container)).not.toBeNull();
  });

  /** The arrow takes already-resolved points, so the flip is the caller's —
   *  which is the whole reason it needs no orientation logic. Playing black,
   *  the same move has to point the OTHER way down the screen. */
  it("follows the board when it is flipped for black", () => {
    const white = renderWithIntl(
      <ArenaBoard {...BASE} lastMove={{ from: "a1", to: "a4" }} />,
    );
    const black = renderWithIntl(
      <ArenaBoard {...BASE} lastMove={{ from: "a1", to: "a4" }} playerColor="b" />,
    );

    const whiteTip = arrowPoints(white.container)![0];
    const blackTip = arrowPoints(black.container)![0];
    const whiteTail = arrowPoints(white.container)![3];
    const blackTail = arrowPoints(black.container)![3];

    // White sees a1 at the bottom, so the tip is ABOVE the tail. Black sees the
    // board upside down, so the same move points DOWN the screen.
    expect(whiteTip[1]).toBeLessThan(whiteTail[1]);
    expect(blackTip[1]).toBeGreaterThan(blackTail[1]);
  });
});
