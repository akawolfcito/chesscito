"use client";

import { useCallback, useEffect, useState } from "react";
import type { PieceId } from "@/lib/game/types";

/**
 * Per-piece local persistence for the last on-chain score the player
 * has confirmed-submitted. Lives in a separate key from
 * `chesscito:progress:{piece}` so the addendum §2.2 SAVE machine does
 * not have to mutate the strictly-validated `PieceProgress` shape in
 * `use-exercise-progress.ts`.
 *
 * v1 is local-only — there is no `Scoreboard.getScore()` view on the
 * contract (verified at spec time, see Cluster C Design Notes). Cross-
 * device reconciliation is tracked in `deferred-work.md`.
 */

const STORAGE_KEY_PREFIX = "chesscito:save:";

export type SaveScoreState = {
  /** Score (in raw points, not stars) most recently confirmed on-chain. */
  lastSavedScore: number;
  /** Epoch ms of the last receipt confirmation. 0 when no save has
   *  happened on this device. */
  lastSavedAt: number;
  /** Tx hash of the last successful submit. null when no save yet. */
  lastSavedTxHash: string | null;
};

const EMPTY: SaveScoreState = {
  lastSavedScore: 0,
  lastSavedAt: 0,
  lastSavedTxHash: null,
};

function storageKey(piece: PieceId): string {
  return `${STORAGE_KEY_PREFIX}${piece}`;
}

function loadSaveState(piece: PieceId): SaveScoreState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = localStorage.getItem(storageKey(piece));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<SaveScoreState>;
    if (
      typeof parsed.lastSavedScore !== "number" ||
      !Number.isFinite(parsed.lastSavedScore) ||
      parsed.lastSavedScore < 0 ||
      typeof parsed.lastSavedAt !== "number" ||
      !Number.isFinite(parsed.lastSavedAt)
    ) {
      return EMPTY;
    }
    return {
      lastSavedScore: parsed.lastSavedScore,
      lastSavedAt: parsed.lastSavedAt,
      lastSavedTxHash:
        typeof parsed.lastSavedTxHash === "string"
          ? parsed.lastSavedTxHash
          : null,
    };
  } catch {
    return EMPTY;
  }
}

export type UseSaveScoreStateReturn = SaveScoreState & {
  /** Persist a successful submission for the active piece. Only call
   *  this after the receipt has confirmed — cancellation / failure
   *  paths must NOT invoke. */
  recordSave: (score: number, txHash: string) => void;
  /** Piece-aware writer. Use when the receipt arrives AFTER the user
   *  switched pieces — the save must still land under the piece that
   *  was active at tx-broadcast time (Cluster C review patch — piece-
   *  switch mid-tx data-corruption fix). Updates in-memory state only
   *  if `targetPiece === piece` (the currently-active piece). */
  recordSaveFor: (
    targetPiece: PieceId,
    score: number,
    txHash: string,
  ) => void;
};

export function useSaveScoreState(piece: PieceId): UseSaveScoreStateReturn {
  // Hydration-safe init — server renders zeros, client hydrates with
  // localStorage in the useEffect below (matches `useExerciseProgress`
  // convention).
  const [state, setState] = useState<SaveScoreState>(EMPTY);

  useEffect(() => {
    setState(loadSaveState(piece));
  }, [piece]);

  const recordSaveFor = useCallback(
    (targetPiece: PieceId, score: number, txHash: string) => {
      const next: SaveScoreState = {
        lastSavedScore: score,
        lastSavedAt: Date.now(),
        lastSavedTxHash: txHash,
      };
      try {
        localStorage.setItem(storageKey(targetPiece), JSON.stringify(next));
      } catch {
        // best-effort; the in-memory state below still reflects the
        // save for the active piece.
      }
      if (targetPiece === piece) {
        setState(next);
      }
    },
    [piece],
  );

  const recordSave = useCallback(
    (score: number, txHash: string) => {
      recordSaveFor(piece, score, txHash);
    },
    [piece, recordSaveFor],
  );

  return {
    lastSavedScore: state.lastSavedScore,
    lastSavedAt: state.lastSavedAt,
    lastSavedTxHash: state.lastSavedTxHash,
    recordSave,
    recordSaveFor,
  };
}
