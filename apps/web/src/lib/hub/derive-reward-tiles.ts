import type { RewardTile } from "@/components/kingdom/reward-column";
import { EXERCISES } from "@/lib/game/exercises";
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
  /** Total stars (0–15) across the 5 exercises per piece. Missing keys
   *  default to 0. */
  starsPerPiece: Partial<Record<PieceId, number>>;
  /** Stars needed to make a piece claimable. Defaults to `BADGE_THRESHOLD`
   *  (10/15) — exposed for tests. */
  threshold?: number;
  /** Tap handler forwarded onto each tile. The container decides routing
   *  per `(piece, state)`. */
  onTileTap?: (piece: PieceId) => void;
};

const DEFAULT_THRESHOLD = 10;

/** Pure derivation: reduces wallet+local state into the up-to-N reward
 *  tiles that should be rendered in the Hub.
 *
 *  Rules:
 *  - A piece already claimed on-chain remains visible as `claimed` so the
 *    Hub keeps the full 6-piece visual sequence.
 *  - Otherwise the state follows the narrative chain:
 *      • `claimable` — stars meet threshold and prior tier is mastered.
 *      • `progress`  — prior tier mastered (or first tier) but threshold
 *        not yet met.
 *      • `locked`    — prior tier not mastered.
 *  - Tiles are returned in unlock order (no re-sort) so the player sees
 *    the same progression they read in `REWARD_COPY`. */
export function deriveRewardTiles(input: RewardDerivationInput): RewardTile[] {
  const {
    badgesClaimed,
    starsPerPiece,
    threshold = DEFAULT_THRESHOLD,
    onTileTap,
  } = input;

  const tiles: RewardTile[] = [];
  let priorMastered = true;

  for (const piece of REWARD_TILE_ORDER) {
    const claimed = badgesClaimed[piece] === true;
    const stars = starsPerPiece[piece] ?? 0;
    const meetsThreshold = stars >= threshold;
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

    const hasExercises = EXERCISES[piece].length > 0;

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
    });

    priorMastered = mastered;
  }

  return tiles;
}
