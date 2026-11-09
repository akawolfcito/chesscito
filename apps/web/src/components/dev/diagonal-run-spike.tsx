"use client";

/**
 * Diagonal Run — one-level DEV spike (Gate D2, corrected pivot model).
 * Self-contained probe: reuses the canonical <GameBoard> geometry + the
 * `.playhub-board-*` visuals (including the exact selection zoom via
 * `.playhub-board-piece-float.is-selected`), but owns the turn interaction.
 *
 * Level: a1 → g1, friendly knight on e5 (optimalMoves = 1, the pivot d4).
 * One turn = one tap on a PIVOT square: the bishop slides to it, pauses, then
 * TURNS onto a perpendicular diagonal and slides to the star (capture), one
 * square before a blocker, or the edge. If a perpendicular points at the star it
 * captures; otherwise the game auto-picks the exit (soft heuristic).
 */

import { useCallback, useRef, useState } from "react";
import { GameBoard } from "@/lib/game/game-board";
import { cellCenter, pieceWidth } from "@/lib/game/board-geometry";
import {
  pivotBfs,
  reachablePivots,
  resolvePivot,
} from "@/lib/game/diagonal-run";
import { labyrinthStars } from "@/lib/game/exercises";
import { hapticReject, hapticSuccess, hapticTap } from "@/lib/haptics";
import { THEME_CONFIG } from "@/lib/theme";
import type { BoardPosition } from "@/lib/game/types";

const BISHOP_SRC = `${THEME_CONFIG.piecesBase}/w-bishop.png`;
const KNIGHT_SRC = `${THEME_CONFIG.piecesBase}/w-knight.png`;

const SQ = (s: string): BoardPosition => ({
  file: "abcdefgh".indexOf(s[0]),
  rank: Number(s[1]) - 1,
});
const LABEL = (p: BoardPosition) => `${"abcdefgh"[p.file]}${p.rank + 1}`;
const same = (a: BoardPosition, b: BoardPosition) =>
  a.file === b.file && a.rank === b.rank;

/** Same placement rule the canonical board uses so the bubble never clips. */
function hintPlacement(file: number): "left" | "right" | "top" {
  if (file <= 1) return "right";
  if (file >= 6) return "left";
  return "top";
}

const START = SQ("a1");
const TARGET = SQ("g1");
const BLOCKERS = [SQ("e5")];
const OPTIMAL = pivotBfs(START, TARGET, BLOCKERS).optimalMoves; // 1
const APPROACH_MS = 700; // slide to pivot + pause
const EXIT_MS = 560; // turn + slide to landing

type Phase = "idle" | "selected" | "sliding" | "lost" | "won";

const COPY = {
  en: {
    title: "Diagonal Run",
    idle: "Help the bishop reach the star.",
    tapBishop: "Tap the bishop to begin.",
    tapBishopFirst: "Tap your bishop first.",
    choose: "Choose a pivot square.",
    sliding: "Sliding…",
    illegal: "The bishop cannot move there.",
    lost: "This path cannot reach the star. Try again.",
    won: "You found the way!",
    langLabel: "ES",
  },
  es: {
    title: "Carrera diagonal",
    idle: "Ayuda al alfil a llegar a la estrella.",
    tapBishop: "Toca el alfil para comenzar.",
    tapBishopFirst: "Primero toca tu alfil.",
    choose: "Elige una casilla pivote.",
    sliding: "Deslizándose…",
    illegal: "El alfil no puede moverse hasta ahí.",
    lost: "Este camino no llega a la estrella. Inténtalo de nuevo.",
    won: "¡Encontraste el camino!",
    langLabel: "EN",
  },
} as const;

export function DiagonalRunSpike() {
  const [lang, setLang] = useState<"en" | "es">("en");
  const [bishop, setBishop] = useState<BoardPosition>(START);
  const [selected, setSelected] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [movesUsed, setMovesUsed] = useState(0);
  const [marker, setMarker] = useState<BoardPosition | null>(null);
  const [transient, setTransient] = useState<string | null>(null);
  // Contextual bubble anchored to the bishop (same visual as the canonical
  // board's select-hint) — extra guidance for players who need it.
  const [pieceHint, setPieceHint] = useState(false);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const t = COPY[lang];

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setBishop(START);
    setSelected(false);
    setPhase("idle");
    setMovesUsed(0);
    setMarker(null);
    setTransient(null);
    setPieceHint(false);
    if (hintTimer.current) clearTimeout(hintTimer.current);
  }, []);

  const flash = (msg: string) => {
    setTransient(msg);
    timers.current.push(setTimeout(() => setTransient(null), 1400));
  };

  const handleCell = useCallback(
    (sq: string) => {
      if (phase === "sliding" || phase === "lost" || phase === "won") return;
      const pos = SQ(sq); // GameBoard reports rank 1..8; parse the algebraic square

      if (!selected) {
        if (same(pos, bishop)) {
          setSelected(true);
          setPhase("selected");
          setTransient(null);
          setPieceHint(false);
          hapticTap();
        } else {
          hapticReject();
          flash(t.tapBishopFirst);
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
        flash(t.illegal);
        return;
      }

      // Legal pivot: slide to it, pause, then turn + slide to the landing.
      setPhase("sliding");
      setMarker(r.pivot);
      hapticTap();
      setBishop(r.pivot); // approach animation
      const directCapture = r.outcome === "win" && r.exitDir === null;
      timers.current.push(
        setTimeout(() => {
          setMarker(null);
          if (directCapture) {
            hapticSuccess();
            setMovesUsed((m) => m + 1);
            setPhase("won");
            return;
          }
          setBishop(r.landing); // turn + slide
          timers.current.push(
            setTimeout(() => {
              const moves = movesUsed + 1;
              setMovesUsed(moves);
              if (r.outcome === "win") {
                hapticSuccess();
                setPhase("won");
              } else if (pivotBfs(r.landing, TARGET, BLOCKERS).reachable) {
                setPhase("selected"); // stay selected, next turn
              } else {
                setPhase("lost");
                timers.current.push(setTimeout(reset, 1200));
              }
            }, EXIT_MS),
          );
        }, APPROACH_MS),
      );
    },
    [phase, selected, bishop, movesUsed, t, reset],
  );

  const stars = phase === "won" ? labyrinthStars(movesUsed, OPTIMAL) : 0;
  const pivots =
    selected && phase === "selected" ? reachablePivots(bishop, BLOCKERS) : [];
  const pivotLabels = new Set(pivots.map(LABEL));
  const bishopLabel = LABEL(bishop);
  const targetLabel = LABEL(TARGET);

  const bandMessage =
    phase === "idle"
      ? t.idle
      : phase === "selected"
        ? t.choose
        : phase === "sliding"
          ? t.sliding
          : phase === "lost"
            ? t.lost
            : t.won;

  const renderCell = (_file: number, _rank: number, sq: string) => {
    const p = SQ(sq);
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
          const c = cellCenter(b.file, b.rank);
          return (
            <picture
              key={`blk-${LABEL(b)}`}
              className="playhub-board-piece-float is-friendly-blocker"
              style={{ left: `${c.x}%`, top: `${c.y}%`, width: `${pw}%`, pointerEvents: "none" }}
            >
              <img src={KNIGHT_SRC} alt="" aria-hidden="true" className="playhub-board-piece-img" style={{ width: "100%" }} />
            </picture>
          );
        })}
        <picture
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
          <img src={BISHOP_SRC} alt="" className="playhub-board-piece-img" style={{ width: "100%" }} />
        </picture>
        {pieceHint ? (
          <div
            role="status"
            aria-live="polite"
            data-testid="dr-piece-hint"
            className="playhub-board-select-hint"
            data-placement={hintPlacement(bishop.file)}
            style={{ left: `${bc.x}%`, top: `${bc.y}%` }}
          >
            {t.tapBishopFirst}
          </div>
        ) : null}
      </>
    );
  };

  return (
    <div className="mx-auto flex w-full max-w-[390px] flex-col gap-2 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-slate-100">{t.title}</span>
        <button
          type="button"
          onClick={() => setLang((l) => (l === "en" ? "es" : "en"))}
          className="rounded bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-100"
          data-testid="dr-lang"
        >
          {t.langLabel}
        </button>
      </div>

      <div
        data-testid="dr-band"
        data-phase={phase}
        className="w-full rounded-lg border border-amber-300/40 bg-amber-100/95 px-3 py-1.5 text-[#3f2208]"
      >
        <div className="text-sm font-extrabold leading-tight">{t.title}</div>
        <div className="text-xs leading-tight" data-testid="dr-band-msg">
          {transient ?? bandMessage}
          {phase === "idle" ? ` · ${t.tapBishop}` : ""}
          {phase === "won" ? ` · ${movesUsed}/${OPTIMAL} · ${"★".repeat(stars)}` : ""}
          {phase === "selected" && movesUsed > 0 ? ` · ${movesUsed}` : ""}
        </div>
      </div>

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

      {phase === "won" ? (
        <button
          type="button"
          onClick={reset}
          data-testid="dr-retry"
          className="self-center rounded bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
        >
          ↻
        </button>
      ) : null}
    </div>
  );
}
