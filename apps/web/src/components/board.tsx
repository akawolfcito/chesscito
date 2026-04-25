"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  arePositionsEqual,
  buildBoardSquares,
  getValidTargets,
  makePiece,
  movePiece,
} from "@/lib/game/board";
import type { BoardPosition, PieceId } from "@/lib/game/types";
import { cellGeometry, cellCenter, pieceWidth } from "@/lib/game/board-geometry";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { hapticTap, hapticReject, hapticSuccess } from "@/lib/haptics";
import { ASSET_THEME, THEME_CONFIG } from "@/lib/theme";

const PIECE_BASE = THEME_CONFIG.piecesBase;

const PIECE_IMG: Record<PieceId, string> = {
  rook:   `${PIECE_BASE}/w-rook.png`,
  bishop: `${PIECE_BASE}/w-bishop.png`,
  knight: `${PIECE_BASE}/w-knight.png`,
  pawn:   `${PIECE_BASE}/w-pawn.png`,
  queen:  `${PIECE_BASE}/w-queen.png`,
  king:   `${PIECE_BASE}/w-king.png`,
};

/** Capture-objective marker. Universal star sprite — clearer than a chained
 *  enemy piece and avoids per-piece asset production. */
const TARGET_MARKER_SRC = "/art/redesign/icons/star.png";

const PIECE_IMG_CLASS = ASSET_THEME === "candy"
  ? "playhub-board-piece-img arena-treat-natural"
  : "playhub-board-piece-img";

function parseLabel(label: string): BoardPosition {
  const file = label.charCodeAt(0) - 97;
  const rank = Number(label.slice(1)) - 1;

  return { file, rank };
}

type BoardProps = {
  pieceType?: PieceId;
  startPosition?: BoardPosition;
  mode?: "tutorial" | "practice" | "labyrinth";
  targetPosition?: BoardPosition | null;
  /** L2 labyrinth obstacles — friendly blocker pieces. Cannot be moved
   *  through or captured. Forwarded to the rules layer as blockers. */
  obstacles?: BoardPosition[];
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
  obstacles,
  isLocked = false,
  isCapture = false,
  onMove,
  tutorialHints,
}: BoardProps) {
  const [piece, setPiece] = useState(() => makePiece(pieceType, startPosition));
  const [selectedPosition, setSelectedPosition] = useState<BoardPosition | null>(
    null
  );
  const [movesCount, setMovesCount] = useState(0);
  const [isRejecting, setIsRejecting] = useState(false);
  const mountedRef = useRef(false);
  useEffect(() => { mountedRef.current = true; }, []);

  // Sync internal state when exercise changes (e.g. localStorage loads progress after board mounts,
  // or the user navigates exercises via the stars bar). Without this, the piece stays at the
  // previous exercise's position while the props already point to the new exercise.
  // Intentionally using startPosition.file/.rank (primitives) instead of the startPosition object
  // to avoid false-positive re-runs when the parent creates a new object with the same coordinates.
  useEffect(() => {
    setPiece(makePiece(pieceType, startPosition));
    setSelectedPosition(null);
    setMovesCount(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceType, startPosition.file, startPosition.rank, mode]);

  const validTargets = useMemo(() => {
    if (!selectedPosition) return [];
    return getValidTargets(pieceType, selectedPosition, obstacles ?? [], isCapture);
  }, [pieceType, selectedPosition, obstacles, isCapture]);

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
    const isInteractive = mode === "practice" || mode === "labyrinth";
    if (!isInteractive || isLocked || !mountedRef.current) {
      return;
    }

    const nextPosition = parseLabel(label);
    const piecePosition = piece.position;

    if (arePositionsEqual(piecePosition, nextPosition)) {
      // If already selected, ignore tap (no accidental deselection)
      if (!selectedPosition) setSelectedPosition(piecePosition);
      return;
    }

    const canMove = validTargets.some((target) => arePositionsEqual(target, nextPosition));

    if (canMove) {
      const nextMoves = movesCount + 1;
      setMovesCount(nextMoves);
      setPiece((current) => movePiece(current, nextPosition));
      setSelectedPosition(null);

      const isTargetReached =
        targetPosition !== null &&
        nextPosition.file === targetPosition.file &&
        nextPosition.rank === targetPosition.rank;
      if (isTargetReached) {
        hapticSuccess();
      } else {
        hapticTap();
      }

      onMove?.(nextPosition, nextMoves);
      return;
    }

    // Invalid tap — shake the piece briefly
    hapticReject();
    setIsRejecting(true);
    setTimeout(() => setIsRejecting(false), 200);
    setSelectedPosition(null);
  };

  return (
    <div className="playhub-stage-shell w-full">
      <div className="playhub-game-stage">
        <div className="playhub-game-grid">
          <div className="playhub-board-canvas">
            {/* Board sprite rendered as a real <picture>/<img> instead of a
                CSS ::before pseudo. iOS WebKit has rendering bugs with the
                combo pseudo + z-index: -1 + isolation: isolate + filter,
                which was hiding the entire board on iPhone Safari/Chrome/
                Brave since the candy redesign. <img> paints reliably
                everywhere and supports drop-shadow via filter. */}
            <picture aria-hidden="true" className="playhub-board-img">
              <source srcSet="/art/redesign/board/board-ch.avif" type="image/avif" />
              <source srcSet="/art/redesign/board/board-ch.webp" type="image/webp" />
              <img src="/art/redesign/board/board-ch.png" alt="" />
            </picture>
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
                        }}
                        className={[
                          "playhub-board-cell",
                          square.isDark ? "is-dark" : "is-light",
                          square.isHighlighted ? "is-highlighted" : "",
                          square.isEndpoint ? "is-endpoint" : "",
                          square.isSelected ? "is-selected" : "",
                          tutorialHints?.has(square.label) ? "is-tutorial-hint" : "",
                        ].join(" ")}
                      >
                        <span className="playhub-board-label">{square.label}</span>
                        {square.isHighlighted ? <span className="playhub-board-dot" /> : null}
                        {square.isTarget && !square.piece && !isCapture ? (
                          <span className="playhub-board-target" />
                        ) : null}
                        {/* Piece rendered as floating layer below */}
                      </button>
                    );
                  })()
                )}
              {/* Target piece — visible enemy piece for capture exercises */}
              {isCapture && targetPosition && !(piece.position.file === targetPosition.file && piece.position.rank === targetPosition.rank) && (() => {
                const tc = cellCenter(targetPosition.file, targetPosition.rank);
                const tw = pieceWidth();
                const targetImg = TARGET_MARKER_SRC;
                return (
                  <picture
                    className="playhub-board-target-piece"
                    style={{
                      left: `${tc.x}%`,
                      top: `${tc.y}%`,
                      width: `${tw * 1.0}%`,
                    }}
                  >
                    {THEME_CONFIG.hasOptimizedFormats && (
                      <>
                        <source srcSet={targetImg.replace(".png", ".avif")} type="image/avif" />
                        <source srcSet={targetImg.replace(".png", ".webp")} type="image/webp" />
                      </>
                    )}
                    <img
                      src={targetImg}
                      alt="Capture target"
                      className="playhub-board-target-piece-img"
                      style={{ width: "100%" }}
                    />
                  </picture>
                );
              })()}

              {/* Labyrinth obstacles — "chained" friendly pieces. Rendered
                  at full opacity with a desaturated grey tint so they read
                  as solid in-world objects (not ghosts), then a lock
                  CandyIcon overlay communicates "intocable, no se mueve".
                  Non-interactive: hit-grid buttons remain the only click
                  targets, and the rules layer already excludes obstacle
                  squares from valid targets. */}
              {mode === "labyrinth" && obstacles && obstacles.length > 0 && obstacles.map((ob) => {
                const oc = cellCenter(ob.file, ob.rank);
                const ow = pieceWidth();
                const obstacleImg = PIECE_IMG[pieceType];
                const key = `obstacle-${ob.file}-${ob.rank}`;
                return (
                  <div
                    key={key}
                    aria-hidden="true"
                    className="playhub-board-piece-float"
                    style={{
                      left: `${oc.x}%`,
                      top: `${oc.y}%`,
                      width: `${ow}%`,
                      pointerEvents: "none",
                    }}
                  >
                    <picture
                      style={{
                        display: "block",
                        filter: "saturate(0.35) brightness(0.85) drop-shadow(0 0 6px rgba(80, 50, 20, 0.35))",
                      }}
                    >
                      {THEME_CONFIG.hasOptimizedFormats && (
                        <>
                          <source srcSet={obstacleImg.replace(".png", ".avif")} type="image/avif" />
                          <source srcSet={obstacleImg.replace(".png", ".webp")} type="image/webp" />
                        </>
                      )}
                      <img
                        src={obstacleImg}
                        alt=""
                        className={PIECE_IMG_CLASS}
                        style={{ width: "100%" }}
                      />
                    </picture>
                    {/* Lock badge — bottom-right of the piece sprite.
                        Communicates "chained / cannot pass". */}
                    <span
                      className="absolute"
                      style={{
                        right: "10%",
                        bottom: "8%",
                        width: "38%",
                        height: "38%",
                        background: "rgba(63, 34, 8, 0.92)",
                        borderRadius: "9999px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255, 245, 215, 0.20)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <CandyIcon name="lock" className="h-[60%] w-[60%]" />
                    </span>
                  </div>
                );
              })}

              {/* Floating piece layer — same element moves with transition */}
              {(() => {
                const center = cellCenter(piece.position.file, piece.position.rank);
                const pw = pieceWidth();
                const isPieceSelected =
                  selectedPosition !== null &&
                  arePositionsEqual(selectedPosition, piece.position);
                return (
                  <picture
                    className={[
                      "playhub-board-piece-float",
                      isPieceSelected ? "is-selected" : "",
                      isRejecting ? "piece-reject" : "",
                    ].filter(Boolean).join(" ")}
                    style={{
                      left: `${center.x}%`,
                      top: `${center.y}%`,
                      width: `${pw}%`,
                    }}
                  >
                    {THEME_CONFIG.hasOptimizedFormats && (
                      <>
                        <source srcSet={PIECE_IMG[piece.type].replace(".png", ".avif")} type="image/avif" />
                        <source srcSet={PIECE_IMG[piece.type].replace(".png", ".webp")} type="image/webp" />
                      </>
                    )}
                    <img
                      src={PIECE_IMG[piece.type]}
                      alt={`White ${piece.type}`}
                      className={PIECE_IMG_CLASS}
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
