"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  arePositionsEqual,
  buildBoardSquares,
  getPositionLabel,
  getValidTargets,
  makePiece,
  movePiece,
} from "@/lib/game/board";
import type { BoardPosition, PieceId } from "@/lib/game/types";
import { cellGeometry, cellCenter, pieceWidth } from "@/lib/game/board-geometry";
import { hapticTap, hapticReject, hapticSuccess } from "@/lib/haptics";
import { ASSET_THEME, THEME_CONFIG } from "@/lib/theme";
import { BOARD_HINT_COPY } from "@/lib/content/editorial";

const SELECT_HINT_DURATION_MS = 2200;

/** Pointer distance (px) below which a pointerdown→pointerup is
 *  treated as a tap instead of a drag. Tuned for touch precision —
 *  finger jitter on a tap is typically < 4px even on small screens. */
const DRAG_START_THRESHOLD_PX = 6;

/** Snap-back animation duration. Matches the CSS transition on
 *  `.is-snap-back` so the JS clears `dragOffset` after the visual
 *  returns to (0,0). */
const SNAP_BACK_MS = 200;

type HintPlacement = "top" | "bottom" | "left" | "right";

/** Choose hint placement so the pill never clips against the board edge.
 *  Vertical edges (top of the board) bite first — the original "always
 *  above" placement clipped on rank 7-8. Horizontal edges matter for the
 *  a/h files where the centered pill would overflow the canvas. */
function pickHintPlacement(file: number, rank: number): HintPlacement {
  if (rank >= 6) return "bottom";
  if (file <= 1) return "right";
  if (file >= 6) return "left";
  return "top";
}

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
  /** L2 labyrinth capture targets — capturable enemy pickup squares.
   *  Pawns may move diagonally only to these squares (or targetPos)
   *  when isCapture=true. Rendered as capturable markers. */
  captureTargets?: BoardPosition[];
  isLocked?: boolean;
  isCapture?: boolean;
  onMove?: (position: BoardPosition, movesCount: number) => void;
  tutorialHints?: Set<string>;
  /** Sprint 4 commit I — paid Peones Hint reveal. When set, the cell
   *  matching this position gets the `.is-peones-hint` class so CSS
   *  can render a golden pulse ring + ✨ on the optimal first move.
   *  Cleared by the parent after a short timer (~4s) so the hint
   *  doesn't linger forever. `null` = no active hint. */
  peonesHint?: BoardPosition | null;
};

export function Board({
  pieceType = "rook",
  startPosition = { file: 0, rank: 0 },
  mode = "practice",
  targetPosition = null,
  obstacles,
  captureTargets,
  isLocked = false,
  isCapture = false,
  onMove,
  tutorialHints,
  peonesHint = null,
}: BoardProps) {
  const [piece, setPiece] = useState(() => makePiece(pieceType, startPosition));
  const [selectedPosition, setSelectedPosition] = useState<BoardPosition | null>(
    null
  );
  const [movesCount, setMovesCount] = useState(0);
  const [isRejecting, setIsRejecting] = useState(false);
  // Surfaced when the user taps an empty cell with no piece selected — the
  // exact dead-end pattern reported on iPhone 17 Pro Max (2026-05-31).
  // Without this hint, the only feedback was the piece's reject shake,
  // which a first-time user could read as "the board is broken / locked."
  const [showSelectHint, setShowSelectHint] = useState(false);
  const selectHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(false);
  useEffect(() => { mountedRef.current = true; }, []);

  // Drag-to-move state — Sprint 4 commit N (2026-06-08). Coexists with
  // the tap-to-select tap-to-move flow: a pointerdown that releases
  // before crossing DRAG_START_THRESHOLD_PX is forwarded to
  // `handleSquarePress` exactly like a tap. Crossing the threshold
  // promotes the gesture to a drag — the piece visually follows the
  // pointer, valid-target highlights light up, and pointerup resolves
  // the drop either to a move (valid cell) or a snap-back animation
  // (invalid cell or off-board release).
  const dragStateRef = useRef<{
    active: boolean;
    startX: number;
    startY: number;
    pointerId: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState<{ dx: number; dy: number } | null>(
    null,
  );
  const [isSnappingBack, setIsSnappingBack] = useState(false);
  const snapBackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (selectHintTimerRef.current) clearTimeout(selectHintTimerRef.current);
    if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
  }, []);

  /** Reverts an in-flight drag visual to the piece's home cell with
   *  the CSS .is-snap-back transition. Called on invalid drops and
   *  pointercancel. Cleared by the timer or by a fresh drag start. */
  function triggerSnapBack() {
    if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    setIsSnappingBack(true);
    setDragOffset(null);
    snapBackTimerRef.current = setTimeout(() => {
      setIsSnappingBack(false);
      snapBackTimerRef.current = null;
    }, SNAP_BACK_MS);
  }

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
    return getValidTargets(pieceType, selectedPosition, obstacles ?? [], isCapture, captureTargets, targetPosition ?? undefined);
  }, [pieceType, selectedPosition, obstacles, isCapture, captureTargets, targetPosition]);

  // Labyrinth walls render AS the cell (stone tile), not as a chained piece —
  // a blocked square reads clearer than a locked rook (founder 2026-06-16).
  const obstacleKeySet = useMemo(
    () => new Set((obstacles ?? []).map((o) => `${o.file},${o.rank}`)),
    [obstacles],
  );

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
      // User found the piece — dismiss any pending hint to avoid clutter.
      if (selectHintTimerRef.current) clearTimeout(selectHintTimerRef.current);
      setShowSelectHint(false);
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

    // Contextual hint: when the user taps an empty cell WITHOUT having
    // selected the piece first, surface a short "Tap your piece first"
    // overlay. This closes the iPhone field-report pattern where a
    // first-time user kept tapping the target star and gave up because
    // the only feedback was the (offscreen) piece shake.
    if (!selectedPosition) {
      if (selectHintTimerRef.current) clearTimeout(selectHintTimerRef.current);
      setShowSelectHint(true);
      selectHintTimerRef.current = setTimeout(() => {
        setShowSelectHint(false);
        selectHintTimerRef.current = null;
      }, SELECT_HINT_DURATION_MS);
    }

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
            <picture className="playhub-board-img">
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
                        // Sprint 4 commit N — drag-to-move drop resolution.
                        // The piece's pointerup reads document.elementFromPoint
                        // and walks up to find the [data-square] attribute.
                        data-square={square.label}
                        disabled={isLocked}
                        onClick={() => handleSquarePress(square.label)}
                        style={{
                          left: `${geo.left}%`,
                          top: `${geo.top}%`,
                          width: `${geo.width}%`,
                          height: `${geo.height}%`,
                          // Chebyshev distance from the selected piece drives
                          // the highlight stagger reveal: cells closer to the
                          // piece light up first, then ripples outward at
                          // 40ms intervals. The CSS rule on
                          // .playhub-board-cell.is-highlighted picks up the
                          // --cell-stagger custom property as transition-delay.
                          ...(square.isHighlighted && selectedPosition
                            ? {
                                ["--cell-stagger" as string]:
                                  Math.max(
                                    Math.abs(square.file - selectedPosition.file),
                                    Math.abs(square.rank - selectedPosition.rank),
                                  ) - 1,
                              }
                            : null),
                        }}
                        className={[
                          "playhub-board-cell",
                          square.isDark ? "is-dark" : "is-light",
                          square.isHighlighted ? "is-highlighted" : "",
                          square.isEndpoint ? "is-endpoint" : "",
                          square.isSelected ? "is-selected" : "",
                          mode === "labyrinth" && obstacleKeySet.has(`${square.file},${square.rank}`) ? "is-wall" : "",
                          tutorialHints?.has(square.label) ? "is-tutorial-hint" : "",
                          peonesHint &&
                          peonesHint.file === square.file &&
                          peonesHint.rank === square.rank
                            ? "is-peones-hint"
                            : "",
                        ].join(" ")}
                      >
                        <span className="playhub-board-label">{square.label}</span>
                        {square.isHighlighted ? <span className="playhub-board-dot" /> : null}
                        {square.isTarget && !square.piece && !isCapture ? (
                          <span className="playhub-board-target" />
                        ) : null}
                        {peonesHint &&
                        peonesHint.file === square.file &&
                        peonesHint.rank === square.rank ? (
                          <span className="playhub-board-peones-hint" aria-hidden="true" />
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

              {/* Labyrinth walls render AS the cell via the .is-wall class on
                  the hit-grid button (stone tile) — see board.tsx className +
                  globals.css .playhub-board-cell.is-wall. No floating piece /
                  lock overlay: a stone-blocked square reads clearer for a
                  beginner than a chained rook (founder 2026-06-16). */}

              {/* Capture targets — capturable pickup markers. Rendered as
                  small glowing amber circles to indicate "land here to
                  capture". No lock icon; visually distinct from obstacles
                  which are desaturated pieces with a lock badge. */}
              {mode === "labyrinth" && captureTargets && captureTargets.length > 0 && captureTargets.map((ct) => {
                const cc = cellCenter(ct.file, ct.rank);
                const cw = pieceWidth();
                const key = `capture-${ct.file}-${ct.rank}`;
                return (
                  <div
                    key={key}
                    aria-hidden="true"
                    className="playhub-board-piece-float"
                    style={{
                      left: `${cc.x}%`,
                      top: `${cc.y}%`,
                      width: `${cw}%`,
                      pointerEvents: "none",
                    }}
                  >
                    <span
                      className="block rounded-full"
                      style={{
                        width: "100%",
                        height: "100%",
                        background: "radial-gradient(circle, rgba(255, 200, 50, 0.35) 0%, rgba(255, 160, 20, 0.15) 70%, transparent 100%)",
                        boxShadow: "0 0 14px 4px rgba(255, 180, 40, 0.45), inset 0 0 8px 2px rgba(255, 200, 80, 0.25)",
                      }}
                    />
                  </div>
                );
              })}

              {/* Contextual hint — appears next to the piece when the user
                  taps an empty cell without first selecting the piece.
                  Placement flips per piece location so the pill never
                  clips against the board edge. Pointer events disabled so
                  it never intercepts taps. */}
              {showSelectHint && (() => {
                const center = cellCenter(piece.position.file, piece.position.rank);
                const placement = pickHintPlacement(piece.position.file, piece.position.rank);
                return (
                  <div
                    role="status"
                    aria-live="polite"
                    className="playhub-board-select-hint"
                    data-placement={placement}
                    style={{
                      left: `${center.x}%`,
                      top: `${center.y}%`,
                    }}
                  >
                    {BOARD_HINT_COPY.selectPieceFirst}
                  </div>
                );
              })()}

              {/* Floating piece layer — same element moves with transition.
                  Sprint 4 commit N — also the drag handle. Pointer events
                  enabled so the piece can capture pointerdown; the cell
                  buttons underneath still receive their own clicks via
                  the gridcell <button>. */}
              {(() => {
                const center = cellCenter(piece.position.file, piece.position.rank);
                const pw = pieceWidth();
                const isPieceSelected =
                  selectedPosition !== null &&
                  arePositionsEqual(selectedPosition, piece.position);
                const isDragging = dragOffset !== null;
                const dragStyle = isDragging
                  ? ({
                      ["--drag-dx" as string]: `${dragOffset.dx}px`,
                      ["--drag-dy" as string]: `${dragOffset.dy}px`,
                    } as Record<string, string>)
                  : undefined;
                return (
                  <picture
                    className={[
                      "playhub-board-piece-float",
                      isPieceSelected ? "is-selected" : "",
                      isRejecting ? "piece-reject" : "",
                      isDragging ? "is-dragging" : "",
                      isSnappingBack ? "is-snap-back" : "",
                    ].filter(Boolean).join(" ")}
                    style={{
                      left: `${center.x}%`,
                      top: `${center.y}%`,
                      width: `${pw}%`,
                      pointerEvents: isLocked ? "none" : "auto",
                      touchAction: "none",
                      ...dragStyle,
                    }}
                    onPointerDown={(e) => {
                      if (isLocked || !mountedRef.current) return;
                      // Capture so subsequent move/up events come to us
                      // even if the finger leaves the piece bounds.
                      try {
                        e.currentTarget.setPointerCapture(e.pointerId);
                      } catch {
                        /* iOS Safari quirk — capture not always available */
                      }
                      if (snapBackTimerRef.current) {
                        clearTimeout(snapBackTimerRef.current);
                        snapBackTimerRef.current = null;
                      }
                      setIsSnappingBack(false);
                      dragStateRef.current = {
                        active: false,
                        startX: e.clientX,
                        startY: e.clientY,
                        pointerId: e.pointerId,
                      };
                    }}
                    onPointerMove={(e) => {
                      const state = dragStateRef.current;
                      if (!state || state.pointerId !== e.pointerId) return;
                      const dx = e.clientX - state.startX;
                      const dy = e.clientY - state.startY;
                      if (!state.active) {
                        if (Math.hypot(dx, dy) < DRAG_START_THRESHOLD_PX) return;
                        state.active = true;
                        // Auto-select the piece so validTargets light up.
                        if (
                          !selectedPosition ||
                          !arePositionsEqual(selectedPosition, piece.position)
                        ) {
                          setSelectedPosition(piece.position);
                        }
                        if (selectHintTimerRef.current) {
                          clearTimeout(selectHintTimerRef.current);
                          selectHintTimerRef.current = null;
                        }
                        setShowSelectHint(false);
                      }
                      setDragOffset({ dx, dy });
                    }}
                    onPointerUp={(e) => {
                      const state = dragStateRef.current;
                      if (!state || state.pointerId !== e.pointerId) return;
                      dragStateRef.current = null;
                      try {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      } catch {
                        /* ignore */
                      }

                      if (!state.active) {
                        // No drag — treat as a tap on the piece's home
                        // cell. Same flow as before the drag was added.
                        setDragOffset(null);
                        handleSquarePress(getPositionLabel(piece.position));
                        return;
                      }

                      // Resolve the cell under the release point. Walk up
                      // from elementFromPoint to find the [data-square]
                      // attribute (covers cases where the actual hit was
                      // a child span / icon inside the cell button).
                      //
                      // Critical: the piece itself sits transformed under
                      // the finger (CSS transform participates in hit
                      // testing), so an unfiltered elementFromPoint would
                      // return the piece — which has no data-square — and
                      // every drop would snap back. Temporarily disable
                      // pointer-events on the piece so the query falls
                      // through to the cell underneath, then restore.
                      const pieceEl = e.currentTarget as HTMLElement;
                      const prevPointerEvents = pieceEl.style.pointerEvents;
                      pieceEl.style.pointerEvents = "none";
                      const hitEl = document.elementFromPoint(
                        e.clientX,
                        e.clientY,
                      ) as HTMLElement | null;
                      pieceEl.style.pointerEvents = prevPointerEvents;
                      const cellEl = hitEl?.closest("[data-square]") as
                        | HTMLElement
                        | null;
                      const label = cellEl?.dataset.square ?? null;

                      if (!label) {
                        // Released off-board → snap back.
                        triggerSnapBack();
                        return;
                      }

                      const target = parseLabel(label);
                      const isValid = validTargets.some((t) =>
                        arePositionsEqual(t, target),
                      );

                      if (isValid) {
                        // Successful drop. Clear the visual offset
                        // BEFORE the move so the piece transition starts
                        // from the home cell (avoids a one-frame
                        // teleport when the new center kicks in).
                        setDragOffset(null);
                        handleSquarePress(label);
                      } else {
                        triggerSnapBack();
                      }
                    }}
                    onPointerCancel={() => {
                      if (!dragStateRef.current) return;
                      const wasActive = dragStateRef.current.active;
                      dragStateRef.current = null;
                      if (wasActive) triggerSnapBack();
                      else setDragOffset(null);
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
