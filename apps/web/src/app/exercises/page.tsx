import { Suspense } from "react";
import {
  ExercisesScreen,
  type ExercisesInitialSheet,
} from "@/components/exercises/exercises-screen";
import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";

type SearchParams = {
  /** Pre-select a piece on first render. Pieces without defined
   *  exercises (queen/king while their decks are pending) are silently
   *  dropped so the board can't mount on an empty exercises array. */
  piece?: string | string[];
  /** Dock-driven in-place sheet. Forwarded by the persistent dock
   *  (`/exercises?sheet=shop|badges|trophies|leaderboard|pro`). Unknown
   *  values are silently dropped — the screen renders without a sheet. */
  sheet?: string | string[];
};

const SUPPORTED_SHEETS = new Set<ExercisesInitialSheet>([
  "shop",
  "badges",
  "trophies",
  "leaderboard",
  "pro",
]);

function pieceHasExercises(piece: string): piece is PieceId {
  const exercises = (EXERCISES as Record<string, unknown[] | undefined>)[piece];
  return Array.isArray(exercises) && exercises.length > 0;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseInitialSheet(raw: string | undefined): ExercisesInitialSheet | undefined {
  if (!raw) return undefined;
  return SUPPORTED_SHEETS.has(raw as ExercisesInitialSheet)
    ? (raw as ExercisesInitialSheet)
    : undefined;
}

/**
 * `/exercises` — canonical URL for piece-exercise gameplay.
 *
 * Hosts the rook tutorial, capture exercises, labyrinth, badge claim
 * flow, first-visit briefing, and result celebrations. Prior to
 * 2026-05-09 this surface lived at `/hub?legacy=1`; that gate was a
 * misnomer (the feature is core, not legacy) and has been retired —
 * see `docs/superpowers/specs/2026-05-09-exercises-route-extraction-design.md`.
 *
 * Server component on purpose: reading `searchParams` from props avoids
 * `useSearchParams()` + Suspense overhead.
 */
export default function ExercisesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const piece = firstParam(searchParams.piece);
  const initialPiece = piece && pieceHasExercises(piece) ? piece : undefined;
  const initialSheet = parseInitialSheet(firstParam(searchParams.sheet));

  // Suspense required because ExercisesScreen now uses useSearchParams()
  // to react to client-side dock pushes (`router.push('?sheet=…')`).
  return (
    <Suspense fallback={null}>
      <ExercisesScreen initialPiece={initialPiece} initialSheet={initialSheet} />
    </Suspense>
  );
}
