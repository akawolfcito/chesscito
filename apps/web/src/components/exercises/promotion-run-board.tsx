"use client";

/**
 * Promotion Run board — the pawn's game, for Special Training levels of
 * kind:"promotion-run". Sibling of <SafePathBoard>: same <GameBoard> geometry,
 * same `.playhub-board-*` visuals, same "owns no chrome" contract (the status
 * line is hoisted to the host's mission band via `onBandChange`), same
 * walk-in-and-die rule (D4) — a watched square is TAPPABLE, and standing on it
 * ends the run.
 *
 * Three things are NOT shared with the king's board, and they are the game:
 *
 * 1. **The attack map is LIVE** (P2). Safe Path computes it once per level
 *    because its enemies are untouchable (D1). Here the pawn EATS them, and a
 *    dead piece stops watching — so the map is a function of the SURVIVORS and
 *    is recomputed per position. A level can hang its only route on exactly
 *    this: `pawn-promotion-*` promote on squares that were fatal until the
 *    piece watching them was taken.
 * 2. **The black pieces are victims and eyes at once.** The same rook is the
 *    thing that kills you and the step you need. There is no such duality in
 *    any other board in the lane.
 * 3. **There is no target square.** The pawn wins by reaching a RANK — this is
 *    a targetless kind (`isTargetlessKind`), and `level.targetPos` is scenery
 *    the catalog fills with the start. Do not read it.
 *
 * ⚠️ The watched squares are NOT drawn (D2), same call as Safe Path and the
 * queens' safe-square dots: the enemies are right there on the board, so the map
 * is a DEDUCTION, and painting it does the reading for the player. Founder,
 * 2026-07-16: "la idea es que aprenda con el juego lúdico y que esté obligado a
 * pensar, no a que se le dé la respuesta". `showWatched` is for AUTHORING only —
 * the /dev probe and the builder (D3) — where it draws the LIVE map, because a
 * map frozen at the start would lie the moment the pawn eats something, and
 * that is precisely what the levels are built around.
 *
 * ⚠️ No stars here, deliberately. Every winning run measures `7 - startRank` —
 * a pawn advances exactly one rank per move, so the easiest and hardest routes
 * are the same LENGTH and `labyrinthStars` would hand 3★ to anyone who wins.
 * The board reports (moves, optimal) and says nothing about grade; what the
 * stars should measure is an open product decision for stage 10.
 *
 * Spec: docs/specs/2026-07-16-safe-path-promotion-run-plan.md §3.3-§3.4,
 * §4 stage 9.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { GameBoard } from "@/lib/game/game-board";
import { cellCenter, pickHintPlacement, pieceWidth } from "@/lib/game/board-geometry";
import { BOARD_HINT_COPY } from "@/lib/content/editorial";
import { attackedSquares } from "@/lib/game/attack-map";
import { isPawnCaught, legalPawnMoves } from "@/lib/game/promotion-run";
import { hapticReject, hapticSuccess, hapticTap } from "@/lib/haptics";
import { useThemePieceAssets } from "@/lib/themes/piece-theme-assets";
import type { TypedEnemy } from "@/lib/game/fen-puzzle";
import type { BoardPosition, Exercise, PieceId } from "@/lib/game/types";

/** White pawn: the last rank is the crown. Mirrors `promotion-run.ts`. */
const PROMOTION_RANK = 7;
const SELECT_HINT_DURATION_MS = 2200;
const LABEL = (p: BoardPosition) => `${"abcdefgh"[p.file]}${p.rank + 1}`;
const parse = (s: string): BoardPosition => ({
  file: "abcdefgh".indexOf(s[0]),
  rank: Number(s[1]) - 1,
});
const same = (a: BoardPosition, b: BoardPosition) =>
  a.file === b.file && a.rank === b.rank;

/** `caught` is a real phase, not a transient: the run is over until the host
 *  (or the probe) resets it. Same shape as Safe Path's, because stage 10 reuses
 *  the king's failure path verbatim. */
type Phase = "playing" | "caught" | "done";

export function PromotionRunBoard({
  level,
  onComplete,
  onCaught,
  onBandChange,
  showWatched = false,
  resetKey = 0,
}: {
  level: Exercise;
  /** Fired once when the pawn reaches the last rank alive, with (moves,
   *  optimal). ⚠️ The host must NOT feed this to `labyrinthStars` without
   *  deciding what a star means here — see the module docblock. Stage 10 owns
   *  the promotion picker and `mission.promoteTo`; the board reports arrival. */
  onComplete?: (moves: number, optimal: number) => void;
  /** Fired when the pawn lands on a square a SURVIVING enemy watches. The host
   *  owns what happens next — the TRY AGAIN overlay, the shield offer — and
   *  resets the board by bumping `resetKey`. */
  onCaught?: (caughtOn: string) => void;
  /** Hoists the status line to the host's mission band. */
  onBandChange?: (band: {
    message: string;
    phase: Phase;
    moves: number;
    optimal: number;
  }) => void;
  /** Draw the watched squares of the SURVIVING enemies. ⚠️ OFF in the game —
   *  see the module docblock. ON for authoring: the /dev probe and the builder
   *  (D3). */
  showWatched?: boolean;
  /** Bump to send the pawn back to the start — and the eaten pieces back onto
   *  the board with it. */
  resetKey?: number;
}) {
  const t = useTranslations("PROMOTION_RUN_COPY.band");
  const pieceAssets = useThemePieceAssets();
  const START = level.startPos;
  // Memoised on the level's own array identity: `level.enemies ?? []` would mint
  // a new [] every render.
  const START_ENEMIES = useMemo(() => level.enemies ?? [], [level.enemies]);
  const WALLS = useMemo(() => level.obstacles ?? [], [level.obstacles]);

  const [pawn, setPawn] = useState<BoardPosition>(START);
  /** ⚠️ STATE, unlike Safe Path's constant: the pawn eats, and what it ate is
   *  gone from the board AND from the map. This single difference is why the
   *  king's board could memoise `WATCHED` per level and this one cannot. */
  const [enemies, setEnemies] = useState<readonly TypedEnemy[]>(START_ENEMIES);
  const [moves, setMoves] = useState(0);
  const [phase, setPhase] = useState<Phase>("playing");
  /** The square the pawn died on, for the attack beat. */
  const [caughtOn, setCaughtOn] = useState<string | null>(null);
  /** The pawn starts UNSELECTED and deselects after every move, exactly like
   *  <Board> and <SafePathBoard>: tap the piece, tap the square. The player
   *  moves THAT pawn, so the gate is the rule, not a toll. */
  const [selected, setSelected] = useState(false);
  const [showSelectHint, setShowSelectHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const completedRef = useRef(false);

  useEffect(() => () => {
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  /** The LIVE map: keyed on the survivors, so a capture redraws the danger.
   *  The killers the pawn already ate are not in here. */
  const WATCHED = useMemo(
    () => attackedSquares(enemies, WALLS),
    [enemies, WALLS],
  );

  /* Back to the start — pawn AND victims. Losing late costs the whole run. */
  useEffect(() => {
    setPawn(START);
    setEnemies(START_ENEMIES);
    setMoves(0);
    setPhase("playing");
    setCaughtOn(null);
    setSelected(false);
    completedRef.current = false;
  }, [resetKey, START, START_ENEMIES]);

  const handleCell = useCallback(
    (sq: string) => {
      if (phase !== "playing") return;
      const pos = parse(sq);

      // Tapped the pawn: pick it up. Already selected → ignore, so a fat-finger
      // re-tap never silently drops the selection.
      if (same(pos, pawn)) {
        if (!selected) {
          setSelected(true);
          hapticTap();
        }
        if (hintTimer.current) clearTimeout(hintTimer.current);
        setShowSelectHint(false);
        return;
      }

      // Nothing is picked up yet. Say so next to the piece rather than doing
      // nothing — a silent board is what made first-timers keep tapping.
      if (!selected) {
        if (hintTimer.current) clearTimeout(hintTimer.current);
        setShowSelectHint(true);
        hintTimer.current = setTimeout(() => {
          setShowSelectHint(false);
          hintTimer.current = null;
        }, SELECT_HINT_DURATION_MS);
        return;
      }

      const legal = legalPawnMoves({ pawn, enemies }, WALLS);
      const move = legal.find((m) => same(m.to, pos));
      if (!move) {
        setSelected(false);
        return;
      }

      // The survivors, computed BEFORE the danger check: the piece it just took
      // is not watching it from the square it took it on. `move.captures` names
      // the victim so this never has to be re-derived — and re-derived wrong.
      const survivors = move.captures
        ? enemies.filter((e) => !same(e.pos, move.captures!))
        : enemies;

      setPawn(pos);
      setEnemies(survivors);
      setSelected(false);
      const next = moves + 1;
      setMoves(next);

      if (isPawnCaught({ pawn: pos, enemies: survivors }, WALLS)) {
        hapticReject();
        setPhase("caught");
        setCaughtOn(sq);
        onCaught?.(sq);
        return;
      }

      // The crown. A rank, not a square — there is no target here.
      if (pos.rank === PROMOTION_RANK) {
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
    [phase, pawn, enemies, selected, moves, WALLS, level.optimalMoves, onComplete, onCaught],
  );

  /** While the beat is up: which SURVIVING enemies can see the square it died
   *  on. Naming the killer is the lesson — a red flash teaches nothing. */
  const killers = useMemo(() => {
    if (!caughtOn) return [];
    const target = parse(caughtOn);
    return enemies.filter((e) => attackedSquares([e], WALLS).has(LABEL(target)));
  }, [caughtOn, enemies, WALLS]);

  const killerLabels = new Set(killers.map((e) => LABEL(e.pos)));

  /** One laser per killer, drawn from its centre to the square it died on.
   *  Same geometry as Safe Path's: `cellCenter` returns screen-oriented
   *  percentages, so length is a Euclidean distance in % and the angle is
   *  atan2 — no layout measurement, no refs, no rAF. */
  const beams = useMemo(() => {
    if (!caughtOn) return [];
    const target = parse(caughtOn);
    const to = cellCenter(target.file, target.rank);
    return killers.map((e) => {
      const from = cellCenter(e.pos.file, e.pos.rank);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      return {
        key: LABEL(e.pos),
        left: from.x,
        top: from.y,
        length: Math.hypot(dx, dy),
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      };
    });
  }, [caughtOn, killers]);

  const bandText =
    phase === "done" ? t("done") : phase === "caught" ? t("caught") : t("walk");

  useEffect(() => {
    onBandChange?.({ message: bandText, phase, moves, optimal: level.optimalMoves });
  }, [bandText, phase, moves, level.optimalMoves, onBandChange]);

  /** Only once it is picked up: the highlights are the answer to "where can this
   *  piece go", and that question is only asked after you pick it up. */
  const legalNow = useMemo(
    () =>
      phase === "playing" && selected
        ? legalPawnMoves({ pawn, enemies }, WALLS).map((m) => m.to)
        : [],
    [phase, selected, pawn, enemies, WALLS],
  );
  const legalLabels = new Set(legalNow.map(LABEL));
  const enemyLabels = new Set(enemies.map((e) => LABEL(e.pos)));

  const renderCell = (_file: number, _rank: number, sq: string) => {
    const p = parse(sq);
    const dark = (p.file + p.rank) % 2 === 1;
    const isWall = WALLS.some((w) => LABEL(w) === sq);
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
            data-testid={`pr-watched-${sq}`}
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(255,70,70,0.28)",
              boxShadow: "inset 0 0 0 1px rgba(255,70,70,0.5)",
            }}
          />
        ) : null}
        {caughtOn === sq ? (
          <span
            data-testid={`pr-caught-${sq}`}
            style={{
              position: "absolute",
              inset: "10%",
              borderRadius: "9999px",
              border: "3px solid rgba(255,60,60,0.95)",
              boxShadow: "0 0 14px 5px rgba(255,60,60,0.6)",
            }}
          />
        ) : null}
        {killerLabels.has(sq) ? (
          <span
            data-testid={`pr-killer-${sq}`}
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
      {/* The shot. Drawn before the pieces so it passes UNDER them. */}
      {beams.map((beam) => (
        <span
          key={`beam-${beam.key}`}
          aria-hidden="true"
          data-testid={`pr-beam-${beam.key}`}
          className="playhub-board-laser"
          style={{
            left: `${beam.left}%`,
            top: `${beam.top}%`,
            width: `${beam.length}%`,
            transform: `rotate(${beam.angle}deg)`,
          }}
        />
      ))}
      {enemies.map((e) => {
        if (!pieceAssets.b[e.piece]) return null;
        const c = cellCenter(e.pos.file, e.pos.rank);
        return (
          <picture
            key={`e-${LABEL(e.pos)}`}
            data-testid={`pr-enemy-${LABEL(e.pos)}`}
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
              src={`${pieceAssets.b[e.piece]}.png`}
              alt=""
              className="playhub-board-piece-img"
              style={{ width: "100%" }}
            />
          </picture>
        );
      })}
      {pieceAssets.w.pawn ? <picture
        data-testid={`pr-pawn-${LABEL(pawn)}`}
        data-selected={selected ? "true" : "false"}
        className={`playhub-board-piece-float${selected ? " is-selected" : ""}`}
        style={{
          left: `${cellCenter(pawn.file, pawn.rank).x}%`,
          top: `${cellCenter(pawn.file, pawn.rank).y}%`,
          width: `${pieceWidth()}%`,
          pointerEvents: "none",
          filter: phase === "caught" ? "grayscale(1) brightness(0.6)" : undefined,
        }}
      >
        <img
          src={`${pieceAssets.w.pawn}.png`}
          alt=""
          className="playhub-board-piece-img"
          style={{ width: "100%" }}
        />
      </picture> : null}
      {showSelectHint ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="pr-select-hint"
          className="playhub-board-select-hint"
          data-placement={pickHintPlacement(pawn.file, pawn.rank)}
          style={{
            left: `${cellCenter(pawn.file, pawn.rank).x}%`,
            top: `${cellCenter(pawn.file, pawn.rank).y}%`,
          }}
        >
          {BOARD_HINT_COPY.selectPieceFirst}
        </div>
      ) : null}
    </>
  );

  return (
    <div className="flex w-full flex-col gap-2">
      {/* Local band — only when the host is not hosting the line itself. */}
      {!onBandChange && (
        <div
          data-testid="pr-band"
          data-phase={phase}
          className="mx-auto w-full max-w-[23.5rem] rounded-lg border border-amber-300/40 bg-amber-100/95 px-3 py-1.5 text-[#3f2208]"
        >
          <div className="text-xs leading-tight" data-testid="pr-band-msg">
            {`${moves}/${level.optimalMoves} · ${bandText}`}
          </div>
        </div>
      )}
      <div
        className="playhub-board-canvas"
        data-testid="pr-board"
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
