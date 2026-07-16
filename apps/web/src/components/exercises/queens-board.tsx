"use client";

/**
 * N-Queens board — the coverage game for Special Training levels of
 * kind:"queens". Sibling of <KnightTourBoard>: same <GameBoard> geometry, same
 * `.playhub-board-*` visuals, same "owns no chrome" contract (the status line is
 * hoisted to the host's mission band via `onBandChange`).
 *
 * One turn = one tap on a safe square, and a queen stays there for good. The run
 * ends when no safe square is left. `onComplete` reports (placed, ceiling) — NOT
 * moves: this is scored on coverage, so the host grades it with tourStars, never
 * labyrinthStars.
 *
 * An illegal tap is REJECTED, never punished (spec §2): the board flashes what
 * is watching that square and says so, and the position is untouched. Learning
 * where a queen's eye reaches IS the game; charging the player for looking would
 * be charging them for playing it.
 *
 * Blocks render as stone tiles (`.is-wall`), the way a labyrinth draws them: a
 * block here is a level boundary AND the thing that cuts a queen's ray, but it
 * is never a piece — it must not be drawn as one.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GameBoard } from "@/lib/game/game-board";
import { cellCenter, pieceWidth } from "@/lib/game/board-geometry";
import { isQueensStuck, maxQueens, safeSquares } from "@/lib/game/queens";
import { getQueenMoves } from "@/lib/game/rules/queen";
import { tourStars } from "@/lib/game/tour-score";
import { hapticReject, hapticSuccess, hapticTap } from "@/lib/haptics";
import { THEME_CONFIG } from "@/lib/theme";
import type { BoardPosition, Exercise } from "@/lib/game/types";

const QUEEN_SRC = `${THEME_CONFIG.piecesBase}/w-queen.png`;
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

export function QueensBoard({
  level,
  onComplete,
  onBandChange,
  showSafeSquares = false,
}: {
  level: Exercise;
  /** Fired once when the run ends, with the coverage the host must grade.
   *  Reports (placed, ceiling) rather than a move count — naming it "moves" is
   *  what invites the next reader to reach for labyrinthStars, which cannot
   *  grade this. `placed` counts the level's own queen, so a full clear is
   *  placed === ceiling. */
  onComplete?: (placed: number, ceiling: number) => void;
  /** Hoists the status line to the host's mission band. Unlike the tour's, this
   *  reports the count as DATA rather than baked into the message: the host's
   *  chip owns the counter, which leaves the 30px band strip for the objective
   *  instead of truncating it away. */
  onBandChange?: (band: {
    message: string;
    phase: string;
    placed: number;
    ceiling: number;
  }) => void;
  /** Light up every safe square.
   *
   *  ⚠️ OFF in the game, and that is the whole design (founder, 2026-07-16).
   *  For the Knight's Tour, marking the legal jumps teaches the L — the rule IS
   *  the lesson, and planning the tour stays hard. Here "which squares are safe"
   *  is not a hint, it is THE PUZZLE: light them up and the player stops
   *  thinking and taps the dot. The spec already said so and I misread it —
   *  "reject it, no penalty, retry freely" only means anything if the player has
   *  to reason and risk being wrong.
   *
   *  Kept as an opt-in for AUTHORING (the builder, the /dev probe's toggle),
   *  where seeing the safe set at a glance is exactly the point. */
  showSafeSquares?: boolean;
}) {
  const t = useTranslations("QUEENS_COPY.band");
  const START = level.startPos;
  // Memoised on the level's own array identity: everything below depends on
  // BLOCKS, and `level.obstacles ?? []` would mint a new [] on every render and
  // invalidate the ceiling memo — which is the one thing here that is expensive.
  const BLOCKS = useMemo(() => level.obstacles ?? [], [level.obstacles]);

  const [queens, setQueens] = useState<BoardPosition[]>([START]);
  const [selected, setSelected] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [transient, setTransient] = useState<string | null>(null);
  const [pieceHint, setPieceHint] = useState(false);
  /** The square the player was just refused, for the attack beat. */
  const [refused, setRefused] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beatTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  /**
   * The exact ceiling, and the denominator of the score. The catalog already
   * stored it as level.optimalMoves + 1, but the board recomputes rather than
   * reading it back: the /dev probe hands this component hand-written levels
   * that never crossed the importer.
   *
   * ⚠️ Memoised, unlike the tour's `reachableSquares` — this is a backtracking
   * search, not a BFS. Recomputing it on every keystroke of state would put an
   * exhaustive solve between the player's tap and the queen appearing.
   */
  const CEILING = useMemo(() => maxQueens([START], BLOCKS), [START, BLOCKS]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      if (beatTimer.current) clearTimeout(beatTimer.current);
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
      const onQueen = queens.some((q) => same(q, pos));

      if (!selected) {
        if (onQueen) {
          setSelected(true);
          setPhase("selected");
          setTransient(null);
          setPieceHint(false);
          hapticTap();
        } else {
          hapticReject();
          flash(t("tapQueenFirst"));
          setPieceHint(true);
          if (hintTimer.current) clearTimeout(hintTimer.current);
          hintTimer.current = setTimeout(() => setPieceHint(false), 2200);
        }
        return;
      }
      if (onQueen) return;

      if (BLOCKS.some((b) => same(b, pos))) {
        hapticReject();
        flash(t("blocked"));
        return;
      }

      const safe = safeSquares(queens, BLOCKS);
      if (!safe.some((s) => same(s, pos))) {
        // Refused, not punished: show WHO is watching and leave the board be.
        hapticReject();
        flash(t("illegal"));
        setRefused(sq);
        if (beatTimer.current) clearTimeout(beatTimer.current);
        beatTimer.current = setTimeout(() => setRefused(null), 1400);
        return;
      }

      const nextQueens = [...queens, pos];
      setQueens(nextQueens);
      setRefused(null);
      hapticTap();

      if (isQueensStuck(nextQueens, BLOCKS)) {
        hapticSuccess();
        setPhase("done");
        setSelected(false);
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.(nextQueens.length, CEILING);
        }
      }
    },
    [phase, selected, queens, t, BLOCKS, CEILING, onComplete],
  );

  const placed = queens.length;
  const pct = CEILING > 0 ? Math.round((placed / CEILING) * 100) : 0;
  const stars = phase === "done" ? tourStars(placed, CEILING) : 0;
  const safe = useMemo(
    () =>
      showSafeSquares && phase === "selected" ? safeSquares(queens, BLOCKS) : [],
    [showSafeSquares, phase, queens, BLOCKS],
  );
  const safeLabels = new Set(safe.map(LABEL));
  const queenLabels = new Set(queens.map(LABEL));

  /** While the beat is up: the queens that can actually see the refused square.
   *  Naming the attackers is the lesson — a bare buzz teaches nothing. */
  const attackers = useMemo(() => {
    if (!refused) return new Set<string>();
    const target = parse(refused);
    return new Set(
      queens
        .filter((q) => getQueenMoves(q, [...BLOCKS]).some((m) => same(m, target)))
        .map(LABEL),
    );
  }, [refused, queens, BLOCKS]);

  const bandMessage =
    phase === "idle" ? t("tapQueen") : phase === "done" ? t("done") : t("choose");

  /* What the band SAYS — the objective, or why the last tap was refused. The
     count is NOT in here: the host's chip carries it, so this 30px strip does
     not have to choose between the number and the sentence. It used to carry
     both and truncated the objective away, which is the one thing a player who
     is stuck needs to read (founder, 2026-07-16). */
  const bandText = (transient ?? bandMessage) + (phase === "done" ? ` · ${"★".repeat(stars)}` : "");

  useEffect(() => {
    onBandChange?.({ message: bandText, phase, placed, ceiling: CEILING });
  }, [bandText, phase, placed, CEILING, onBandChange]);

  const renderCell = (_file: number, _rank: number, sq: string) => {
    const p = parse(sq);
    const dark = (p.file + p.rank) % 2 === 1;
    const isBlock = BLOCKS.some((b) => LABEL(b) === sq);
    const isSafe = safeLabels.has(sq);
    return (
      <span
        aria-hidden="true"
        className={[
          "playhub-board-cell",
          dark ? "is-dark" : "is-light",
          isBlock ? "is-wall" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ position: "absolute", inset: 0 }}
      >
        {isSafe ? (
          <span
            data-testid={`q-spark-${sq}`}
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
        {refused === sq ? (
          <span
            data-testid={`q-attack-${sq}`}
            style={{
              position: "absolute",
              inset: "18%",
              borderRadius: "9999px",
              border: "3px solid rgba(255,80,80,0.95)",
              boxShadow: "0 0 12px 4px rgba(255,70,70,0.55)",
            }}
          />
        ) : null}
        {attackers.has(sq) ? (
          <span
            data-testid={`q-attacker-${sq}`}
            style={{
              position: "absolute",
              inset: "6%",
              borderRadius: "9999px",
              border: "3px solid rgba(255,170,60,0.95)",
            }}
          />
        ) : null}
      </span>
    );
  };

  const overlay = () => (
    <>
      {queens.map((q) => {
        const c = cellCenter(q.file, q.rank);
        return (
          <picture
            key={LABEL(q)}
            data-testid={`q-queen-${LABEL(q)}`}
            className="playhub-board-piece-float"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: `${pieceWidth()}%`,
              pointerEvents: "none",
            }}
          >
            <img
              src={QUEEN_SRC}
              alt=""
              className="playhub-board-piece-img"
              style={{ width: "100%" }}
            />
          </picture>
        );
      })}
      {pieceHint ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="q-piece-hint"
          className="playhub-board-select-hint"
          data-placement={hintPlacement(START.file)}
          style={{
            left: `${cellCenter(START.file, START.rank).x}%`,
            top: `${cellCenter(START.file, START.rank).y}%`,
          }}
        >
          {t("tapQueenFirst")}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Local band — only when the host is not hosting the line itself. */}
      {!onBandChange && (
        <div
          data-testid="q-band"
          data-phase={phase}
          className="mx-auto w-full max-w-[23.5rem] rounded-lg border border-amber-300/40 bg-amber-100/95 px-3 py-1.5 text-[#3f2208]"
        >
          {/* The probe has no mission chip, so the local band shows the count
              the host's chip would own. Same numbers, one source. */}
          <div className="text-xs leading-tight" data-testid="q-band-msg">
            {`${placed}/${CEILING} · ${pct}% · ${bandText}`}
          </div>
        </div>
      )}
      <div
        className="playhub-board-canvas"
        data-testid="q-board"
        style={{
          width: "min(100%, 23.5rem)",
          aspectRatio: "1 / 1",
          margin: "0 auto",
        }}
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
