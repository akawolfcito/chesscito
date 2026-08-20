import {
  ExercisesScreen,
  type ExercisesInitialSheet,
} from "@/components/exercises/exercises-screen";
import { ContentCatalogProvider } from "@/lib/content/catalog-context";
import { getMergedCatalog } from "@/lib/content/merged-catalog";
import type { MergedCatalog } from "@/lib/content/overlay-types";
import { envStageFloor } from "@/lib/content/stage";
import { EXERCISES } from "@/lib/game/exercises";
import type { ExerciseCatalog } from "@/lib/game/rotation";
import type { PieceId } from "@/lib/game/types";
import { resolveMiniGameDeepLink } from "@/lib/minigames/deep-link";
import { baselineMiniGamePools, type MiniGamePools } from "@/lib/minigames/pools";
import { CHESSCITO_LITE_MODE } from "@/lib/feature-flags";

type SearchParams = {
  /** Pre-select a piece on first render. Pieces without defined
   *  exercises (queen/king while their decks are pending) are silently
   *  dropped so the board can't mount on an empty exercises array. */
  piece?: string | string[];
  /** Dock-driven in-place sheet. Forwarded by the persistent dock
   *  (`/exercises?sheet=shop|badges|trophies|leaderboard|pro`). Unknown
   *  values are silently dropped — the screen renders without a sheet. */
  sheet?: string | string[];
  /** Content slot discriminator. "daily" and "challenge" bypass the Lite
   *  daily quota banner. Unknown/absent values → gated in Lite mode. */
  slot?: string | string[];
  /** Direct Special Training selection. Known ids are forwarded to the client
   *  gate; unknown ids are dropped at the route boundary. */
  content?: string | string[];
  /** Rotation that vouches for `content`, sent by the Mini-games surface. Only
   *  honoured when that rotation genuinely features the id — see
   *  `resolveMiniGameDeepLink`. Anything else is dropped and the content keeps
   *  its normal lane gate. */
  featured?: string | string[];
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

/**
 * The pools every mini-game lookup reads: the merged catalog when a stage floor
 * is configured, the compiled baseline otherwise — the same contract the rest
 * of this boundary already honours for lane 1.
 */
function miniGamePools(merged: MergedCatalog | null): MiniGamePools {
  if (!merged) return baselineMiniGamePools();
  return {
    exercises: merged.exercises,
    labyrinths: merged.labyrinths,
    diagonalRun: merged.diagonalRun,
    knightTour: merged.knightTour,
    queens: merged.queens,
    safePath: merged.safePath,
    promotionRun: merged.promotionRun,
  };
}

const LITE_BLOCKED_SHEETS = new Set<ExercisesInitialSheet>(["shop", "pro"]);

function parseInitialSheet(raw: string | undefined): ExercisesInitialSheet | undefined {
  if (!raw) return undefined;
  if (!SUPPORTED_SHEETS.has(raw as ExercisesInitialSheet)) return undefined;
  const sheet = raw as ExercisesInitialSheet;
  if (CHESSCITO_LITE_MODE && LITE_BLOCKED_SHEETS.has(sheet)) return undefined;
  return sheet;
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
 * content-staging-model (server boundary / hydration contract): when this
 * deployment has a `CONTENT_STAGE` floor (`envStageFloor()` non-null), this
 * boundary is the single source of the catalog — it calls the cached
 * `getMergedCatalog()` (baseline ⊕ stage-filtered overlay, tagged `"content"`)
 * and mounts `<ContentCatalogProvider>` with the full merged read catalog
 * (exercises + labyrinths + descriptions) serialized into the client boundary,
 * so SSR and the first client render read the SAME catalog (no hydration
 * mismatch, no client re-fetch). With CONTENT_STAGE unset/invalid no provider is
 * mounted and every consumer falls through to the baseline default —
 * byte-identical to the pre-overlay read path, with zero DB hits (kill-switch).
 *
 * B2.3b: DailyLimitGuard removed — soft gate now lives inside ExercisesScreen
 * via DailyLimitBanner + ExerciseDrawer quotaState. The `slot` param is
 * forwarded to ExercisesScreen so it can bypass the banner for free slots.
 */
export default async function ExercisesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const merged = envStageFloor() ? await getMergedCatalog() : null;
  // The piece-validity check must read the SAME pools the screen will render
  // from, so an overlay-added piece is accepted (and an overlay-emptied piece
  // rejected) when staged — and baseline when CONTENT_STAGE is unset.
  const catalog: ExerciseCatalog = merged ? merged.exercises : EXERCISES;

  const piece = firstParam(searchParams.piece);
  const slot = firstParam(searchParams.slot);
  // One resolver for every projected lane. It used to search the Knight's Tour
  // pool alone, so `?content=bishop-run-1` was dropped here in silence.
  const deepLink = resolveMiniGameDeepLink({
    contentId: firstParam(searchParams.content),
    rotationId: firstParam(searchParams.featured),
    pools: miniGamePools(merged),
  });
  const contentPiece = deepLink?.piece;
  const initialPiece =
    piece && pieceHasExercises(piece, catalog)
      ? piece
      : contentPiece && pieceHasExercises(contentPiece, catalog)
        ? contentPiece
        : undefined;
  const initialSheet = parseInitialSheet(firstParam(searchParams.sheet));

  const screen = (
    <ExercisesScreen
      initialPiece={initialPiece}
      initialSheet={initialSheet}
      slot={slot}
      initialContentId={deepLink?.contentId}
      initialContentFeatured={deepLink?.featured ?? false}
    />
  );

  if (!merged) return screen;

  return (
    <ContentCatalogProvider
      // All seven pools. It used to mount five, and the three it left out
      // (`queens`, `safePath`, `promotionRun`) fell through to the compiled
      // baseline in every selector — invisible today, because the overlay
      // manages no rows of those kinds, and a silent divergence the day it
      // does: the screen would render a staged catalog for four buckets and
      // the baseline for three.
      value={{
        exercises: merged.exercises,
        labyrinths: merged.labyrinths,
        diagonalRun: merged.diagonalRun,
        knightTour: merged.knightTour,
        queens: merged.queens,
        safePath: merged.safePath,
        promotionRun: merged.promotionRun,
        descriptions: merged.descriptions,
      }}
    >
      {screen}
    </ContentCatalogProvider>
  );
}
