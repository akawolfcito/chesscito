import { Redis } from "@upstash/redis";
import type {
  CoachAnalysisRecord,
  CoachAnalysisRow,
  GameRecord,
} from "./types.js";
import { extractWeaknessTagsSafe } from "./persistence.js";
import { REDIS_KEYS } from "./redis-keys.js";
import { getSupabaseServer } from "../supabase/server.js";
import { hashWallet, type Logger } from "../server/logger.js";

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
const BACKFILL_LOCK_TTL_S = 60;
const BACKFILL_POLL_INTERVAL_MS = 500;
const BACKFILL_POLL_MAX_ATTEMPTS = 6; // 3s total
const BACKFILL_DEPTH = 20;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

const redis = Redis.fromEnv();

/**
 * Build a `CoachAnalysisRow` from a Redis (analysis, game) pair.
 *
 * Returns `null` when:
 * - either input is missing (caller should skip the gameId), or
 * - the response is `kind: "quick"` (BasicCoachResponse rows are not yet
 *   stored in v1; the schema's `kind in ('full','quick')` constraint
 *   tolerates them but the writer only emits `kind='full'`).
 *
 * Sets `expires_at = analysis.createdAt + 1 year` so the privacy notice
 * "365 days from creation" stays accurate even though the orchestrator
 * is back-dating relative to `now()` (red-team P1-6).
 *
 * Tag derivation is fail-soft — surfaces `tagError` so the orchestrator
 * (Task 4) can emit `coach_tag_extraction_failed` (phase: "backfill") per
 * §7/§12. The row inserts even on extraction failure (red-team P1-7).
 */
export function buildBackfillRow(
  wallet: string,
  gameId: string,
  analysis: CoachAnalysisRecord | null,
  game: GameRecord | null,
): { row: CoachAnalysisRow; tagError?: Error } | null {
  if (!analysis || !game) return null;
  if (analysis.response.kind !== "full") return null;

  const { tags, error: tagError } = extractWeaknessTagsSafe(
    analysis.response.mistakes,
    game.totalMoves,
    game.result,
  );

  const row: CoachAnalysisRow = {
    wallet,
    game_id: gameId,
    created_at: new Date(analysis.createdAt).toISOString(),
    expires_at: new Date(analysis.createdAt + ONE_YEAR_MS).toISOString(),
    kind: "full",
    difficulty: game.difficulty,
    result: game.result,
    total_moves: game.totalMoves,
    summary_text: analysis.response.summary,
    mistakes: analysis.response.mistakes,
    lessons: analysis.response.lessons,
    praise: analysis.response.praise,
    weakness_tags: tags,
  };

  return tagError ? { row, tagError } : { row };
}

/**
 * One-shot Redis→Supabase copy of the wallet's last 20 coach analyses.
 *
 * Race-safe (red-team P0-5):
 * - Acquires a 60s NX lock at `coach:backfill-claim:{wallet}`.
 * - On contention, polls 6×500ms = 3s for the holder to finish. If the
 *   holder finishes in time we exit clean (`waited: true, copied: 0`).
 * - On poll exhaustion we log `coach_backfill_lock_timeout` and return
 *   `waited: true` — caller (analyze route) treats this as "augmentation
 *   omitted on this single call" per §6.5 row 6.
 *
 * Idempotent (red-team P1-9):
 * - Supabase `count > 0` gate short-circuits subsequent calls per wallet.
 * - INSERT…ON CONFLICT DO NOTHING via `.upsert(rows, {...,
 *   ignoreDuplicates: true})` resolves the rare "two backfills both pass
 *   the gate before either inserts" race.
 *
 * Fail-soft (red-team P1-7):
 * - Tag-extraction throws don't drop rows (handled inside `buildBackfillRow`
 *   via `extractWeaknessTagsSafe`).
 * - Caller wraps the whole thing in try/catch; this function never throws.
 */
export async function backfillRedisToSupabase(
  wallet: string,
  log?: Logger,
): Promise<{ copied: number; waited: boolean }> {
  const supabase = getSupabaseServer();
  if (!supabase) return { copied: 0, waited: false };

  const lockKey = REDIS_KEYS.backfillClaim(wallet);

  // Try to acquire the lock.
  const acquired = await redis.set(lockKey, Date.now(), {
    nx: true,
    ex: BACKFILL_LOCK_TTL_S,
  });

  if (!acquired) {
    // Contention — poll-and-wait.
    for (let i = 0; i < BACKFILL_POLL_MAX_ATTEMPTS; i++) {
      await sleep(BACKFILL_POLL_INTERVAL_MS);
      const stillHeld = await redis.get(lockKey);
      if (!stillHeld) {
        return { copied: 0, waited: true };
      }
    }
    log?.warn("coach_backfill_lock_timeout", { wallet_hash: hashWallet(wallet) });
    return { copied: 0, waited: true };
  }

  try {
    // Count gate.
    const { count } = await supabase
      .from("coach_analyses")
      .select("*", { count: "exact", head: true })
      .eq("wallet", wallet);
    if ((count ?? 0) > 0) {
      return { copied: 0, waited: false };
    }

    // Pull the wallet's most-recent N analysis ids.
    const gameIds = await redis.lrange(REDIS_KEYS.analysisList(wallet), 0, BACKFILL_DEPTH - 1);
    if (gameIds.length === 0) {
      return { copied: 0, waited: false };
    }

    // Build rows. Skip ids whose analysis or game is missing, or kind != full.
    const rows: CoachAnalysisRow[] = [];
    for (const gameId of gameIds) {
      const analysis = await redis.get(REDIS_KEYS.analysis(wallet, gameId));
      const game = await redis.get(REDIS_KEYS.game(wallet, gameId));
      const result = buildBackfillRow(
        wallet,
        gameId,
        analysis as CoachAnalysisRecord | null,
        game as GameRecord | null,
      );
      if (!result) continue;
      if (result.tagError) {
        log?.warn("coach_tag_extraction_failed", {
          wallet_hash: hashWallet(wallet),
          phase: "backfill",
          err: result.tagError.message,
        });
      }
      rows.push(result.row);
    }

    if (rows.length === 0) {
      return { copied: 0, waited: false };
    }

    const { error: upsertError } = await supabase
      .from("coach_analyses")
      .upsert(rows, { onConflict: "wallet,game_id", ignoreDuplicates: true });

    if (upsertError) {
      log?.warn("coach_backfill_upsert_failed", {
        wallet_hash: hashWallet(wallet),
        code: (upsertError as { code?: string }).code,
        message: upsertError.message,
      });
      return { copied: 0, waited: false };
    }

    log?.info("coach_backfill_completed", {
      wallet_hash: hashWallet(wallet),
      copied: rows.length,
      waited: false,
    });
    return { copied: rows.length, waited: false };
  } finally {
    // Best-effort lock release. The TTL also covers us.
    try {
      await redis.del(lockKey);
    } catch {
      // ignore — TTL will reap the key
    }
  }
}
