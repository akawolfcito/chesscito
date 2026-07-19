import type { PieceId } from "@/lib/game/types";

const LEGACY_PREFIX = "chesscito:";

/**
 * A Lite deployment can set this public build-time value to isolate QA
 * progress from another Lite context while keeping the same MiniPay wallet.
 * An absent or invalid value deliberately preserves the shipped v1 keys.
 */
function progressPrefix(): string {
  const version = process.env.NEXT_PUBLIC_LITE_PROGRESS_VERSION?.trim();
  if (!version || !/^[a-zA-Z0-9_-]{1,64}$/.test(version)) {
    return LEGACY_PREFIX;
  }
  return `${LEGACY_PREFIX}lite:${version}:`;
}

export function pieceProgressStorageKey(piece: PieceId): string {
  return `${progressPrefix()}progress:${piece}`;
}

export function dailyProgressStorageKey(): string {
  return `${progressPrefix()}daily-progress`;
}

export function labyrinthBestStorageKey(piece: PieceId): string {
  return `${progressPrefix()}labyrinth-best:${piece}`;
}

export function trainingContentSelectionStorageKey(piece: PieceId): string {
  return `${progressPrefix()}training-content:${piece}`;
}

export function dailySessionStorageKey(): string {
  return `${progressPrefix()}daily-session`;
}

export function dailyStarsStorageKey(): string {
  return `${progressPrefix()}daily-stars`;
}

export function milestoneStorageKey(): string {
  return `${progressPrefix()}milestones`;
}

/** "The milestone migration already ran for this profile."
 *
 *  The milestone store has no `seededAt` field, and its idempotence is
 *  "this key already exists" — NOT "the migration already ran". Those are
 *  different claims: a milestone that was legitimately EARNED and is still
 *  waiting for its celebration looks exactly like a milestone that was never
 *  seeded. Re-running the seed at such a moment would stamp `celebratedAt` on
 *  it and silently EAT the celebration. This marker is what makes seeding a
 *  genuine one-time upgrade path instead of something that re-fires forever. */
export function milestoneSeedStorageKey(): string {
  return `${progressPrefix()}milestones-seeded`;
}

/** Only application-owned values are eligible for the hidden QA reset. */
export function isChesscitoStorageKey(key: string | null): boolean {
  return key?.startsWith(LEGACY_PREFIX) ?? false;
}
