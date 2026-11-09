/**
 * Merged content catalog — db-backed-content Phase 2a.
 *
 * `mergeOverlay` (pure): baseline ⊕ overlay deltas. Append-new, replace-edit
 * (overlay fields + order win), remove-disabled, descriptions merged, each pool
 * sorted (order,id). Every non-disabled overlay row is re-BFS-verified by
 * reusing `buildCatalog`; a row that is unsolvable/malformed or whose stored
 * `optimal_moves` disagrees with the recomputed value is DROPPED — the DB value
 * is never blindly trusted.
 *
 * `getMergedCatalog`: the cached, ready-to-serve entry point. Fetches the
 * overlay once per cache rebuild (tagged "content"; the write route revalidates
 * it), merges over the compiled baseline, and falls back to baseline-only
 * whenever the overlay is unavailable (no client / fetch error / timeout).
 *
 * NO player consumer reads this yet (Phase 2b/2c). This slice is the loader +
 * merge logic only.
 */
import { unstable_cache } from "next/cache";
import type { Exercise, PieceId } from "@/lib/game/types";
import { isSweep } from "@/lib/game/targets";
import {
  GENERATED_EXERCISES,
  GENERATED_LABYRINTHS,
  GENERATED_DIAGONAL_RUN,
  GENERATED_KNIGHT_TOUR,
  GENERATED_QUEENS,
  GENERATED_SAFE_PATH,
  GENERATED_PROMOTION_RUN,
  GENERATED_EXERCISE_DESCRIPTIONS,
} from "@/lib/game/generated/puzzles.generated";
import { getSupabaseServer } from "@/lib/supabase/server";
import { buildCatalog, type LabyrinthRecord } from "./catalog";
import { envStageFloor, resolveVisibleRows, visibleStages } from "./stage";
import type {
  BaselineCatalog,
  ContentOverlayRow,
  ContentStage,
  MergedCatalog,
} from "./overlay-types";

/** Cache tag the admin write route revalidates after a save. */
export const CONTENT_TAG = "content";
/** Degrade to baseline fast if the (possibly paused free-tier) DB is slow. */
const OVERLAY_TIMEOUT_MS = 2000;
/** Primary cache-refresh cadence (content-staging-model): every deployment
 *  re-reads the shared overlay on its own within this window — no fan-out. */
const CONTENT_TTL_SECONDS = 60;

const PIECES: PieceId[] = ["rook", "bishop", "knight", "pawn", "queen", "king"];

/**
 * Every pool a catalogue carries, as one list.
 *
 * The seven-ness of the catalogue is stated ONCE. Everything that has to walk
 * all of them — the id-uniqueness scan, the merge's passthrough — reads this,
 * so an eighth bucket cannot be added to five of them and forgotten in the
 * sixth.
 */
export const CATALOG_POOL_KEYS = [
  "exercises",
  "labyrinths",
  "diagonalRun",
  "knightTour",
  "queens",
  "safePath",
  "promotionRun",
] as const;

export type CatalogPoolKey = (typeof CATALOG_POOL_KEYS)[number];

/** Just the pools — the shape both the uniqueness scan and the grader read. */
export type CatalogPools = Pick<BaselineCatalog, CatalogPoolKey>;

/**
 * Which pool owns each exercise id, and which ids more than one pool claims.
 *
 * Ids are the catalogue's primary key across ALL pools, not per pool.
 * `buildCatalog` enforces that within one build (`catalog.ts:419`), and
 * `gradeAttempt` depends on it: it finds a level by scanning the pools in order
 * and grades with the first hit, so a duplicated id would be graded by whichever
 * bucket happens to come first — a move count fed to a coverage grader, in
 * silence. The overlay is the one path that can introduce a duplicate, because
 * its rows are built one at a time and never see the other pools.
 */
export function indexExerciseIds(pools: CatalogPools): {
  owner: Map<string, CatalogPoolKey>;
  duplicates: string[];
} {
  const owner = new Map<string, CatalogPoolKey>();
  const duplicates: string[] = [];
  for (const poolKey of CATALOG_POOL_KEYS) {
    for (const piece of PIECES) {
      for (const exercise of pools[poolKey][piece] ?? []) {
        if (owner.has(exercise.id)) duplicates.push(exercise.id);
        else owner.set(exercise.id, poolKey);
      }
    }
  }
  return { owner, duplicates };
}

/** Ids claimed by more than one pool. Empty is the invariant. */
export function duplicateExerciseIds(pools: CatalogPools): string[] {
  return indexExerciseIds(pools).duplicates;
}

function emptyByPiece<T>(): Record<PieceId, T[]> {
  return { rook: [], bishop: [], knight: [], pawn: [], queen: [], king: [] };
}

type Entry = { exercise: Exercise; order: number };

/**
 * Re-validate a single overlay row through the shared BFS catalog builder.
 * Returns the built Exercise (+ description) or null when the row is
 * unsolvable/malformed or its stored optimal_moves disagrees with BFS.
 */
function buildOverlayRow(
  row: ContentOverlayRow,
): { exercise: Exercise; description?: string } | null {
  const rec: LabyrinthRecord = {
    id: row.id,
    piece: row.piece,
    fen: row.fen,
    target: row.target,
    // A sweep's optimum is RECOMPUTED from these below, like every other row's:
    // the stored `optimal_moves` is checked against it, never adopted. Reading
    // the targets is what makes that check ask the right question — without
    // them the builder measures the leg to the first star and disagrees with
    // itself on every multi-goal row.
    targets: row.targets ?? undefined,
    starFloor: row.star_floor ?? undefined,
    mover: row.mover ?? undefined,
    tier: row.tier,
    tags: row.tags ?? undefined,
    explanation: row.explanation ?? undefined,
    order: row.order,
  };
  // Pedagogy is NOT enforced on overlay rows: the Supabase table has no columns
  // for principle/title/playerPrompt/learningObjective, so requiring them would
  // drop every rook row the builder publishes. The inheritance this comment
  // promises is applied by the caller (see mergeOverlay) — it cannot happen
  // here, where the baseline entry is not in scope.
  const cat = buildCatalog(
    [],
    row.kind === "labyrinth" ? [rec] : [],
    row.kind === "exercise" ? [rec] : [],
    { requirePedagogy: false },
  );
  if (cat.errors.length) return null;
  const pool = row.kind === "labyrinth" ? cat.labyrinths : cat.exercises;
  const built = pool[row.piece]?.find((e) => e.id === row.id);
  if (!built) return null;
  if (built.optimalMoves !== row.optimal_moves) return null; // trust-but-verify
  return { exercise: built, description: cat.descriptions[row.id] };
}

function tag(baseline: Record<PieceId, Exercise[]>): Record<PieceId, Entry[]> {
  const out = emptyByPiece<Entry>();
  for (const p of PIECES) {
    out[p] = (baseline[p] ?? []).map((exercise, order) => ({ exercise, order }));
  }
  return out;
}

function finalize(rec: Record<PieceId, Entry[]>): Record<PieceId, Exercise[]> {
  const out = emptyByPiece<Exercise>();
  for (const p of PIECES) {
    out[p] = [...rec[p]]
      .sort(
        (a, b) =>
          a.order - b.order || a.exercise.id.localeCompare(b.exercise.id),
      )
      .map((e) => e.exercise);
  }
  return out;
}

export function mergeOverlay(
  baseline: BaselineCatalog,
  overlay: ContentOverlayRow[],
): MergedCatalog {
  const exercises = tag(baseline.exercises);
  const labyrinths = tag(baseline.labyrinths);
  const descriptions = { ...baseline.descriptions };
  // Who owns each id BEFORE the merge, maintained as rows are applied so two
  // overlay rows cannot collide with each other either.
  const { owner } = indexExerciseIds(baseline);
  let applied = 0;
  /** Overlay rows dropped because they would have shadowed a Star Sweep. Not
   *  silent: this is a live authoring conflict — someone edited a board the
   *  overlay schema cannot represent, and they should be told, not guessed at. */
  const skippedSweeps: string[] = [];

  for (const row of overlay) {
    try {
      const targetPool: CatalogPoolKey =
        row.kind === "labyrinth" ? "labyrinths" : "exercises";
      const list = (row.kind === "labyrinth" ? labyrinths : exercises)[
        row.piece
      ];
      if (!list) continue; // unknown piece — defensive skip

      // An id already claimed by ANOTHER pool is dropped, not applied. Ids are
      // the catalogue's key across every pool, and `gradeAttempt` grades the
      // first pool that answers to one: letting an overlay row shadow a
      // safe-path or promotion-run level would hand its move count to whichever
      // grader won the scan. A row landing in its OWN pool is an edit, which is
      // the whole point of the overlay.
      const claimedBy = owner.get(row.id);
      if (claimedBy !== undefined && claimedBy !== targetPool) continue;

      if (row.disabled) {
        const idx = list.findIndex((e) => e.exercise.id === row.id);
        if (idx >= 0) list.splice(idx, 1);
        delete descriptions[row.id];
        // The id is free again: a later row may legitimately claim it.
        if (claimedBy === targetPool) owner.delete(row.id);
        applied++;
        continue;
      }

      const idx = list.findIndex((e) => e.exercise.id === row.id);

      /* ⛔ A row WITHOUT targets is not a valid override of a board WITH them.
       *
       * ⚠️ The rule narrowed on 2026-08-11: the table now HAS `targets` and
       * `star_floor`, so a multi-goal row is a legitimate edit and falls through
       * to the merge below. What is still forbidden is the degradation — and
       * that is what the incident was.
       *
       * Before the column existed, a row built from this table always carried
       * them as undefined, and replacing the baseline wholesale downgraded the
       * level to a single goal with `optimalMoves: 1`, while still inheriting
       * the sweep's title.
       *
       * That produced, in production (2026-08-11): the new title, ONE star, no
       * counter, and — because the screen treats `optimalMoves === 1` as "any
       * non-target move is an instant loss" — a board that FAILED the player for
       * trying to play it. Every unit test stayed green throughout, because they
       * all read the baseline.
       *
       * The baseline wins. Inheriting `targets` from it instead would be worse:
       * the row may carry a different fen/mover/target, and grafting the
       * baseline's goal squares onto a different board yields a level nobody
       * authored and the trust-but-verify check cannot catch.
       *
       * Narrow on purpose — `disabled` is handled ABOVE this point, so retiring
       * a sweep still works. The overlay may say "not this one"; it may not say
       * "this one, but broken". */
      const baselineEntry = idx >= 0 ? list[idx].exercise : undefined;
      const rowIsSweep = (row.targets?.length ?? 0) > 1;
      if (baselineEntry && isSweep(baselineEntry) && !rowIsSweep) {
        skippedSweeps.push(row.id);
        continue;
      }

      const built = buildOverlayRow(row);
      if (!built) continue; // dropped (unsolvable / optimal_moves mismatch)
      owner.set(row.id, targetPool);
      // The Supabase table has no columns for the pedagogy fields, so a row
      // built from it always carries them as undefined. Replacing the baseline
      // entry wholesale therefore ERASED the authored copy on every edit —
      // silently, because nothing downstream requires it: the celebration
      // overlay just stopped naming what the player had learned. Carry the
      // baseline's copy forward, which is what the builder always assumed.
      const previous = idx >= 0 ? list[idx].exercise : undefined;
      const exercise: Exercise = previous
        ? {
            ...built.exercise,
            principle: built.exercise.principle ?? previous.principle,
            title: built.exercise.title ?? previous.title,
            playerPrompt: built.exercise.playerPrompt ?? previous.playerPrompt,
            learningObjective:
              built.exercise.learningObjective ?? previous.learningObjective,
          }
        : built.exercise;

      const entry: Entry = { exercise, order: row.order };
      if (idx >= 0) list[idx] = entry;
      else list.push(entry);

      // Overlay row is authoritative for its description: set it, or clear any
      // stale baseline description when the edit carries no objective.
      if (built.description) descriptions[row.id] = built.description;
      else delete descriptions[row.id];
      applied++;
    } catch {
      // A malformed (hand-edited) row is skipped; the rest of the overlay still
      // applies and the merge never throws to the player.
      continue;
    }
  }

  return {
    exercises: finalize(exercises),
    labyrinths: finalize(labyrinths),
    // The five signature-game pools are baseline-only: the overlay has no rows
    // of those kinds, so the compiled buckets pass straight through untouched.
    //
    // ⚠️ "Untouched" is not the same as "absent", and that distinction is what
    // Slice 3 tripped on: `safePath` and `promotionRun` were simply missing from
    // this object, so the catalogue the server served could not grade two of the
    // seven buckets. Passing a pool through costs a line; leaving it out costs a
    // scoreboard that answers `unknown_exercise` to an honest run.
    diagonalRun: baseline.diagonalRun,
    knightTour: baseline.knightTour,
    queens: baseline.queens,
    safePath: baseline.safePath,
    promotionRun: baseline.promotionRun,
    descriptions,
    source: "baseline+overlay",
    overlayCount: applied,
    skippedSweepOverrides: skippedSweeps,
  };
}

/** The compiled baseline catalog (the generated module). */
export function getBaseline(): BaselineCatalog {
  return {
    exercises: GENERATED_EXERCISES,
    labyrinths: GENERATED_LABYRINTHS,
    diagonalRun: GENERATED_DIAGONAL_RUN,
    knightTour: GENERATED_KNIGHT_TOUR,
    queens: GENERATED_QUEENS,
    safePath: GENERATED_SAFE_PATH,
    promotionRun: GENERATED_PROMOTION_RUN,
    descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
  };
}

/** Resolve a promise to its value, or `null` on rejection or timeout. */
function withTimeout<T>(p: PromiseLike<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

/**
 * Fetch overlay rows. Returns `null` (→ baseline-only fallback) when the client
 * is unconfigured, the query errors, times out, or returns a non-array.
 */
async function fetchOverlayRows(
  floor: ContentStage,
): Promise<ContentOverlayRow[] | null> {
  const client = getSupabaseServer();
  if (!client) return null;
  const res = await withTimeout(
    client
      .from("content_overlay")
      .select("*")
      .in("stage", visibleStages(floor)),
    OVERLAY_TIMEOUT_MS,
  );
  const row = res as { data?: unknown; error?: unknown } | null;
  if (!row || row.error || !Array.isArray(row.data)) return null;
  return row.data as ContentOverlayRow[];
}

/**
 * Uncached loader: baseline ⊕ overlay, or baseline-only when the overlay is
 * unavailable. Exported for tests; players read the cached `getMergedCatalog`.
 */
export async function loadMergedCatalog(): Promise<MergedCatalog> {
  const baseline = getBaseline();
  const floor = envStageFloor();
  // Kill-switch: no/invalid CONTENT_STAGE → baseline-only, ZERO DB hits.
  if (!floor) {
    return { ...baseline, source: "baseline-only", overlayCount: 0 };
  }
  const rows = await fetchOverlayRows(floor);
  if (rows === null) {
    return { ...baseline, source: "baseline-only", overlayCount: 0 };
  }
  // Two-version: collapse to ONE row per id (the freshest that reached this env)
  // before merging, so the per-request BFS cost stays one-row-per-id.
  return mergeOverlay(baseline, resolveVisibleRows(rows, floor));
}

/**
 * Cached, ready-to-serve catalog. The overlay is read ~once per cache rebuild
 * (tagged "content"); the admin write route calls `revalidateTag("content")`
 * on save, so players are served from cache with zero per-request DB hits.
 */
// Test seam: the `unstable_cache` "content" tag only revalidates on a write
// (revalidateTag), NOT when the compiled baseline changes — so a persisted
// `.next/cache` entry from a previous run can serve stale boards after a
// `pnpm import-puzzles`. E2E sets CONTENT_CACHE_DISABLED=1 to read the catalog
// uncached (fresh baseline every request). Production never sets it, so the
// caching strategy is unchanged.
export const getMergedCatalog: () => Promise<MergedCatalog> =
  process.env.CONTENT_CACHE_DISABLED === "1"
    ? loadMergedCatalog
    : unstable_cache(
        loadMergedCatalog,
        // Stage floor is fixed per deployment (env) — include it in the key so
        // two deployments at different stages never share a cache entry
        // (red-team P1).
        ["content-merged-catalog", envStageFloor() ?? "baseline"],
        // Tag for on-save local revalidation + a TTL so every env self-refreshes
        // within the window (no cross-deployment fan-out).
        { tags: [CONTENT_TAG], revalidate: CONTENT_TTL_SECONDS },
      );
