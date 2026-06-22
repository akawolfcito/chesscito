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

/** Only application-owned values are eligible for the hidden QA reset. */
export function isChesscitoStorageKey(key: string | null): boolean {
  return key?.startsWith(LEGACY_PREFIX) ?? false;
}
