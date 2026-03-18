"use client";

import { useMemo } from "react";
import { cellGeometry, cellCenter } from "@/lib/game/board-geometry";
import { ARENA_PIECE_IMG, squareToFileRank } from "@/lib/game/arena-utils";
import type { ChessBoardPiece } from "@/lib/game/types";

type ArenaSquareState = {
  file: number;
  rank: number;
  label: string;
  isHighlighted: boolean;
  isSelected: boolean;
  isLastMove: boolean;
  isCheck: boolean;
};

type ArenaBoardProps = {
  pieces: ChessBoardPiece[];
  selectedSquare: string | null;
  legalMoves: string[];
  lastMove: { from: string; to: string } | null;
  checkSquare: string | null;
  isLocked: boolean;
  onSquareClick: (square: string) => void;
};

function buildArenaSquares(
  selectedSquare: string | null,
  legalMoves: string[],
  lastMove: { from: string; to: string } | null,
  checkSquare: string | null,
): ArenaSquareState[] {
  const legalSet = new Set(legalMoves);
  const squares: ArenaSquareState[] = [];

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const fileChar = String.fromCharCode(97 + file);
      const label = `${fileChar}${rank + 1}`;
      squares.push({
        file,
        rank,
        label,
        isHighlighted: legalSet.has(label),
        isSelected: label === selectedSquare,
        isLastMove: label === lastMove?.from || label === lastMove?.to,
        isCheck: label === checkSquare,
      });
    }
  }

  return squares;
}

export function ArenaBoard({
  pieces,
  selectedSquare,
  legalMoves,
  lastMove,
  checkSquare,
  isLocked,
  onSquareClick,
}: ArenaBoardProps) {
  const squares = useMemo(
    () => buildArenaSquares(selectedSquare, legalMoves, lastMove, checkSquare),
    [selectedSquare, legalMoves, lastMove, checkSquare],
  );

  const pieceMap = useMemo(() => {
    const map = new Map<string, ChessBoardPiece>();
    for (const p of pieces) map.set(p.square, p);
    return map;
  }, [pieces]);

  return (
    <div className="playhub-stage-shell w-full">
      <div className="playhub-game-stage">
        <div className="playhub-game-grid">
          <div className="playhub-board-canvas">
            <div className="playhub-board-hitgrid" role="grid" aria-label="Chess board">
              {squares.map((sq) => {
                const geo = cellGeometry(sq.file, sq.rank);
                return (
                  <button
                    key={sq.label}
                    type="button"
                    role="gridcell"
                    aria-label={`Square ${sq.label}`}
                    disabled={isLocked}
                    onClick={() => onSquareClick(sq.label)}
                    style={{
                      left: `${geo.left}%`,
                      top: `${geo.top}%`,
                      width: `${geo.width}%`,
                      height: `${geo.height}%`,
                      clipPath: geo.clipPath,
                    }}
                    className={[
                      "arena-board-cell",
                      sq.isHighlighted ? "is-highlighted" : "",
                      sq.isHighlighted && pieceMap.has(sq.label) ? "is-capturable" : "",
                      sq.isSelected ? "is-selected" : "",
                      sq.isLastMove ? "is-last-move" : "",
                      sq.isCheck ? "is-check" : "",
                    ].join(" ")}
                  >
                    <span className="playhub-board-label">{sq.label}</span>
                    {sq.isHighlighted && !pieceMap.has(sq.label) ? (
                      <span className="playhub-board-dot" />
                    ) : null}
                  </button>
                );
              })}

              {pieces.map((p) => {
                const { file, rank } = squareToFileRank(p.square);
                const center = cellCenter(file, rank);
                const src = ARENA_PIECE_IMG[p.color][p.type];
                return (
                  <picture
                    key={`${p.color}-${p.type}-${p.square}`}
                    className="arena-piece-float"
                    style={{
                      left: `${center.x}%`,
                      top: `${center.y}%`,
                    }}
                  >
                    <source
                      srcSet={src.replace(".png", ".avif")}
                      type="image/avif"
                    />
                    <source
                      srcSet={src.replace(".png", ".webp")}
                      type="image/webp"
                    />
                    <img
                      src={src}
                      alt={`${p.color === "w" ? "White" : "Black"} ${p.type}`}
                      className="arena-piece-img"
                    />
                  </picture>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
