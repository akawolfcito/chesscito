import type { Redis } from "@upstash/redis";

import { REDIS_KEYS } from "./redis-keys";
import type { CoachAnalysisRecord } from "./types";

/**
 * Read a cached Coach analysis with locale-aware fallback chain.
 *
 * As of 2026-05-24 the cache key is per-locale
 * (`coach:analysis:<wallet>:<gameId>:<locale>`). Records written before
 * that change live at the legacy key (`coach:analysis:<wallet>:<gameId>`)
 * without a locale segment — treat any hit there as EN by convention
 * (the pre-migration default prompt language).
 *
 * Read order:
 *   1. New per-locale key for the requested locale.
 *   2. Legacy key (only when `locale === "en"`, the implicit pre-migration
 *      default — surfacing a legacy record under a non-EN locale would
 *      mis-report what the user is reading).
 *
 * Returns `null` when both keys miss. The caller is expected to write
 * any new analysis back to the new per-locale key so the legacy entry
 * naturally fades from the read path.
 */
export async function getCachedAnalysisWithFallback(
  redis: Redis,
  wallet: string,
  gameId: string,
  locale: "en" | "es",
): Promise<CoachAnalysisRecord | null> {
  const primaryKey = REDIS_KEYS.analysis(wallet, gameId, locale);
  const primary = await redis.get<CoachAnalysisRecord>(primaryKey);
  if (primary) {
    // Defensive: normalize the locale field on records that may have
    // been written before the field became canonical.
    return primary.locale
      ? primary
      : { ...primary, locale };
  }

  if (locale === "en") {
    const legacyKey = REDIS_KEYS.analysisLegacy(wallet, gameId);
    const legacy = await redis.get<CoachAnalysisRecord>(legacyKey);
    if (legacy) {
      return legacy.locale ? legacy : { ...legacy, locale: "en" };
    }
  }

  return null;
}
