"use client";

import { useMemo } from "react";
import { cellGeometry, cellCenter, pieceWidth } from "@/lib/game/board-geometry";
import { ARENA_PIECE_IMG, squareToFileRank } from "@/lib/game/arena-utils";
import { hapticTap } from "@/lib/haptics";
import { THEME_CONFIG } from "@/lib/theme";
import type { ChessBoardPiece } from "@/lib/game/types";

type ArenaSquareState = {
  file: number;
  rank: number;
  label: string;
  isDark: boolean;
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
  isThinking?: boolean;
  onSquareClick: (square: string) => void;
  isCheckmatePause?: boolean;
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
        isDark: (file + rank) % 2 === 0,
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
  isThinking = false,
  onSquareClick,
  isCheckmatePause = false,
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

  if (pieces.length === 0) {
    return (
      <div className="playhub-stage-shell w-full">
        <div className="playhub-game-stage">
          <div className="flex items-center justify-center aspect-square w-full">
            <p className="text-sm text-rose-400">Board error — please restart the game</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="playhub-stage-shell w-full">
      <div className="playhub-game-stage">
        <div className="playhub-game-grid">
          <div className="playhub-board-canvas arena-board-canvas relative" data-checkmate={isCheckmatePause ? "true" : undefined}>
            {isThinking && (
              <div className="pointer-events-none absolute inset-0 animate-pulse rounded-2xl ring-2 ring-amber-400/20" />
            )}
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
                    onClick={() => { hapticTap(); onSquareClick(sq.label); }}
                    style={{
                      left: `${geo.left}%`,
                      top: `${geo.top}%`,
                      width: `${geo.width}%`,
                      height: `${geo.height}%`,
                    }}
                    className={[
                      "arena-board-cell",
                      sq.isDark ? "is-dark" : "is-light",
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

              {(() => {
                const groupCount: Record<string, number> = {};
                return pieces.map((p) => {
                const groupKey = `${p.color}-${p.type}`;
                const idx = groupCount[groupKey] ?? 0;
                groupCount[groupKey] = idx + 1;
                const { file, rank } = squareToFileRank(p.square);
                const center = cellCenter(file, rank);
                const pw = pieceWidth();
                const src = ARENA_PIECE_IMG[p.color][p.type];
                const isPieceSelected = p.square === selectedSquare;
                return (
                  <picture
                    key={`${p.color}-${p.type}-${idx}`}
                    className={`arena-piece-float${isPieceSelected ? " is-selected" : ""}`}
                    style={{
                      left: `${center.x}%`,
                      top: `${center.y}%`,
                      width: `${pw}%`,
                    }}
                  >
                    {THEME_CONFIG.hasOptimizedFormats && (
                      <>
                        <source
                          srcSet={src.replace(".png", ".avif")}
                          type="image/avif"
                        />
                        <source
                          srcSet={src.replace(".png", ".webp")}
                          type="image/webp"
                        />
                      </>
                    )}
                    <img
                      src={src}
                      alt={`${p.color === "w" ? "White" : "Black"} ${p.type}`}
                      className={`arena-piece-img ${THEME_CONFIG.pieceTintClass[p.color]}`}
                      style={{ width: "100%" }}
                    />
                  </picture>
                );
              });
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
