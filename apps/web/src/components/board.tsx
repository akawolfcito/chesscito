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
import { cellGeometry, cellCenter, pieceWidth } from "@/lib/game/board-geometry";

const PIECE_IMG: Record<PieceId, string> = {
  rook:   "/art/pieces/w-rook.png",
  bishop: "/art/pieces/w-bishop.png",
  knight: "/art/pieces/w-knight.png",
};

function parseLabel(label: string): BoardPosition {
  const file = label.charCodeAt(0) - 97;
  const rank = Number(label.slice(1)) - 1;

  return { file, rank };
}

type BoardProps = {
  pieceType?: PieceId;
  startPosition?: BoardPosition;
  mode?: "tutorial" | "practice";
  targetPosition?: BoardPosition | null;
  isLocked?: boolean;
  isCapture?: boolean;
  onMove?: (position: BoardPosition, movesCount: number) => void;
  tutorialHints?: Set<string>;
};

export function Board({
  pieceType = "rook",
  startPosition = { file: 0, rank: 0 },
  mode = "practice",
  targetPosition = null,
  isLocked = false,
  isCapture = false,
  onMove,
  tutorialHints,
}: BoardProps) {
  const [piece, setPiece] = useState(() => makePiece(pieceType, startPosition));
  const [selectedPosition, setSelectedPosition] = useState<BoardPosition | null>(
    startPosition
  );
  const [movesCount, setMovesCount] = useState(0);

  // Sync internal state when exercise changes (e.g. localStorage loads progress after board mounts,
  // or the user navigates exercises via the stars bar). Without this, the piece stays at the
  // previous exercise's position while the props already point to the new exercise.
  // Intentionally using startPosition.file/.rank (primitives) instead of the startPosition object
  // to avoid false-positive re-runs when the parent creates a new object with the same coordinates.
  useEffect(() => {
    setPiece(makePiece(pieceType, startPosition));
    setSelectedPosition(startPosition);
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
                    const geo = cellGeometry(square.file, square.rank);

                    return (
                      <button
                        key={square.label}
                        type="button"
                        role="gridcell"
                        aria-label={`Square ${square.label}`}
                        disabled={isLocked}
                        onClick={() => handleSquarePress(square.label)}
                        style={{
                          left: `${geo.left}%`,
                          top: `${geo.top}%`,
                          width: `${geo.width}%`,
                          height: `${geo.height}%`,
                          clipPath: geo.clipPath,
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
                          <span className={isCapture ? "playhub-board-target-capture" : "playhub-board-target"} />
                        ) : null}
                        {/* Piece rendered as floating layer below */}
                      </button>
                    );
                  })()
                )}
              {/* Floating piece layer — same element moves with transition */}
              {(() => {
                const center = cellCenter(piece.position.file, piece.position.rank);
                const pw = pieceWidth(piece.position.file, piece.position.rank);
                return (
                  <picture
                    className="playhub-board-piece-float"
                    style={{
                      left: `${center.x}%`,
                      top: `${center.y}%`,
                      width: `${pw}%`,
                    }}
                  >
                    <source srcSet={PIECE_IMG[piece.type].replace(".png", ".avif")} type="image/avif" />
                    <source srcSet={PIECE_IMG[piece.type].replace(".png", ".webp")} type="image/webp" />
                    <img
                      src={PIECE_IMG[piece.type]}
                      alt={`White ${piece.type}`}
                      className="playhub-board-piece-img"
                      style={{ width: "100%" }}
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
