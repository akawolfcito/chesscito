"use client";

import { useCallback, useMemo, useState } from "react";
import { Chess } from "chess.js";

export type GameReplayError = {
  atIndex: number;
  badSan: string;
};

export type GameReplayState = {
  totalMoves: number;
  lastValidIndex: number;
  currentIndex: number;
  currentFen: string;
  currentMove: { san: string; index: number } | null;
  canPrev: boolean;
  canNext: boolean;
  error?: GameReplayError;
  goPrev: () => void;
  goNext: () => void;
  goTo: (i: number) => void;
  goStart: () => void;
  goEnd: () => void;
};

/**
 * Replay a SAN[] move list into a sequence of FENs. Mirrors the
 * `movesToFen` lazy-with-try/catch precedent: chess.js v1.4.0 throws
 * on illegal moves; we stop at the first failure, expose `error`, and
 * let the viewer render up to lastValidIndex.
 *
 * All returned functions are memoized via useCallback per
 * feedback_hook_ref_stability.md — consumer effects can list them
 * in deps without thrashing arena's 400ms PLAY timer.
 *
 * @remarks
 * This hook is designed for SINGLE-GAME MOUNT. The internal currentIndex
 * state initializes from lastValidIndex on mount and is never auto-reset
 * if the `moves` prop identity changes — if the parent navigates between
 * different games, mount this hook with a `key={gameId}` so React resets
 * its state cleanly.
 *
 * An invalid `startingFen` is treated as a partial-replay error at
 * atIndex -1; the hook falls back to the standard chess.js startpos
 * and exposes `error = { atIndex: -1, badSan: "" }` to signal the bad
 * starting position. Consumers (e.g., GameViewer) render the truncated-
 * replay banner in this case.
 */
export function useGameReplay(moves: readonly string[], startingFen?: string): GameReplayState {
  const { fenList, error } = useMemo(() => {
    let game: Chess;
    let initialFen: string;
    let err: GameReplayError | undefined;
    try {
      game = new Chess(startingFen ?? undefined);
      // Preserve the caller-supplied FEN verbatim as index 0 rather than
      // re-serialising via game.fen(), which normalises en-passant squares
      // (chess.js strips ep squares when no capturing pawn exists).
      initialFen = startingFen ?? game.fen();
    } catch {
      // Invalid startingFen (corrupted Redis record). Fall back to default
      // startpos and flag as an atIndex:-1 partial-replay error so the
      // viewer can render the truncation banner instead of crashing.
      game = new Chess();
      initialFen = game.fen();
      err = { atIndex: -1, badSan: "" };
    }
    const out: string[] = [initialFen];
    if (!err) {
      for (let i = 0; i < moves.length; i++) {
        try {
          const applied = game.move(moves[i]);
          if (!applied) {
            err = { atIndex: i, badSan: moves[i] };
            break;
          }
          out.push(game.fen());
        } catch {
          err = { atIndex: i, badSan: moves[i] };
          break;
        }
      }
    }
    return { fenList: out, error: err };
  }, [moves, startingFen]);

  const lastValidIndex = fenList.length - 1;
  const [currentIndex, setCurrentIndex] = useState(lastValidIndex);

  const clamp = useCallback((i: number) => Math.max(0, Math.min(lastValidIndex, i)), [lastValidIndex]);

  const goTo = useCallback((i: number) => setCurrentIndex(clamp(i)), [clamp]);
  const goPrev = useCallback(() => setCurrentIndex((i) => clamp(i - 1)), [clamp]);
  const goNext = useCallback(() => setCurrentIndex((i) => clamp(i + 1)), [clamp]);
  const goStart = useCallback(() => setCurrentIndex(0), []);
  const goEnd = useCallback(() => setCurrentIndex(lastValidIndex), [lastValidIndex]);

  const safeIndex = clamp(currentIndex);
  const currentFen = fenList[safeIndex];
  const currentMove = safeIndex === 0 ? null : { san: moves[safeIndex - 1], index: safeIndex - 1 };

  return {
    totalMoves: moves.length,
    lastValidIndex,
    currentIndex: safeIndex,
    currentFen,
    currentMove,
    canPrev: safeIndex > 0,
    canNext: safeIndex < lastValidIndex,
    error,
    goPrev,
    goNext,
    goTo,
    goStart,
    goEnd,
  };
}
