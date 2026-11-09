"use client";

import { useState, type ReactNode } from "react";
import type { Exercise } from "@/lib/game/types";
import type { PuzzleKind } from "@/lib/game/fen-puzzle";
import { QueensBoard } from "@/components/exercises/queens-board";
import { KnightTourBoard } from "@/components/exercises/knight-tour-board";
import { DiagonalRunBoard } from "@/components/exercises/diagonal-run-board";
import { SafePathBoard } from "@/components/exercises/safe-path-board";
import { PromotionRunBoard } from "@/components/exercises/promotion-run-board";

/**
 * Builder Preview host (spec §Preview: contrato de host, P0-3).
 *
 * Mounts the REAL production board for a signature kind against the draft, so
 * the founder can PLAY the level being authored. The builder lends the board no
 * game semantics: `onCaught` is a status line + Reset, never the TRY AGAIN
 * overlay; nothing here persists progress, spends a shield, or celebrates.
 *
 * exercise/labyrinth are absent on purpose — their play surface is the whole
 * exercises host, not a standalone board, and Paint already shows their position
 * and BFS route. `isPreviewable` gates the toggle for them.
 */
export const PREVIEWABLE_KINDS = new Set<PuzzleKind>([
  "queens",
  "knight-tour",
  "diagonal-run",
  "safe-path",
  "promotion-run",
]);

export function isPreviewable(kind: PuzzleKind): boolean {
  return PREVIEWABLE_KINDS.has(kind);
}

export function BuilderPreview({ exercise, kind }: { exercise: Exercise; kind: PuzzleKind }) {
  // One nonce remounts whichever board is shown — a clean Reset for every kind,
  // and the host-owned reset the threat boards ask for after `onCaught`.
  const [nonce, setNonce] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [band, setBand] = useState<string | null>(null);

  const reset = () => {
    setStatus(null);
    setBand(null);
    setNonce((n) => n + 1);
  };
  const key = `${kind}-${nonce}`;

  let board: ReactNode = null;
  switch (kind) {
    case "queens":
      board = (
        <QueensBoard
          key={key}
          level={exercise}
          showSafeSquares
          onBandChange={(b) => setBand(b.message)}
          onComplete={(placed, ceiling) => setStatus(`placed ${placed}/${ceiling}`)}
        />
      );
      break;
    case "knight-tour":
      board = (
        <KnightTourBoard
          key={key}
          level={exercise}
          onBandChange={(b) => setBand(b.message)}
          onComplete={(visited, reachable) => setStatus(`covered ${visited}/${reachable}`)}
        />
      );
      break;
    case "diagonal-run":
      board = (
        <DiagonalRunBoard
          key={key}
          level={exercise}
          onBandChange={(b) => setBand(b.message)}
          onComplete={(moves) => setStatus(`done in ${moves}`)}
        />
      );
      break;
    case "safe-path":
      board = (
        <SafePathBoard
          key={key}
          level={exercise}
          showWatched
          onBandChange={(b) => setBand(b.message)}
          onCaught={(sq) => setStatus(`caught on ${sq} — Reset to try again`)}
          onComplete={(moves, optimal) => setStatus(`arrived in ${moves} (optimal ${optimal})`)}
        />
      );
      break;
    case "promotion-run":
      board = (
        <PromotionRunBoard
          key={key}
          level={exercise}
          showWatched
          onBandChange={(b) => setBand(b.message)}
          onCaught={(sq) => setStatus(`caught on ${sq} — Reset to try again`)}
          onComplete={(moves, optimal) => setStatus(`crowned in ${moves} (optimal ${optimal})`)}
        />
      );
      break;
    default:
      // exercise / labyrinth — no standalone board (see docblock).
      return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {board}
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="min-h-4 flex-1 truncate">
          {band ? <span className="text-neutral-400">{band}</span> : null}
          {status ? <span className="ml-2 font-semibold text-amber-300">{status}</span> : null}
        </span>
        <button
          type="button"
          onClick={reset}
          className="shrink-0 rounded border border-neutral-700 bg-neutral-800 px-3 py-1 font-semibold text-neutral-100 hover:bg-neutral-700"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
