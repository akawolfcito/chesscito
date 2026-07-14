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
import {
  GENERATED_EXERCISES,
  GENERATED_LABYRINTHS,
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
    mover: row.mover ?? undefined,
    tier: row.tier,
    tags: row.tags ?? undefined,
    explanation: row.explanation ?? undefined,
    order: row.order,
  };
  // Pedagogy is NOT enforced on overlay rows: the Supabase table has no columns
  // for principle/title/playerPrompt/learningObjective, so requiring them would
  // drop every rook row the builder publishes. Overlay rows inherit the
  // baseline's copy; adding the columns is the gate for turning this on.
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
  let applied = 0;

  for (const row of overlay) {
    try {
      const list = (row.kind === "labyrinth" ? labyrinths : exercises)[
        row.piece
      ];
      if (!list) continue; // unknown piece — defensive skip

      if (row.disabled) {
        const idx = list.findIndex((e) => e.exercise.id === row.id);
        if (idx >= 0) list.splice(idx, 1);
        delete descriptions[row.id];
        applied++;
        continue;
      }

      const built = buildOverlayRow(row);
      if (!built) continue; // dropped (unsolvable / optimal_moves mismatch)

      const entry: Entry = { exercise: built.exercise, order: row.order };
      const idx = list.findIndex((e) => e.exercise.id === row.id);
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
    descriptions,
    source: "baseline+overlay",
    overlayCount: applied,
  };
}

/** The compiled baseline catalog (the generated module). */
export function getBaseline(): BaselineCatalog {
  return {
    exercises: GENERATED_EXERCISES,
    labyrinths: GENERATED_LABYRINTHS,
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
export const getMergedCatalog = unstable_cache(
  loadMergedCatalog,
  // Stage floor is fixed per deployment (env) — include it in the key so two
  // deployments at different stages never share a cache entry (red-team P1).
  ["content-merged-catalog", envStageFloor() ?? "baseline"],
  // Tag for on-save local revalidation + a TTL so every env self-refreshes
  // within the window (no cross-deployment fan-out).
  { tags: [CONTENT_TAG], revalidate: CONTENT_TTL_SECONDS },
);
