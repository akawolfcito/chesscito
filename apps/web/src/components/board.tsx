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
import { cellCenter, pickHintPlacement, pieceWidth } from "@/lib/game/board-geometry";
import { GameBoard } from "@/lib/game/game-board";
import { hapticTap, hapticReject, hapticSuccess } from "@/lib/haptics";
import { ASSET_THEME, THEME_CONFIG } from "@/lib/theme";
import { BOARD_HINT_COPY } from "@/lib/content/editorial";
import { useThemePieceAssets } from "@/lib/themes/piece-theme-assets";
import { useCurrentThemeAsset } from "@/lib/themes/use-current-theme-asset";

const SELECT_HINT_DURATION_MS = 2200;

/** Pointer distance (px) below which a pointerdown→pointerup is
 *  treated as a tap instead of a drag. Tuned for touch precision —
 *  finger jitter on a tap is typically < 4px even on small screens. */
const DRAG_START_THRESHOLD_PX = 6;

/** Snap-back animation duration. Matches the CSS transition on
 *  `.is-snap-back` so the JS clears `dragOffset` after the visual
 *  returns to (0,0). */
const SNAP_BACK_MS = 200;


/** Choose hint placement so the pill never clips against the board edge.
 *  Vertical edges (top of the board) bite first — the original "always
 *  above" placement clipped on rank 7-8. Horizontal edges matter for the
 *  a/h files where the centered pill would overflow the canvas. */
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
  const pieceAssets = useThemePieceAssets();
  const targetMarkerSrc = useCurrentThemeAsset("shared.star");
  const blockerStoneSrc = useCurrentThemeAsset("board.blocker.stone");
  const [piece, setPiece] = useState(() => makePiece(pieceType, startPosition));
  const [selectedPosition, setSelectedPosition] = useState<BoardPosition | null>(
    null
  );
  const [movesCount, setMovesCount] = useState(0);
  // Capture squares the piece has already landed on. Tracks the REAL captures
  // (not a position heuristic) so a captured enemy vanishes for good even when
  // the pawn zig-zags across files, and an un-captured enemy stays visible.
  const [capturedSquares, setCapturedSquares] = useState<Set<string>>(
    () => new Set(),
  );
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

  // Move trail (founder 2026-07-17): the from→to path the piece just travelled,
  // drawn as a fading luminous line so the lesson (rook straight, bishop
  // diagonal) reads on the board. `id` re-keys the SVG so the fade replays on
  // every move, even when the same squares repeat. Cleared after the fade.
  const [trail, setTrail] = useState<{
    from: BoardPosition;
    to: BoardPosition;
    id: number;
  } | null>(null);
  const trailIdRef = useRef(0);
  const trailTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (selectHintTimerRef.current) clearTimeout(selectHintTimerRef.current);
    if (snapBackTimerRef.current) clearTimeout(snapBackTimerRef.current);
    if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
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
    // A new exercise starts clean: every enemy present, no captures yet.
    setCapturedSquares(new Set());
    // A new exercise starts clean: no leftover trail from the previous run.
    setTrail(null);
    if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pieceType, startPosition.file, startPosition.rank, mode]);

  const validTargets = useMemo(() => {
    if (!selectedPosition) return [];
    return getValidTargets(pieceType, selectedPosition, obstacles ?? [], isCapture, captureTargets, targetPosition ?? undefined);
  }, [pieceType, selectedPosition, obstacles, isCapture, captureTargets, targetPosition]);

  // Blockers render AS the cell (stone tile), not as a chained piece — a blocked
  // square reads clearer than a locked rook (founder 2026-06-16). Exercises paint
  // them too: the rules layer has always stopped the ray on an obstacle, so a
  // blocker the player cannot SEE reads as a broken board rather than a chess
  // rule. (A9 gives the exercise blocker its own friendly-piece art; the maze
  // keeps the ambient wall.)
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

  // Keyed lookup for the procedural board's renderCell (file,rank → square).
  const squareByKey = useMemo(() => {
    const map = new Map<string, (typeof squares)[number]>();
    for (const s of squares) map.set(`${s.file},${s.rank}`, s);
    return map;
  }, [squares]);

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
      // Trace the path the piece is about to travel — from its current cell to
      // the destination — then fade it. Both tap and drag resolve through here,
      // so the trail covers both input paths.
      const trailFrom = piece.position;
      trailIdRef.current += 1;
      setTrail({ from: trailFrom, to: nextPosition, id: trailIdRef.current });
      if (trailTimerRef.current) clearTimeout(trailTimerRef.current);
      trailTimerRef.current = setTimeout(() => {
        setTrail(null);
        trailTimerRef.current = null;
      }, 720);
      setMovesCount(nextMoves);
      setPiece((current) => movePiece(current, nextPosition));
      setSelectedPosition(null);

      // Landing on a capture square consumes that enemy — mark it captured so
      // it never re-renders behind the piece as it moves on.
      if ((captureTargets ?? []).some((c) => c.file === nextPosition.file && c.rank === nextPosition.rank)) {
        setCapturedSquares((prev) => {
          const next = new Set(prev);
          next.add(`${nextPosition.file},${nextPosition.rank}`);
          return next;
        });
      }

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

  // Absolute overlay layer — capture marker, capture pickups, select hint, and
  // the draggable floating piece. Positioned via cellCenter (% of the parent
  // inset region). Shared verbatim between the image board (mounted in the
  // hit-grid) and the procedural board (mounted in GameBoard's overlay region,
  // inset to the frame opening). cellCenter resolves against whichever region
  // wraps it, so each board stays aligned to its own grid.
  const overlayLayer = (
    <>
      {/* Move trail — a fading line from the origin cell to the destination,
          drawn first so it sits UNDER every piece/marker. viewBox 0-100 with
          preserveAspectRatio=none maps cellCenter's percentages straight to
          SVG units on the square board. Re-keyed per move so the fade replays. */}
      {trail && (() => {
        const a = cellCenter(trail.from.file, trail.from.rank);
        const b = cellCenter(trail.to.file, trail.to.rank);
        return (
          <svg
            key={trail.id}
            className="playhub-board-trail"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
          </svg>
        );
      })()}

      {/* Target piece — visible enemy piece for capture exercises */}
      {isCapture && targetPosition && !(piece.position.file === targetPosition.file && piece.position.rank === targetPosition.rank) && (() => {
        const tc = cellCenter(targetPosition.file, targetPosition.rank);
        const tw = pieceWidth();
        const targetImg = targetMarkerSrc;
        if (!targetImg) return null;
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
                <source srcSet={`${targetImg}.avif`} type="image/avif" />
                <source srcSet={`${targetImg}.webp`} type="image/webp" />
              </>
            )}
            <img
              src={`${targetImg}.png`}
              alt="Capture target"
              className="playhub-board-target-piece-img"
              style={{ width: "100%" }}
            />
          </picture>
        );
      })()}

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

      {/* Capturable enemy pieces (practice). An exercise whose capture square
          is DISTINCT from the goal (captureTargets, e.g. pawn-7 "blocked ahead
          → capture around") must show the enemy to capture. Without it the
          pawn's diagonal move dot lands on an empty square and teaches an
          illegal diagonal move. Labyrinth mode has its own capture rendering
          (the amber pickup marker above), so this is practice-only. Skips the
          goal square, which already carries the objective star. */}
      {mode !== "labyrinth" && (captureTargets ?? []).map((ct) => {
        // Goal square already carries the objective star — never overpaint it.
        if (targetPosition && ct.file === targetPosition.file && ct.rank === targetPosition.rank) {
          return null;
        }
        // Enemy already captured (the piece landed on it) — gone for good, even
        // across a zig-zag capture chain. Un-captured enemies stay visible.
        if (capturedSquares.has(`${ct.file},${ct.rank}`)) return null;
        const center = cellCenter(ct.file, ct.rank);
        const pw = pieceWidth();
        const captureEnemySrc = pieceAssets.b.pawn;
        if (!captureEnemySrc) return null;
        return (
          <picture
            key={`capture-enemy-${ct.file}-${ct.rank}`}
            className="playhub-board-piece-float is-capture-enemy"
            style={{
              left: `${center.x}%`,
              top: `${center.y}%`,
              width: `${pw}%`,
              pointerEvents: "none",
            }}
          >
            {THEME_CONFIG.hasOptimizedFormats && (
              <>
                <source srcSet={`${captureEnemySrc}.avif`} type="image/avif" />
                <source srcSet={`${captureEnemySrc}.webp`} type="image/webp" />
              </>
            )}
            <img
              src={`${captureEnemySrc}.png`}
              alt=""
              aria-hidden="true"
              className={PIECE_IMG_CLASS}
              style={{ width: "100%" }}
            />
          </picture>
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

      {/* Friendly blockers (practice only). The maze paints obstacles as ambient
          stone walls — a level boundary. An exercise's obstacle is a different
          thing: its whole lesson is a CHESS rule ("you cannot jump over a piece
          in your path, and you cannot land on it"). It is painted as a dedicated
          stone obstacle (`board.blocker.stone`, theme-builder slot) — distinct
          from the maze's ambient scene stone.

          Not interactive and not a drop target: pointer events stay off, so the
          cell button underneath still receives the tap and refuses the move,
          exactly as the rules layer already decided. */}
      {mode !== "labyrinth" && (obstacles ?? []).map((o) => {
        const center = cellCenter(o.file, o.rank);
        const pw = pieceWidth();
        if (!blockerStoneSrc) return null;
        return (
          <picture
            key={`blocker-${o.file}-${o.rank}`}
            className="playhub-board-piece-float is-friendly-blocker"
            style={{
              left: `${center.x}%`,
              top: `${center.y}%`,
              width: `${pw}%`,
              pointerEvents: "none",
            }}
          >
            <img
              src={`${blockerStoneSrc}.png`}
              alt=""
              aria-hidden="true"
              className={PIECE_IMG_CLASS}
              style={{ width: "100%" }}
            />
          </picture>
        );
      })}

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
        const activePieceSrc = pieceAssets.w[piece.type];
        if (!activePieceSrc) return null;
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
                <source srcSet={`${activePieceSrc}.avif`} type="image/avif" />
                <source srcSet={`${activePieceSrc}.webp`} type="image/webp" />
              </>
            )}
            <img
              src={`${activePieceSrc}.png`}
              alt={`White ${piece.type}`}
              className={PIECE_IMG_CLASS}
              style={{ width: "100%" }}
            />
          </picture>
        );
      })()}
    </>
  );

  // Per-cell substrate overlay for the procedural board: re-expresses the
  // hit-grid cell's state visuals (highlight / selected / endpoint / wall /
  // tutorial hint / peones hint) as a full-cell child so the existing
  // `.playhub-board-cell` CSS applies without the absolute geometry. GameBoard
  // owns the cell <button> (click + data-square for drag resolution); this only
  // paints the glow + dot + target + peones marker inside it. (file 0–7, rank
  // 1–8 chess rank → rankIdx = rank - 1.)
  const renderProceduralCell = (file: number, rank: number) => {
    const rankIdx = rank - 1;
    const square = squareByKey.get(`${file},${rankIdx}`);
    if (!square) return null;
    // The maze keeps its ambient stone wall. An exercise does NOT: there the
    // blocker is a chess rule ("you cannot jump your own piece"), and a stone
    // tile states a level boundary instead — so practice paints a real piece in
    // the floating layer below, and the cell stays plain.
    const isWall =
      mode === "labyrinth" && obstacleKeySet.has(`${file},${rankIdx}`);
    const isPeones =
      !!peonesHint && peonesHint.file === file && peonesHint.rank === rankIdx;
    return (
      <span
        aria-hidden="true"
        className={[
          "playhub-board-cell",
          square.isDark ? "is-dark" : "is-light",
          square.isHighlighted ? "is-highlighted" : "",
          square.isEndpoint ? "is-endpoint" : "",
          square.isSelected ? "is-selected" : "",
          isWall ? "is-wall" : "",
          tutorialHints?.has(square.label) ? "is-tutorial-hint" : "",
          isPeones ? "is-peones-hint" : "",
        ].filter(Boolean).join(" ")}
        style={{
          position: "absolute",
          inset: 0,
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
      >
        {square.isHighlighted ? <span className="playhub-board-dot" /> : null}
        {square.isTarget && !square.piece && !isCapture ? (
          <span className="playhub-board-target" />
        ) : null}
        {isPeones ? (
          <span className="playhub-board-peones-hint" aria-hidden="true" />
        ) : null}
      </span>
    );
  };

  return (
    <div className="playhub-stage-shell w-full">
      <div className="playhub-game-stage">
        <div className="playhub-game-grid">
          {/* GameBoard is a rigid square; size the canvas to the SMALLER of the
              available width and height so it stays square AND never overflows
              `.playhub-game-stage` (overflow:hidden would clip the edge ranks
              on shorter viewports / the daily-tactic sheet). Mirrors the arena
              fit + the image board's `calc(100dvh - 22rem)` chrome budget. */}
          <div
            className="playhub-board-canvas"
            style={{
              width: "min(100%, 23.5rem, calc(100dvh - 22rem))",
              aspectRatio: "1 / 1",
              maxHeight: "none",
              margin: "0 auto",
            }}
          >
            <GameBoard
              maxWidth="100%"
              onCellClick={(_file, _rank, sq) => handleSquarePress(sq)}
              renderCell={renderProceduralCell}
              renderOverlay={() => overlayLayer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
