"use client";

/**
 * Diagonal Run board (Gate D3, production). The turn-based bishop game for
 * Special Training levels of kind:"diagonal-run". Reuses the canonical
 * <GameBoard> geometry + `.playhub-board-*` visuals (including the exact
 * selection zoom) and owns the pivot interaction — the shared <Board> is not
 * touched. Copy comes from the DIAGONAL_RUN_COPY i18n namespace.
 *
 * One turn = one tap on a PIVOT square (a reachable bishop move): the bishop
 * slides to it, pauses, then TURNS onto a perpendicular diagonal and slides to
 * the star (capture), one square before a blocker, or the edge. `onComplete` is
 * called with the moves used so the host records progress via the labyrinth
 * ledger.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GameBoard } from "@/lib/game/game-board";
import { cellCenter, pieceWidth } from "@/lib/game/board-geometry";
import {
  pivotBfs,
  reachablePivots,
  resolvePivot,
} from "@/lib/game/diagonal-run";
import { labyrinthStars } from "@/lib/game/exercises";
import { hapticReject, hapticSuccess, hapticTap } from "@/lib/haptics";
import { useThemePieceAssets } from "@/lib/themes/piece-theme-assets";
import { useCurrentThemeAsset } from "@/lib/themes/use-current-theme-asset";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const LABEL = (p: BoardPosition) => `${"abcdefgh"[p.file]}${p.rank + 1}`;
const parse = (s: string): BoardPosition => ({
  file: "abcdefgh".indexOf(s[0]),
  rank: Number(s[1]) - 1,
});
const same = (a: BoardPosition, b: BoardPosition) =>
  a.file === b.file && a.rank === b.rank;
function hintPlacement(file: number): "left" | "right" | "top" {
  if (file <= 1) return "right";
  if (file >= 6) return "left";
  return "top";
}

const APPROACH_MS = 700;
const EXIT_MS = 560;

type Phase = "idle" | "selected" | "sliding" | "lost" | "won";

export function DiagonalRunBoard({
  level,
  onComplete,
  onBandChange,
}: {
  level: Exercise;
  /** Fired once on capture with the moves used, so the host records the best. */
  onComplete?: (moves: number) => void;
  /** Hoists the status line to the host's mission band (2026-07-16). The
   *  founder saw TWO stacked bands — "Move to g1" above "Tap the bishop to
   *  begin." — where the surface only ever wanted one. When this is wired
   *  the board stops rendering its own band and reports the line upward;
   *  the host renders it inside the mission band, carrying the `dr-band`
   *  test hooks with it. Left unwired (the /dev spike), the local band
   *  still renders, so the probe keeps working standalone. */
  onBandChange?: (band: { message: string; phase: string }) => void;
}) {
  const t = useTranslations("DIAGONAL_RUN_COPY.band");
  const pieceAssets = useThemePieceAssets();
  const bishopSrc = pieceAssets.w.bishop ? `${pieceAssets.w.bishop}.png` : null;
  const blockerStone = useCurrentThemeAsset("board.blocker.stone");
  const blockerSrc = blockerStone ? `${blockerStone}.png` : null;
  const START = level.startPos;
  const TARGET = level.targetPos;
  const BLOCKERS = useMemo(() => level.obstacles ?? [], [level.obstacles]);
  const OPTIMAL = pivotBfs(START, TARGET, BLOCKERS).optimalMoves;

  const [bishop, setBishop] = useState<BoardPosition>(START);
  const [selected, setSelected] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [movesUsed, setMovesUsed] = useState(0);
  const [marker, setMarker] = useState<BoardPosition | null>(null);
  const [transient, setTransient] = useState<string | null>(null);
  const [pieceHint, setPieceHint] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    completedRef.current = false;
    setBishop(START);
    setSelected(false);
    setPhase("idle");
    setMovesUsed(0);
    setMarker(null);
    setTransient(null);
    setPieceHint(false);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [START.file, START.rank]);

  const flash = (msg: string) => {
    setTransient(msg);
    timers.current.push(setTimeout(() => setTransient(null), 1400));
  };

  const handleCell = useCallback(
    (sq: string) => {
      if (phase === "sliding" || phase === "lost" || phase === "won") return;
      const pos = parse(sq);

      if (!selected) {
        if (same(pos, bishop)) {
          setSelected(true);
          setPhase("selected");
          setTransient(null);
          setPieceHint(false);
          hapticTap();
        } else {
          hapticReject();
          flash(t("tapBishopFirst"));
          setPieceHint(true);
          if (hintTimer.current) clearTimeout(hintTimer.current);
          hintTimer.current = setTimeout(() => setPieceHint(false), 2200);
        }
        return;
      }
      if (same(pos, bishop)) return;

      const r = resolvePivot(bishop, pos, BLOCKERS, TARGET);
      if (r.outcome === "illegal") {
        hapticReject();
        flash(t("illegal"));
        return;
      }

      setPhase("sliding");
      setMarker(r.pivot);
      hapticTap();
      setBishop(r.pivot);
      const directCapture = r.outcome === "win" && r.exitDir === null;
      timers.current.push(
        setTimeout(() => {
          setMarker(null);
          const finish = (m: number) => {
            hapticSuccess();
            setMovesUsed(m);
            setPhase("won");
            if (!completedRef.current) {
              completedRef.current = true;
              onComplete?.(m);
            }
          };
          if (directCapture) {
            finish(movesUsed + 1);
            return;
          }
          setBishop(r.landing);
          timers.current.push(
            setTimeout(() => {
              const m = movesUsed + 1;
              if (r.outcome === "win") {
                finish(m);
              } else if (pivotBfs(r.landing, TARGET, BLOCKERS).reachable) {
                setMovesUsed(m);
                setPhase("selected");
              } else {
                setMovesUsed(m);
                setPhase("lost");
                timers.current.push(setTimeout(reset, 1200));
              }
            }, EXIT_MS),
          );
        }, APPROACH_MS),
      );
    },
    [phase, selected, bishop, movesUsed, t, reset, BLOCKERS, TARGET, onComplete],
  );

  const stars = phase === "won" ? labyrinthStars(movesUsed, OPTIMAL) : 0;
  const pivots =
    selected && phase === "selected" ? reachablePivots(bishop, BLOCKERS) : [];
  const pivotLabels = new Set(pivots.map(LABEL));
  const bishopLabel = LABEL(bishop);
  const targetLabel = LABEL(TARGET);

  const bandMessage =
    phase === "idle"
      ? t("tapBishop")
      : phase === "selected"
        ? t("choose")
        : phase === "sliding"
          ? t("sliding")
          : phase === "lost"
            ? t("lost")
            : t("won");

  /* The whole status line, suffixes included. Composed once so the local
     band and the hoisted host band can never drift apart. */
  const bandLine =
    (transient ?? bandMessage) +
    (phase === "won" ? ` · ${movesUsed}/${OPTIMAL} · ${"★".repeat(stars)}` : "") +
    (phase === "selected" && movesUsed > 0 ? ` · ${movesUsed}` : "");

  useEffect(() => {
    onBandChange?.({ message: bandLine, phase });
  }, [bandLine, phase, onBandChange]);

  const renderCell = (_file: number, _rank: number, sq: string) => {
    const p = parse(sq);
    const dark = (p.file + p.rank) % 2 === 1;
    const isBishopCell = sq === bishopLabel;
    const isTarget = sq === targetLabel && !isBishopCell;
    const isPivot = pivotLabels.has(sq);
    const isMarker = marker !== null && sq === LABEL(marker);
    return (
      <span
        aria-hidden="true"
        className={[
          "playhub-board-cell",
          dark ? "is-dark" : "is-light",
          isBishopCell && selected ? "is-selected" : "",
        ].join(" ")}
        style={{ position: "absolute", inset: 0 }}
      >
        {isTarget ? <span className="playhub-board-target" /> : null}
        {isPivot ? (
          <span
            data-testid="dr-spark"
            style={{
              position: "absolute",
              inset: "28%",
              borderRadius: "9999px",
              background:
                "radial-gradient(circle, rgba(120,220,255,0.9) 0%, rgba(80,160,255,0.4) 60%, transparent 100%)",
              boxShadow: "0 0 10px 3px rgba(120,200,255,0.6)",
            }}
          />
        ) : null}
        {isMarker ? (
          <span
            data-testid="dr-marker"
            style={{
              position: "absolute",
              inset: "10%",
              borderRadius: "9999px",
              border: "3px solid rgba(255,215,90,0.95)",
              boxShadow: "0 0 12px 3px rgba(255,200,60,0.7)",
            }}
          />
        ) : null}
      </span>
    );
  };

  const overlay = () => {
    const bc = cellCenter(bishop.file, bishop.rank);
    const pw = pieceWidth();
    return (
      <>
        {BLOCKERS.map((b) => {
          if (!blockerSrc) return null;
          const c = cellCenter(b.file, b.rank);
          return (
            <picture
              key={`blk-${LABEL(b)}`}
              className="playhub-board-piece-float is-friendly-blocker"
              style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${pw}%`, pointerEvents: "none" }}
            >
              <img src={blockerSrc} alt="" aria-hidden="true" className="playhub-board-piece-img" style={{ width: "100%" }} />
            </picture>
          );
        })}
        {bishopSrc ? <picture
          data-testid="dr-bishop"
          data-bishop-square={bishopLabel}
          className={["playhub-board-piece-float", selected ? "is-selected" : ""].join(" ")}
          style={{
            left: `${bc.x}%`,
            top: `${bc.y}%`,
            width: `${pw}%`,
            pointerEvents: "none",
            transition: "left 320ms ease, top 320ms ease, opacity 400ms ease",
            opacity: phase === "lost" ? 0 : 1,
          }}
        >
          <img src={bishopSrc} alt="" className="playhub-board-piece-img" style={{ width: "100%" }} />
        </picture> : null}
        {pieceHint ? (
          <div
            role="status"
            aria-live="polite"
            data-testid="dr-piece-hint"
            className="playhub-board-select-hint"
            data-placement={hintPlacement(bishop.file)}
            style={{ left: `${bc.x}%`, top: `${bc.y}%` }}
          >
            {t("tapBishopFirst")}
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Local band — only when the host is NOT hosting the line in its
          mission band. Two stacked bands is what this replaced. */}
      {!onBandChange && (
        <div
          data-testid="dr-band"
          data-phase={phase}
          className="mx-auto w-full max-w-[23.5rem] rounded-lg border border-amber-300/40 bg-amber-100/95 px-3 py-1.5 text-[#3f2208]"
        >
          <div className="text-xs leading-tight" data-testid="dr-band-msg">
            {bandLine}
          </div>
        </div>
      )}
      <div
        className="playhub-board-canvas"
        data-testid="dr-board"
        style={{ width: "min(100%, 23.5rem)", aspectRatio: "1 / 1", margin: "0 auto" }}
      >
        <GameBoard
          maxWidth="100%"
          showCoordinates
          onCellClick={(_f, _r, sq) => handleCell(sq)}
          renderCell={renderCell}
          renderOverlay={overlay}
        />
      </div>
    </div>
  );
}
