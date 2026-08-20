/**
 * Featured mini-games rotation — the single source of truth.
 *
 * WHY A CURATED LIST AND NOT THE EXISTING ROTATION ENGINE
 * ------------------------------------------------------
 * `lib/game/rotation.ts` already rotates lane-1 exercises, but it is a SEEDED,
 * per-day, per-piece, tier-gated selector over a 10-100 item pool. This surface
 * has 13 items total across 4 engines, and the whole point of "featured" is
 * that a human chose them: variety of engine, variety of difficulty, and an
 * opening rotation a newcomer can actually clear. A seeded shuffle over 13
 * items would repeat engines, feature three rook levels at once, and give the
 * author no way to say "this one first". The two models are deliberately
 * different and neither should be made to serve the other's job.
 *
 * WHY CODE AND NOT A TABLE
 * ------------------------
 * Changing the rotation is a content decision that ships with a build, and
 * `validateRotation` runs in the suite — a typo'd or retired id fails CI, never
 * a player's screen. A CMS, a Redis key or a DB table would move that check to
 * runtime and buy nothing: the cadence this surface can actually sustain is
 * measured in weeks, not minutes.
 *
 * Everything here is PURE: no React, no IO, no Date, no storage. Changing the
 * active rotation touches NO progress data — completion is keyed by challenge
 * id in `chesscito:labyrinth-best:{piece}`, which this module never reads or
 * writes.
 */

import type { Exercise, PieceId } from "@/lib/game/types";
import {
  isEarlyAccessChallenge,
  resolveChallenge,
  type MiniGameEngineId,
} from "@/lib/minigames/catalog";
import type { MiniGamePools } from "@/lib/minigames/pools";

export type MiniGameRotation = {
  /** Stable, versioned, and carried on every telemetry event so a usage read
   *  can always be attributed to what was on screen. */
  id: string;
  /** Ordered challenge ids. Order is presentation order. */
  items: readonly string[];
};

/** Featured slots per rotation. Three fits the 390px viewport as a scroller
 *  with a partial fourth card visible, and divides 13 healthy challenges into
 *  four rotations before anything repeats. */
export const ROTATION_SIZE = 3;

/**
 * The shipped rotations, in order. `MINIGAME_ROTATIONS[n-1]` is the rotation
 * before `MINIGAME_ROTATIONS[n]` — `carriedOverIds` depends on that ordering.
 *
 * AUTHORING RULES (all four enforced by rotation.test.ts):
 *   1. exactly ROTATION_SIZE items;
 *   2. no engine twice inside one rotation;
 *   3. no challenge reused across rotations while unseen content remains;
 *   4. every id must resolve, and its engine must be `early-access`.
 *
 * Capacity: 13 healthy challenges (rook 4, bishop 3, queen 3, king 3). Four
 * rotations of three consume 12; the 13th opens rotation 5, which is where new
 * content starts being required. See §PART 15 of the implementation spec.
 */
export const MINIGAME_ROTATIONS: readonly MiniGameRotation[] = [
  {
    // Opening set. One level from three different engines, and the rook entry
    // is the lane's most-completed level so the very first card is winnable.
    id: "early-access-1",
    items: ["rook-rail-two-roads", "bishop-run-2", "queens-1"],
  },
  {
    id: "early-access-2",
    items: ["king-safe-1", "rook-rail-dead-end", "bishop-run-3"],
  },
  {
    id: "early-access-3",
    items: ["queens-2", "king-safe-2", "rook-rail-rook-run"],
  },
  {
    id: "early-access-4",
    items: ["bishop-run-1", "queens-3", "king-safe-3"],
  },
] as const;

/** The rotation on screen today. Changing this constant is the whole release
 *  action for a rotation change. */
export const ACTIVE_ROTATION_ID = "early-access-1";

export function getRotation(id: string): MiniGameRotation | undefined {
  return MINIGAME_ROTATIONS.find((rotation) => rotation.id === id);
}

export function getActiveRotation(): MiniGameRotation {
  const rotation = getRotation(ACTIVE_ROTATION_ID);
  if (!rotation) {
    throw new Error(`ACTIVE_ROTATION_ID names no rotation: ${ACTIVE_ROTATION_ID}`);
  }
  return rotation;
}

export type RotationIssue =
  | { code: "empty_rotation" }
  /** Unknown, retired, or a lane-1 exercise id. All three are the same
   *  refusal: `resolveChallenge` could not find it in any projected lane. */
  | { code: "unknown_challenge"; id: string }
  | { code: "duplicate_challenge"; id: string }
  | { code: "coming_soon_engine"; id: string; engine: MiniGameEngineId };

/**
 * Every reason this rotation must not ship. Empty array = valid.
 *
 * Returns ALL issues rather than the first, so an author fixing a rotation
 * sees the whole list in one run instead of one per suite invocation.
 */
export function validateRotation(
  rotation: MiniGameRotation,
  pools: MiniGamePools,
): RotationIssue[] {
  if (rotation.items.length === 0) return [{ code: "empty_rotation" }];

  const issues: RotationIssue[] = [];
  const seen = new Set<string>();

  for (const id of rotation.items) {
    if (seen.has(id)) {
      issues.push({ code: "duplicate_challenge", id });
      continue;
    }
    seen.add(id);

    const resolved = resolveChallenge(pools, id);
    if (!resolved) {
      issues.push({ code: "unknown_challenge", id });
      continue;
    }
    if (!isEarlyAccessChallenge(pools, id)) {
      issues.push({
        code: "coming_soon_engine",
        id,
        engine: resolved.engine.id,
      });
    }
  }

  return issues;
}

export type FeaturedChallenge = {
  challengeId: string;
  engineId: MiniGameEngineId;
  piece: PieceId;
  challenge: Exercise;
};

/**
 * The rotation as renderable cards, in authored order.
 *
 * DROPS anything it cannot resolve or that is not early-access. `validateRotation`
 * is the build-time guard; this is the runtime floor under it, so a bad id can
 * at worst cost a card — never a card that routes nowhere.
 */
export function resolveRotation(
  rotation: MiniGameRotation,
  pools: MiniGamePools,
): FeaturedChallenge[] {
  const seen = new Set<string>();
  const out: FeaturedChallenge[] = [];
  for (const challengeId of rotation.items) {
    if (seen.has(challengeId)) continue;
    seen.add(challengeId);
    const resolved = resolveChallenge(pools, challengeId);
    if (!resolved || resolved.engine.status !== "early-access") continue;
    out.push({
      challengeId,
      engineId: resolved.engine.id,
      piece: resolved.piece,
      challenge: resolved.challenge,
    });
  }
  return out;
}

/**
 * Ids this rotation shares with the one immediately before it.
 *
 * Content-freshness signal with ZERO storage: "new" and "still here" are
 * derived from the ordered constant, not from anything the player's device
 * remembers. Empty for the first rotation and for an unknown id — the honest
 * answer when there is no previous rotation to compare against.
 */
export function carriedOverIds(rotationId: string): Set<string> {
  const index = MINIGAME_ROTATIONS.findIndex(
    (rotation) => rotation.id === rotationId,
  );
  if (index <= 0) return new Set();
  return new Set(MINIGAME_ROTATIONS[index - 1].items);
}

/**
 * True when every featured challenge has a recorded best.
 *
 * `bestsByPiece` is the existing per-piece best map
 * (`chesscito:labyrinth-best:{piece}`), passed in rather than read, so this
 * stays pure. An empty featured list returns FALSE: a vacuous completion would
 * congratulate a player for a rotation that rendered nothing.
 */
export function isRotationComplete(
  featured: readonly FeaturedChallenge[],
  bestsByPiece: Record<string, Record<string, number> | undefined>,
): boolean {
  if (featured.length === 0) return false;
  return featured.every(
    (entry) => (bestsByPiece[entry.piece] ?? {})[entry.challengeId] != null,
  );
}
