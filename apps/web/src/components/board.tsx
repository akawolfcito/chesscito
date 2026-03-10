"use client";

import { useEffect, useMemo, useState } from "react";

import {
  arePositionsEqual,
  buildBoardSquares,
  getValidTargets,
  makePiece,
  movePiece,
} from "@/lib/game/board";
import type { BoardPosition, PieceId } from "@/lib/game/types";

const PIECE_IMG: Record<PieceId, string> = {
  rook:   "/art/piece-rook.png",
  bishop: "/art/piece-bishop.png",
  knight: "/art/piece-knight.png",
};

function parseLabel(label: string): BoardPosition {
  const file = label.charCodeAt(0) - 97;
  const rank = Number(label.slice(1)) - 1;

  return { file, rank };
}

type Point = { x: number; y: number };

// Corners calibrated from bg-with-grid.png pixel analysis (% of 1011×934 canvas)
const BOARD_TOP_LEFT: Point = { x: 11.6, y: 1.4 };
const BOARD_TOP_RIGHT: Point = { x: 88.2, y: 1.4 };
const BOARD_BOTTOM_LEFT: Point = { x: 0.1, y: 98.2 };
const BOARD_BOTTOM_RIGHT: Point = { x: 99.2, y: 98.2 };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Gamma > 1 compresses top rows to match board perspective foreshortening
const BOARD_V_GAMMA = 1.15;

function interpolateQuad(u: number, v: number): Point {
  const vg = Math.pow(v, BOARD_V_GAMMA);
  return {
    x: lerp(lerp(BOARD_TOP_LEFT.x, BOARD_TOP_RIGHT.x, u), lerp(BOARD_BOTTOM_LEFT.x, BOARD_BOTTOM_RIGHT.x, u), vg),
    y: lerp(lerp(BOARD_TOP_LEFT.y, BOARD_TOP_RIGHT.y, u), lerp(BOARD_BOTTOM_LEFT.y, BOARD_BOTTOM_RIGHT.y, u), vg),
  };
}

type BoardProps = {
  pieceType?: PieceId;
  startPosition?: BoardPosition;
  mode?: "tutorial" | "practice";
  targetPosition?: BoardPosition | null;
  isLocked?: boolean;
  onMove?: (position: BoardPosition, movesCount: number) => void;
  tutorialHints?: Set<string>;
};

export function Board({
  pieceType = "rook",
  startPosition = { file: 0, rank: 0 },
  mode = "practice",
  targetPosition = null,
  isLocked = false,
  onMove,
  tutorialHints,
}: BoardProps) {
  const [piece, setPiece] = useState(() => makePiece(pieceType, startPosition));
  const [selectedPosition, setSelectedPosition] = useState<BoardPosition | null>(
    mode === "tutorial" ? makePiece(pieceType, startPosition).position : null
  );
  const [movesCount, setMovesCount] = useState(0);

  // Sync internal state when exercise changes (e.g. localStorage loads progress after board mounts,
  // or the user navigates exercises via the stars bar). Without this, the piece stays at the
  // previous exercise's position while the props already point to the new exercise.
  // Intentionally using startPosition.file/.rank (primitives) instead of the startPosition object
  // to avoid false-positive re-runs when the parent creates a new object with the same coordinates.
  useEffect(() => {
    setPiece(makePiece(pieceType, startPosition));
    setSelectedPosition(mode === "tutorial" ? startPosition : null);
    setMovesCount(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceType, startPosition.file, startPosition.rank, mode]);

  const validTargets = useMemo(() => {
    if (!selectedPosition) return [];
    return getValidTargets(pieceType, selectedPosition);
  }, [pieceType, selectedPosition]);

  const squares = useMemo(
    () =>
      buildBoardSquares({
        selectedPosition,
        piece,
        validTargets,
        targetPosition,
      }),
    [piece, selectedPosition, targetPosition, validTargets]
  );

  const handleSquarePress = (label: string) => {
    if (mode !== "practice" || isLocked) {
      return;
    }

    const nextPosition = parseLabel(label);
    const piecePosition = piece.position;

    if (arePositionsEqual(piecePosition, nextPosition)) {
      setSelectedPosition((current) => (current ? null : piecePosition));
      return;
    }

    const canMove = validTargets.some((target) => arePositionsEqual(target, nextPosition));

    if (canMove) {
      const nextMoves = movesCount + 1;
      setMovesCount(nextMoves);
      setPiece((current) => movePiece(current, nextPosition));
      setSelectedPosition(null);
      onMove?.(nextPosition, nextMoves);
      return;
    }

    setSelectedPosition(null);
  };

  return (
    <div className="playhub-stage-shell w-full">
      <div className="playhub-game-stage">
        <div className="playhub-game-grid">
          <div className="playhub-board-canvas">
            <div className="playhub-board-hitgrid" role="grid" aria-label="Chess board">
              {squares.map((square) =>
                (() => {
                    const row = 7 - square.rank;
                    const col = square.file;
                    const u0 = col / 8;
                    const u1 = (col + 1) / 8;
                    const v0 = row / 8;
                    const v1 = (row + 1) / 8;
                    const p00 = interpolateQuad(u0, v0);
                    const p10 = interpolateQuad(u1, v0);
                    const p01 = interpolateQuad(u0, v1);
                    const p11 = interpolateQuad(u1, v1);
                    const minX = Math.min(p00.x, p10.x, p01.x, p11.x);
                    const maxX = Math.max(p00.x, p10.x, p01.x, p11.x);
                    const minY = Math.min(p00.y, p10.y, p01.y, p11.y);
                    const maxY = Math.max(p00.y, p10.y, p01.y, p11.y);
                    const cW = maxX - minX || 0.01;
                    const cH = maxY - minY || 0.01;

                    function relPt(pt: Point) {
                      return `${(((pt.x - minX) / cW) * 100).toFixed(1)}% ${(((pt.y - minY) / cH) * 100).toFixed(1)}%`;
                    }

                    const clipPath = `polygon(${relPt(p00)}, ${relPt(p10)}, ${relPt(p11)}, ${relPt(p01)})`;

                    return (
                      <button
                        key={square.label}
                        type="button"
                        role="gridcell"
                        aria-label={`Square ${square.label}`}
                        onClick={() => handleSquarePress(square.label)}
                        style={{
                          left: `${minX}%`,
                          top: `${minY}%`,
                          width: `${cW}%`,
                          height: `${cH}%`,
                          clipPath,
                        }}
                        className={[
                          "playhub-board-cell",
                          square.isHighlighted ? "is-highlighted" : "",
                          square.isSelected ? "is-selected" : "",
                          tutorialHints?.has(square.label) ? "is-tutorial-hint" : "",
                        ].join(" ")}
                      >
                        <span className="playhub-board-label">{square.label}</span>
                        {square.isHighlighted ? <span className="playhub-board-dot" /> : null}
                        {square.isTarget && !square.piece ? (
                          <span className="playhub-board-target" />
                        ) : null}
                        {/* Piece rendered as floating layer below */}
                      </button>
                    );
                  })()
                )}
              {/* Floating piece layer — same element moves with transition */}
              {(() => {
                const row = 7 - piece.position.rank;
                const col = piece.position.file;
                const center = interpolateQuad((col + 0.5) / 8, (row + 0.5) / 8);
                return (
                  <picture
                    className="playhub-board-piece-float"
                    style={{
                      left: `${center.x}%`,
                      top: `${center.y}%`,
                    }}
                  >
                    <source srcSet={PIECE_IMG[piece.type].replace(".png", ".avif")} type="image/avif" />
                    <source srcSet={PIECE_IMG[piece.type].replace(".png", ".webp")} type="image/webp" />
                    <img
                      src={PIECE_IMG[piece.type]}
                      alt={piece.type}
                      className="playhub-board-piece-img"
                    />
                  </picture>
                );
              })()}
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
