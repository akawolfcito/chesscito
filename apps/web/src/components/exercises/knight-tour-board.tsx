"use client";

/**
 * Knight's Tour board — the coverage game for Special Training levels of
 * kind:"knight-tour". Sibling of <DiagonalRunBoard>: same <GameBoard> geometry,
 * same `.playhub-board-*` visuals, same "owns no chrome" contract (the status
 * line is hoisted to the host's mission band via `onBandChange`).
 *
 * One turn = one tap on a legal jump. The square the knight LEAVES is X-ed out
 * and can never be entered again, so the run ends when every jump is closed.
 * `onComplete` reports (visited, reachable) — NOT moves: a tour is scored on
 * coverage, so the host grades it with tourStars, never labyrinthStars.
 *
 * Walls render as stone tiles (`.is-wall`), the way a labyrinth draws them: a
 * wall here is a level boundary, not a chess rule. It must never be drawn as a
 * knight — the player's own piece IS a knight, and the board would be saying
 * "this is a piece like yours" about something that is scenery.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GameBoard } from "@/lib/game/game-board";
import { cellCenter, pieceWidth } from "@/lib/game/board-geometry";
import {
  isTourStuck,
  legalTourMoves,
  reachableSquares,
} from "@/lib/game/knight-tour";
import { tourStars } from "@/lib/game/tour-score";
import { hapticReject, hapticSuccess, hapticTap } from "@/lib/haptics";
import { useThemePieceAssets } from "@/lib/themes/piece-theme-assets";
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

type Phase = "idle" | "selected" | "done";

export function KnightTourBoard({
  level,
  onComplete,
  onBandChange,
}: {
  level: Exercise;
  /** Fired once when the run ends, with the coverage the host must grade.
   *  Reports (visited, reachable) rather than a move count — the two are the
   *  same number for a tour, but naming it "moves" is what invites the next
   *  reader to reach for labyrinthStars, which cannot grade this. */
  onComplete?: (visited: number, reachable: number) => void;
  /** Hoists the status line to the host's mission band, same contract as
   *  <DiagonalRunBoard>. Unwired (the /dev probe) the local band renders. */
  onBandChange?: (band: { message: string; phase: string }) => void;
}) {
  const t = useTranslations("KNIGHT_TOUR_COPY.band");
  const pieceBase = useThemePieceAssets().w.knight;
  const START = level.startPos;
  const WALLS = useMemo(() => level.obstacles ?? [], [level.obstacles]);
  // The ceiling the score is measured against. The catalog already stored it as
  // level.optimalMoves (squares - 1), but the board recomputes rather than
  // reading it back: the /dev probe hands this component hand-written levels
  // that never crossed the importer.
  const REACHABLE = reachableSquares(START, WALLS).length;

  const [knight, setKnight] = useState<BoardPosition>(START);
  const [visited, setVisited] = useState<BoardPosition[]>([START]);
  const [selected, setSelected] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transient, setTransient] = useState<string | null>(null);
  const [pieceHint, setPieceHint] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const flash = (msg: string) => {
    setTransient(msg);
    timers.current.push(setTimeout(() => setTransient(null), 1400));
  };

  const handleCell = useCallback(
    (sq: string) => {
      if (phase === "done") return;
      const pos = parse(sq);

      if (!selected) {
        if (same(pos, knight)) {
          setSelected(true);
          setPhase("selected");
          setTransient(null);
          setPieceHint(false);
          hapticTap();
        } else {
          hapticReject();
          flash(t("tapKnightFirst"));
          setPieceHint(true);
          if (hintTimer.current) clearTimeout(hintTimer.current);
          hintTimer.current = setTimeout(() => setPieceHint(false), 2200);
        }
        return;
      }
      if (same(pos, knight)) return;

      const legal = legalTourMoves(knight, visited, WALLS);
      if (!legal.some((m) => same(m, pos))) {
        hapticReject();
        flash(t("illegal"));
        return;
      }

      // The vacated square is already in `visited` (the start went in on mount,
      // every landing goes in here), so leaving it X-es it out by construction.
      const nextVisited = [...visited, pos];
      setKnight(pos);
      setVisited(nextVisited);
      hapticTap();

      if (isTourStuck(pos, nextVisited, WALLS)) {
        hapticSuccess();
        setPhase("done");
        setSelected(false);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.(nextVisited.length, REACHABLE);
        }
      }
    },
    [phase, selected, knight, visited, t, WALLS, REACHABLE, onComplete],
  );

  const covered = visited.length;
  const pct = REACHABLE > 0 ? Math.round((covered / REACHABLE) * 100) : 0;
  const stars = phase === "done" ? tourStars(covered, REACHABLE) : 0;
  const moves = phase === "selected" ? legalTourMoves(knight, visited, WALLS) : [];
  const moveLabels = new Set(moves.map(LABEL));
  const knightLabel = LABEL(knight);
  const visitedLabels = new Set(visited.map(LABEL));

  const bandMessage =
    phase === "idle"
      ? t("tapKnight")
      : phase === "done"
        ? t("done")
        : t("choose");

  /* Progress is the whole point of the surface: the spec asks for the 80% line
     to be visible, so the count rides the band on every single turn, not just
     at the end. Composed once so the local and hoisted bands cannot drift. */
  const bandLine =
    (transient ?? bandMessage) +
    ` · ${covered}/${REACHABLE} · ${pct}%` +
    (phase === "done" ? ` · ${"★".repeat(stars)}` : "");

  useEffect(() => {
    onBandChange?.({ message: bandLine, phase });
  }, [bandLine, phase, onBandChange]);

  const renderCell = (_file: number, _rank: number, sq: string) => {
    const p = parse(sq);
    const dark = (p.file + p.rank) % 2 === 1;
    const isKnightCell = sq === knightLabel;
    const isWall = WALLS.some((w) => LABEL(w) === sq);
    // The knight's own square is visited but not yet vacated — no X under it.
    const isX = visitedLabels.has(sq) && !isKnightCell;
    const isMove = moveLabels.has(sq);
    return (
      <span
        aria-hidden="true"
        className={[
          "playhub-board-cell",
          dark ? "is-dark" : "is-light",
          isWall ? "is-wall" : "",
          isKnightCell && selected ? "is-selected" : "",
        ].filter(Boolean).join(" ")}
        style={{ position: "absolute", inset: 0 }}
      >
        {isX ? (
          <span
            data-testid="kt-x"
            style={{
              position: "absolute",
              inset: "22%",
              color: "rgba(60,20,10,0.72)",
              fontSize: "1.6rem",
              fontWeight: 900,
              lineHeight: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </span>
        ) : null}
        {isMove ? (
          <span
            data-testid="kt-spark"
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
      </span>
    );
  };

  const overlay = () => {
    const kc = cellCenter(knight.file, knight.rank);
    const pw = pieceWidth();
    return (
      <>
        {pieceBase ? <picture
          data-testid="kt-knight"
          data-knight-square={knightLabel}
          className={["playhub-board-piece-float", selected ? "is-selected" : ""].join(" ")}
          style={{
            left: `${kc.x}%`,
            top: `${kc.y}%`,
            width: `${pw}%`,
            pointerEvents: "none",
            transition: "left 320ms ease, top 320ms ease",
          }}
        >
          <img src={`${pieceBase}.png`} alt="" className="playhub-board-piece-img" style={{ width: "100%" }} />
        </picture> : null}
        {pieceHint ? (
          <div
            role="status"
            aria-live="polite"
            data-testid="kt-piece-hint"
            className="playhub-board-select-hint"
            data-placement={hintPlacement(knight.file)}
            style={{ left: `${kc.x}%`, top: `${kc.y}%` }}
          >
            {t("tapKnightFirst")}
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Local band — only when the host is not hosting the line itself. */}
      {!onBandChange && (
        <div
          data-testid="kt-band"
          data-phase={phase}
          className="mx-auto w-full max-w-[23.5rem] rounded-lg border border-amber-300/40 bg-amber-100/95 px-3 py-1.5 text-[#3f2208]"
        >
          <div className="text-xs leading-tight" data-testid="kt-band-msg">
            {bandLine}
          </div>
        </div>
      )}
      <div
        className="playhub-board-canvas"
        data-testid="kt-board"
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
