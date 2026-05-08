import { ExercisesScreen } from "@/components/exercises/exercises-screen";
import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";

type SearchParams = {
  /** Pre-select a piece on first render. Pieces without defined
   *  exercises (queen/king while their decks are pending) are silently
   *  dropped so the board can't mount on an empty exercises array. */
  piece?: string | string[];
};

function pieceHasExercises(piece: string): piece is PieceId {
  const exercises = (EXERCISES as Record<string, unknown[] | undefined>)[piece];
  return Array.isArray(exercises) && exercises.length > 0;
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
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

  return <ExercisesScreen initialPiece={initialPiece} />;
}
