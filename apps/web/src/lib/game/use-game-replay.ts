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
 */
export function useGameReplay(moves: readonly string[], startingFen?: string): GameReplayState {
  const { fenList, error } = useMemo(() => {
    const game = new Chess(startingFen ?? undefined);
    // Preserve the caller-supplied FEN verbatim as index 0 rather than
    // re-serialising via game.fen(), which normalises en-passant squares
    // (chess.js strips ep squares when no capturing pawn exists).
    const out: string[] = [startingFen ?? game.fen()];
    let err: GameReplayError | undefined;
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
