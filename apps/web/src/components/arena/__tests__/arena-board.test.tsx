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

describe("<ArenaBoard> procedural board flag", () => {
  it("defaults to the image board (flag off) — byte-identical substrate", () => {
    const { container } = renderWithIntl(<ArenaBoard {...BASE} />);
    expect(container.querySelector(".playhub-board-img")).toBeInTheDocument();
    expect(container.querySelector(`img[src*="${FRAME_SRC}"]`)).toBeNull();
  });

  it("renders the GameBoard substrate when proceduralBoard is on", () => {
    const { container } = renderWithIntl(<ArenaBoard {...BASE} proceduralBoard />);
    expect(container.querySelector(`img[src*="${FRAME_SRC}"]`)).toBeInTheDocument();
    expect(container.querySelector(".playhub-board-img")).toBeNull();
    expect(
      screen.getAllByRole("gridcell", { name: /^Square [a-h][1-8]$/ }),
    ).toHaveLength(64);
  });

  it("renders all pieces on the procedural board", () => {
    const { container } = renderWithIntl(<ArenaBoard {...BASE} proceduralBoard />);
    expect(container.querySelectorAll(".arena-piece-float")).toHaveLength(PIECES.length);
  });

  it("flips the board for black (GameBoard orientation): top-left cell is h1", () => {
    renderWithIntl(<ArenaBoard {...BASE} playerColor="b" proceduralBoard />);
    expect(screen.getAllByRole("gridcell")[0]).toHaveAttribute("aria-label", "Square h1");
  });

  it("clicks pass the LOGICAL square label regardless of orientation", () => {
    const onSquareClick = vi.fn();
    renderWithIntl(
      <ArenaBoard
        {...BASE}
        playerColor="b"
        proceduralBoard
        onSquareClick={onSquareClick}
      />,
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
        proceduralBoard
      />,
    );
    expect(container.querySelector(".playhub-board-dot")).toBeInTheDocument();
    expect(container.querySelector(".arena-board-cell.is-capturable")).toBeInTheDocument();
  });
});
