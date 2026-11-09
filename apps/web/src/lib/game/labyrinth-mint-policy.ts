import type { Exercise } from "./types";

/**
 * Labyrinth mint policy resolver — Phase B of Labyrinth System v0.2.
 *
 * Spec: docs/superpowers/specs/2026-06-02-labyrinth-system-v0.2.md
 *
 * Every consumer (UI overlay, sign endpoint, leaderboard reader) MUST
 * resolve through `resolveLabyrinthMintPolicy` rather than reading the
 * raw `Exercise` fields. The catalog never carries explicit defaults;
 * they live here. Changing a default is a one-file edit and propagates
 * to every consumer automatically.
 *
 * No UI, no network, no on-chain calls — this module is pure logic
 * suitable for both server (Node) and client (browser) bundles.
 */

export type RewardTier = "none" | "in_game" | "partner" | "mystery";

export type StarTier = 1 | 2 | 3;

/** Fully-resolved mint policy. Every field is concrete; absent values
 *  surface as `null` (not `undefined`).
 *
 *  **Contract decision (resolver-level):** spec §4.2 declares the raw
 *  catalog defaults for `seasonId`/`campaignId`/`partnerId` as
 *  `undefined` and `minStarsForReward` as "N/A when rewardEligible=false".
 *  The resolver normalizes all of these to `null` so downstream consumers
 *  (UI, sign endpoint, leaderboard reader, JSON serializers) do not have
 *  to distinguish "field never set" from "field explicitly absent" — they
 *  always see `null`. The catalog-side raw `Exercise` shape keeps the
 *  spec's `undefined` semantics; only the resolved shape commits to
 *  `null`. */
export type ResolvedLabyrinthMintPolicy = {
  mintable: boolean;
  leaderboardEligible: boolean;
  rewardEligible: boolean;
  campaignEligible: boolean;
  minStarsToMint: StarTier;
  /** Only meaningful when `rewardEligible=true`; null otherwise. */
  minStarsForReward: StarTier | null;
  seasonId: string | null;
  campaignId: string | null;
  partnerId: string | null;
  rewardTier: RewardTier;
};

/** Resolves the labyrinth's mint policy by applying spec §4.2 defaults
 *  to every optional field. Pure function; the resolved object is safe
 *  to memoize or compare structurally. */
export function resolveLabyrinthMintPolicy(
  ex: Exercise,
): ResolvedLabyrinthMintPolicy {
  const mintable = ex.mintable ?? true;
  const leaderboardEligible = ex.leaderboardEligible ?? false;
  const rewardEligible = ex.rewardEligible ?? false;
  const campaignEligible = ex.campaignEligible ?? false;
  const minStarsToMint: StarTier = ex.minStarsToMint ?? 1;
  const minStarsForReward: StarTier | null = rewardEligible
    ? (ex.minStarsForReward ?? minStarsToMint)
    : null;
  const rewardTier: RewardTier =
    ex.rewardTier ?? (rewardEligible ? "in_game" : "none");

  return {
    mintable,
    leaderboardEligible,
    rewardEligible,
    campaignEligible,
    minStarsToMint,
    minStarsForReward,
    seasonId: ex.seasonId ?? null,
    campaignId: ex.campaignId ?? null,
    partnerId: ex.partnerId ?? null,
    rewardTier,
  };
}

export type LabyrinthMintPolicyValidation =
  | { valid: true }
  | { valid: false; errors: string[] };

const VALID_STAR_TIERS: readonly number[] = [1, 2, 3];

/** Validates spec §4.3 catalog-side invariants. Returns an aggregate of
 *  every violation rather than throwing on the first one, so catalog
 *  authors get the full picture in one CI run. */
export function validateLabyrinthMintPolicy(
  ex: Exercise,
): LabyrinthMintPolicyValidation {
  const errors: string[] = [];

  if (ex.campaignEligible === true && !ex.campaignId) {
    errors.push("campaignEligible=true requires campaignId to be set");
  }

  if (ex.rewardTier && ex.rewardTier !== "none" && ex.rewardEligible !== true) {
    errors.push(
      `rewardTier="${ex.rewardTier}" requires rewardEligible=true`,
    );
  }

  if (ex.leaderboardEligible === true && ex.mintable === false) {
    errors.push(
      "leaderboardEligible=true requires mintable to be true",
    );
  }

  if (
    ex.minStarsToMint !== undefined
    && !VALID_STAR_TIERS.includes(ex.minStarsToMint)
  ) {
    errors.push(
      `minStarsToMint must be 1, 2, or 3 (got ${ex.minStarsToMint})`,
    );
  }

  if (
    ex.minStarsForReward !== undefined
    && !VALID_STAR_TIERS.includes(ex.minStarsForReward)
  ) {
    errors.push(
      `minStarsForReward must be 1, 2, or 3 (got ${ex.minStarsForReward})`,
    );
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

/** Throwing wrapper for tests and catalog regression guards. The error
 *  message names the offending labyrinth id so CI failure output points
 *  straight at the bad entry. */
export function assertValidLabyrinthMintPolicy(ex: Exercise): void {
  const result = validateLabyrinthMintPolicy(ex);
  if (!result.valid) {
    throw new Error(
      `Invalid labyrinth mint policy for "${ex.id}": ${result.errors.join("; ")}`,
    );
  }
}
