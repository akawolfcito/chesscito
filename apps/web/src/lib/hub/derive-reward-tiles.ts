import type { RewardTile } from "@/components/kingdom/reward-column";
import {
  EXERCISES,
  badgeRequiredCount,
  completedExerciseCount,
  isBadgeEarned,
} from "@/lib/game/exercises";
import type { ExerciseCatalog } from "@/lib/game/rotation";
import type { PieceId } from "@/lib/game/types";

/** Narrative unlock order surfaced in the Hub reward column. Mirrors the
 *  `REWARD_COPY` story. King sits last because its exercise set ships
 *  later (PR-9) — until then it's the "soon" tile. Distinct from
 *  on-chain `BADGE_LEVEL_IDS` (1n–6n) which use a different enumeration. */
export const REWARD_TILE_ORDER: readonly PieceId[] = [
  "rook",
  "bishop",
  "queen",
  "knight",
  "pawn",
  "king",
] as const;

export type RewardDerivationInput = {
  /** On-chain claim state per piece. Undefined → treated as not claimed
   *  (loading state). */
  badgesClaimed: Partial<Record<PieceId, boolean>>;
  /** Distinct exercises completed (≥1★) per piece. Missing keys default to 0.
   *  The badge gate is COMPLETION, not stars (founder 2026-07-17).
   *
   *  ⚠️ This is the WIDE count — every positive entry in storage, retired ids
   *  included, because mastery is never revoked when internal ids change. It
   *  drives the STATE only. The visible counter uses `starsByIdPerPiece`. */
  completedPerPiece: Partial<Record<PieceId, number>>;
  /** Raw id→stars map per piece. Feeds the visible counter through
   *  `completedExerciseCount`, which intersects with the live catalog — the
   *  same function the drawer uses, so the tile and the drawer agree by
   *  construction (founder 2026-08-09: "the tile says what the drawer says").
   *  Missing keys mean no stored progress for that piece. */
  starsByIdPerPiece: Partial<Record<PieceId, Record<string, number>>>;
  /** Tap handler forwarded onto each tile. The container decides routing
   *  per `(piece, state)`. */
  onTileTap?: (piece: PieceId) => void;
  /** Injected catalog (default = baseline EXERCISES) — sizes the badge gate
   *  (80% of the pool) and gates the `hasExercises` check so a live overlay
   *  addition can flip a "soon" piece on. */
  catalog?: ExerciseCatalog;
  /** ⛔ REQUIRED, no default. `completedPerPiece` starts `{}` and fills in a
   *  mount effect (`use-hub-data.ts:283-291`), so on first paint every piece
   *  reads 0. States survived that because a state asserts nothing numeric —
   *  a counter does, and "0/4" on a piece with 3 done is a visible lie.
   *  No default so `tsc` points at every call site that forgot it. */
  isHydrated: boolean;
};

/** Pure derivation: reduces wallet+local state into the up-to-N reward
 *  tiles that should be rendered in the Hub.
 *
 *  Rules:
 *  - A piece already claimed on-chain remains visible as `claimed` so the
 *    Hub keeps the full 6-piece visual sequence.
 *  - Otherwise the state follows the narrative chain:
 *      • `claimable` — badge earned (80% of the pool completed) and prior
 *        tier is mastered.
 *      • `progress`  — prior tier mastered (or first tier) but the badge
 *        is not yet earned.
 *      • `locked`    — prior tier not mastered.
 *  - Tiles are returned in unlock order (no re-sort) so the player sees
 *    the same progression they read in `REWARD_COPY`. */
export function deriveRewardTiles(input: RewardDerivationInput): RewardTile[] {
  const {
    badgesClaimed,
    completedPerPiece,
    starsByIdPerPiece,
    onTileTap,
    catalog = EXERCISES,
    isHydrated,
  } = input;

  const tiles: RewardTile[] = [];
  let priorMastered = true;

  for (const piece of REWARD_TILE_ORDER) {
    const claimed = badgesClaimed[piece] === true;
    const completed = completedPerPiece[piece] ?? 0;
    const meetsThreshold = isBadgeEarned(completed, catalog[piece].length);
    const mastered = claimed || meetsThreshold;

    if (claimed) {
      tiles.push({
        id: piece,
        state: "claimed",
        onTap: onTileTap ? () => onTileTap(piece) : undefined,
      });
      priorMastered = mastered;
      continue;
    }

    const hasExercises = catalog[piece].length > 0;

    let state: RewardTile["state"];
    if (!hasExercises) {
      state = "locked";
    } else if (priorMastered && meetsThreshold) {
      state = "claimable";
    } else if (priorMastered) {
      state = "progress";
    } else {
      state = "locked";
    }

    tiles.push({
      id: piece,
      state,
      onTap: onTileTap ? () => onTileTap(piece) : undefined,
      // Only `progress` carries a counter, and only once hydrated. `claimed`
      // has its check, `claimable` its dot, and `locked` has nothing honest
      // to count.
      progress:
        state === "progress" && isHydrated
          ? {
              completed: completedExerciseCount(
                piece,
                starsByIdPerPiece[piece] ?? {},
                catalog,
              ),
              required: badgeRequiredCount(catalog[piece].length),
            }
          : undefined,
    });

    priorMastered = mastered;
  }

  return tiles;
}
