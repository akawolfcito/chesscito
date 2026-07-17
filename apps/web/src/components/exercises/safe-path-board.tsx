"use client";

/**
 * Safe Path board — the king's game, for Special Training levels of
 * kind:"safe-path". Sibling of <QueensBoard> and <KnightTourBoard>: same
 * <GameBoard> geometry, same `.playhub-board-*` visuals, same "owns no chrome"
 * contract (the status line is hoisted to the host's mission band via
 * `onBandChange`).
 *
 * The founder's model, and the whole reason this is not a labyrinth:
 *
 *   "un laberinto de peligro, no necesariamente de muros. No sería 'no puedes
 *    pasar porque hay una pared' sino 'puedes pasar físicamente por ahí, pero es
 *    una zona vigilada, así que no debes hacerlo'."
 *
 * So a watched square is TAPPABLE. The king walks in, the attack fires, and the
 * run is over (D4) — the board does not refuse the move. That is the opposite of
 * <QueensBoard>, where an illegal tap is rejected and costs nothing, and the
 * difference is deliberate: the queen is learning where an eye reaches, the king
 * is learning not to walk into one.
 *
 * ⚠️ The watched squares are NOT drawn (D2). They are a DEDUCTION — the enemy
 * pieces are right there on the board — and painting them would do the reading
 * for the player, which is the skill the game teaches. Same call the founder
 * made for the queens' safe-square dots. `showWatched` exists for AUTHORING
 * only (the /dev probe, the builder), where seeing the map at a glance is the
 * entire point (D3).
 *
 * Enemies are drawn as the real black pieces, because the FEN carries the type
 * and the art can finally tell the truth (stage 1). Walls stay stone tiles.
 *
 * Spec: docs/specs/2026-07-16-safe-path-promotion-run-plan.md §3, §4 stage 5.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GameBoard } from "@/lib/game/game-board";
import { cellCenter, pieceWidth } from "@/lib/game/board-geometry";
import { attackedSquares } from "@/lib/game/attack-map";
import { isCaught, legalKingSteps } from "@/lib/game/safe-path";
import { labyrinthStars } from "@/lib/game/exercises";
import { hapticReject, hapticSuccess, hapticTap } from "@/lib/haptics";
import { THEME_CONFIG } from "@/lib/theme";
import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";

const KING_SRC = `${THEME_CONFIG.piecesBase}/w-king.png`;
const enemySrc = (piece: PieceId) => `${THEME_CONFIG.piecesBase}/b-${piece}.png`;
const LABEL = (p: BoardPosition) => `${"abcdefgh"[p.file]}${p.rank + 1}`;
const parse = (s: string): BoardPosition => ({
  file: "abcdefgh".indexOf(s[0]),
  rank: Number(s[1]) - 1,
});
const same = (a: BoardPosition, b: BoardPosition) =>
  a.file === b.file && a.rank === b.rank;

/** `caught` is a real phase, not a transient: the run is over until the host
 *  (or the probe) resets it. The tour and queens have no such state — they
 *  cannot be lost, only ended. */
type Phase = "playing" | "caught" | "done";

export function SafePathBoard({
  level,
  onComplete,
  onCaught,
  onBandChange,
  showWatched = false,
  resetKey = 0,
}: {
  level: Exercise;
  /** Fired once when the king reaches the refuge, with (moves, optimal).
   *  Arrival-graded: the host grades this with labyrinthStars, never tourStars —
   *  LOWER IS BETTER here, the exact opposite of the coverage games' number. */
  onComplete?: (moves: number, optimal: number) => void;
  /** Fired when the king steps onto a watched square (D4). The host owns what
   *  happens next — the TRY AGAIN overlay, the shield offer — and resets the
   *  board by bumping `resetKey`. The board itself never decides the penalty. */
  onCaught?: (caughtOn: string) => void;
  /** Hoists the status line to the host's mission band. */
  onBandChange?: (band: {
    message: string;
    phase: Phase;
    moves: number;
    optimal: number;
  }) => void;
  /** Draw the watched squares. ⚠️ OFF in the game — see the module docblock.
   *  ON for authoring: the /dev probe and the builder (D3). */
  showWatched?: boolean;
  /** Bump to send the king back to the start (D5). The host bumps it after the
   *  player takes the shield or waves the modal away; the probe bumps it from
   *  its own reset button. */
  resetKey?: number;
}) {
  const t = useTranslations("SAFE_PATH_COPY.band");
  const START = level.startPos;
  const REFUGE = level.targetPos;
  // Memoised on the level's own array identity: `level.enemies ?? []` would mint
  // a new [] every render and re-run the attack map, which is the one thing here
  // worth not recomputing.
  const ENEMIES = useMemo(() => level.enemies ?? [], [level.enemies]);
  const WALLS = useMemo(() => level.obstacles ?? [], [level.obstacles]);

  const [king, setKing] = useState<BoardPosition>(START);
  const [moves, setMoves] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  /** The square the king died on, for the attack beat. */
  const [caughtOn, setCaughtOn] = useState<string | null>(null);
  const completedRef = useRef(false);

  /** Constant for the level: the enemies are static and untouchable (D1), so the
   *  danger never moves and this is computed once rather than per step. */
  const WATCHED = useMemo(
    () => attackedSquares(ENEMIES, WALLS),
    [ENEMIES, WALLS],
  );

  /* Back to the start (D5). Losing on step 9 of 10 costs the whole run —
     founder: "ni modo". */
  useEffect(() => {
    setKing(START);
    setMoves(0);
    setPhase("playing");
    setCaughtOn(null);
    completedRef.current = false;
  }, [resetKey, START]);

  const handleCell = useCallback(
    (sq: string) => {
      if (phase !== "playing") return;
      const pos = parse(sq);
      if (same(pos, king)) return;

      // Not a king step, a wall, or an enemy: nothing happened. No scolding —
      // the geometry is not the lesson here.
      const legal = legalKingSteps(king, ENEMIES, WALLS);
      if (!legal.some((p) => same(p, pos))) return;

      setKing(pos);
      const next = moves + 1;
      setMoves(next);

      // The danger maze: the step was legal, and it kills him.
      if (isCaught(pos, ENEMIES, WALLS)) {
        hapticReject();
        setPhase("caught");
        setCaughtOn(sq);
        onCaught?.(sq);
        return;
      }

      if (same(pos, REFUGE)) {
        hapticSuccess();
        setPhase("done");
        if (!completedRef.current) {
          completedRef.current = true;
          onComplete?.(next, level.optimalMoves);
        }
        return;
      }

      hapticTap();
    },
    [phase, king, moves, ENEMIES, WALLS, REFUGE, level.optimalMoves, onComplete, onCaught],
  );

  const stars = phase === "done" ? labyrinthStars(moves, level.optimalMoves) : 0;

  /** While the beat is up: which enemies can actually see the square he died on.
   *  Naming the killer is the lesson — a red flash teaches nothing. */
  const killers = useMemo(() => {
    if (!caughtOn) return new Set<string>();
    const target = parse(caughtOn);
    return new Set(
      ENEMIES.filter((e) =>
        attackedSquares([e], WALLS).has(LABEL(target)),
      ).map((e) => LABEL(e.pos)),
    );
  }, [caughtOn, ENEMIES, WALLS]);

  const bandText =
    phase === "done"
      ? `${t("done")} · ${"★".repeat(stars)}`
      : phase === "caught"
        ? t("caught")
        : t("walk");

  useEffect(() => {
    onBandChange?.({ message: bandText, phase, moves, optimal: level.optimalMoves });
  }, [bandText, phase, moves, level.optimalMoves, onBandChange]);

  const legalNow = useMemo(
    () => (phase === "playing" ? legalKingSteps(king, ENEMIES, WALLS) : []),
    [phase, king, ENEMIES, WALLS],
  );
  const legalLabels = new Set(legalNow.map(LABEL));
  const enemyLabels = new Set(ENEMIES.map((e) => LABEL(e.pos)));

  const renderCell = (_file: number, _rank: number, sq: string) => {
    const p = parse(sq);
    const dark = (p.file + p.rank) % 2 === 1;
    const isWall = WALLS.some((w) => LABEL(w) === sq);
    const isRefuge = LABEL(REFUGE) === sq;
    // Authoring only. In the game this is always false, and that is the design.
    const isWatched = showWatched && WATCHED.has(sq) && !enemyLabels.has(sq);
    return (
      <span
        aria-hidden="true"
        className={[
          "playhub-board-cell",
          dark ? "is-dark" : "is-light",
          isWall ? "is-wall" : "",
          legalLabels.has(sq) ? "is-highlighted" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ position: "absolute", inset: 0 }}
      >
        {isWatched ? (
          <span
            data-testid={`sp-watched-${sq}`}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,70,70,0.28)",
              boxShadow: "inset 0 0 0 1px rgba(255,70,70,0.5)",
            }}
          />
        ) : null}
        {isRefuge ? (
          <span
            data-testid={`sp-refuge-${sq}`}
            style={{
              position: "absolute",
              inset: "22%",
              borderRadius: "9999px",
              border: "3px solid rgba(120,235,150,0.95)",
              boxShadow: "0 0 12px 3px rgba(110,230,140,0.5)",
            }}
          />
        ) : null}
        {caughtOn === sq ? (
          <span
            data-testid={`sp-caught-${sq}`}
            style={{
              position: "absolute",
              inset: "10%",
              borderRadius: "9999px",
              border: "3px solid rgba(255,60,60,0.95)",
              boxShadow: "0 0 14px 5px rgba(255,60,60,0.6)",
            }}
          />
        ) : null}
        {killers.has(sq) ? (
          <span
            data-testid={`sp-killer-${sq}`}
            style={{
              position: "absolute",
              inset: "4%",
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
      {ENEMIES.map((e) => {
        const c = cellCenter(e.pos.file, e.pos.rank);
        return (
          <picture
            key={`e-${LABEL(e.pos)}`}
            data-testid={`sp-enemy-${LABEL(e.pos)}`}
            data-piece={e.piece}
            className="playhub-board-piece-float"
            style={{
              left: `${c.x}%`,
              top: `${c.y}%`,
              width: `${pieceWidth()}%`,
              pointerEvents: "none",
            }}
          >
            <img
              src={enemySrc(e.piece)}
              alt=""
              className="playhub-board-piece-img"
              style={{ width: "100%" }}
            />
          </picture>
        );
      })}
      <picture
        data-testid={`sp-king-${LABEL(king)}`}
        className="playhub-board-piece-float"
        style={{
          left: `${cellCenter(king.file, king.rank).x}%`,
          top: `${cellCenter(king.file, king.rank).y}%`,
          width: `${pieceWidth()}%`,
          pointerEvents: "none",
          filter: phase === "caught" ? "grayscale(1) brightness(0.6)" : undefined,
        }}
      >
        <img
          src={KING_SRC}
          alt=""
          className="playhub-board-piece-img"
          style={{ width: "100%" }}
        />
      </picture>
    </>
  );

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Local band — only when the host is not hosting the line itself. */}
      {!onBandChange && (
        <div
          data-testid="sp-band"
          data-phase={phase}
          className="mx-auto w-full max-w-[23.5rem] rounded-lg border border-amber-300/40 bg-amber-100/95 px-3 py-1.5 text-[#3f2208]"
        >
          <div className="text-xs leading-tight" data-testid="sp-band-msg">
            {`${moves}/${level.optimalMoves} · ${bandText}`}
          </div>
        </div>
      )}
      <div
        className="playhub-board-canvas"
        data-testid="sp-board"
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
