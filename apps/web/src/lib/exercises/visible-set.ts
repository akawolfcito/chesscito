/**
 * Rotation Engine — visible-set computation for the exercises UI
 * (slice E, 2026-06-08). Pure glue between the catalog/progress and the
 * rotation selectors. No React, no localStorage; the caller passes the
 * UTC date and the legacy stars array in.
 *
 * Returns a Set of exerciseIds to surface today, or `null` when rotation
 * is disabled (the UI then falls back to the full legacy list). The Set
 * holds exerciseIds — never visible indices — so callers always map back
 * to the real pool index / progress, never to a daily slot position.
 */

import {
  getCanonicalFive,
  getVisibleExercisesForToday,
  type ExerciseCatalog,
  type ExerciseStarsById,
} from "@/lib/game/rotation";
import { normalizeStarsById } from "@/lib/game/progress-adapter";
import { EXERCISES } from "@/lib/game/exercises";
import type { PieceId } from "@/lib/game/types";

export function computeVisibleExerciseIds(
  args: {
    piece: PieceId;
    /** Rotation flag. When false, returns null (legacy: no filtering). */
    enabled: boolean;
    /** Connected wallet address, or null for a guest. */
    address: string | null;
    /** Guest session seed (e.g. a session_uuid), or null. */
    sessionSeed: string | null;
    /** UTC date string "YYYY-MM-DD". */
    dateUtc: string;
    /** id-keyed stars map for the piece (sparse; absent id = not played). */
    starsById: ExerciseStarsById;
  },
  /** Phase 2b-2: by-piece pools to read. Defaults to the baseline
   *  `EXERCISES` so flag-off callers are byte-identical; the client
   *  catalog context passes the merged pools when a provider is mounted. */
  catalog: ExerciseCatalog = EXERCISES,
): Set<string> | null {
  if (!args.enabled) return null;

  const seed = args.address ?? args.sessionSeed;
  // Guest with no wallet and no session seed yet → canonical first touch.
  if (!seed) {
    return new Set(getCanonicalFive(args.piece, catalog).map((ex) => ex.id));
  }

  // Normalize the sparse id-map to one clamped entry per pool exercise so
  // the rotation selector reads a complete, in-range progress map.
  const progress = normalizeStarsById(args.piece, args.starsById, catalog);
  const visible = getVisibleExercisesForToday({
    piece: args.piece,
    walletOrSessionSeed: seed,
    dateUtc: args.dateUtc,
    progress,
    catalog,
  });
  return new Set(visible.map((ex) => ex.id));
}
