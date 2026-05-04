import type { RewardTile } from "@/components/kingdom/reward-column";
import type { PieceId } from "@/lib/game/types";

/** Narrative unlock order surfaced in the Hub reward column. Mirrors the
 *  `REWARD_COPY` story (rook ➜ bishop ➜ queen ➜ knight ➜ king ➜ pawn).
 *  Distinct from on-chain `BADGE_LEVEL_IDS` (1n–6n) which use a different
 *  enumeration. */
export const REWARD_TILE_ORDER: readonly PieceId[] = [
  "rook",
  "bishop",
  "queen",
  "knight",
  "king",
  "pawn",
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
 *  - A piece already claimed on-chain is dropped (no longer a goal).
 *  - Otherwise the state follows the narrative chain:
 *      • `claimable` — stars meet threshold and prior tier is mastered.
 *      • `progress`  — prior tier mastered (or first tier) but threshold
 *        not yet met.
 *      • `locked`    — prior tier not mastered.
 *  - Tiles are returned in unlock order (no re-sort) so the player sees
 *    the same progression they read in `REWARD_COPY`. RewardColumn slices
 *    to 3 + overflow indicator on its own. */
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
      priorMastered = mastered;
      continue;
    }

    let state: RewardTile["state"];
    if (priorMastered && meetsThreshold) {
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
