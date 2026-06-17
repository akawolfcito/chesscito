import {
  ExercisesScreen,
  type ExercisesInitialSheet,
} from "@/components/exercises/exercises-screen";
import { ExerciseCatalogProvider } from "@/lib/content/catalog-context";
import { getMergedCatalog } from "@/lib/content/merged-catalog";
import { CONTENT_OVERLAY_ENABLED } from "@/lib/content/overlay-flag";
import { EXERCISES } from "@/lib/game/exercises";
import type { ExerciseCatalog } from "@/lib/game/rotation";
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

function pieceHasExercises(
  piece: string,
  catalog: ExerciseCatalog,
): piece is PieceId {
  const exercises = (catalog as Record<string, unknown[] | undefined>)[piece];
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
 *
 * db-backed-content Phase 2c (the server boundary / hydration contract):
 * when `CONTENT_OVERLAY_ENABLED` is on, this boundary is the single source
 * of the catalog — it calls the cached `getMergedCatalog()` (baseline ⊕
 * overlay, tagged `"content"`) and mounts `<ExerciseCatalogProvider>` with
 * the merged exercise pools serialized into the client boundary, so SSR and
 * the first client render read the SAME pools (no hydration mismatch, no
 * client re-fetch). With the flag off no provider is mounted and every
 * consumer falls through to the baseline `EXERCISES` default — byte-identical
 * to the pre-2c read path, with zero DB hits.
 */
export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const merged = CONTENT_OVERLAY_ENABLED ? await getMergedCatalog() : null;
  // The piece-validity check must read the SAME pools the screen will render
  // from, so an overlay-added piece is accepted (and an overlay-emptied piece
  // rejected) under the flag — and baseline when the flag is off.
  const catalog: ExerciseCatalog = merged ? merged.exercises : EXERCISES;

  const piece = firstParam(searchParams.piece);
  const initialPiece =
    piece && pieceHasExercises(piece, catalog) ? piece : undefined;
  const initialSheet = parseInitialSheet(firstParam(searchParams.sheet));

  const screen = (
    <ExercisesScreen initialPiece={initialPiece} initialSheet={initialSheet} />
  );

  if (!merged) return screen;

  return (
    <ExerciseCatalogProvider value={merged.exercises}>
      {screen}
    </ExerciseCatalogProvider>
  );
}
