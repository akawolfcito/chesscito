import { NextResponse } from "next/server";
import { getRedis, isRedisTimeout } from "@/lib/server/redis";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createLogger } from "@/lib/server/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const PURGE_BATCH_SIZE = 5_000;
const PURGE_LOCK_TTL_S = 600;
const PURGE_LOCK_KEY = "coach:cron:purge";
const PURGE_MAX_PASSES = 20;

const redis = getRedis("batch");

/**
 * Daily cron: deletes `coach_analyses` rows where `expires_at < now()`.
 *
 * Race-safe (red-team P0-6):
 * - Bearer auth via CRON_SECRET. Fails CLOSED when env unset (deliberate
 *   divergence from /api/cron/sync, which fails open — purge is destructive
 *   so a misconfigured deploy must not silently allow anonymous calls).
 * - Redis SETNX advisory lock with 600s TTL prevents overlapping runs
 *   (scheduled run + manual workflow_dispatch + GH Actions retries).
 * - SQL RPC batches of 5000 with up to 20 passes (≤ 100k rows/run cap)
 *   avoids table-level locks on backlog catch-up.
 * - Lock release in `finally` regardless of supabase outcome.
 *
 * Spec §8.1 / §12.
 */
export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const log = createLogger({ route: "/api/cron/coach-purge" });

  // Cheap-check first: bail before holding the advisory lock if env missing.
  const supabase = getSupabaseServer();
  if (!supabase) {
    log.error("coach_purge_supabase_unavailable", {});
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }

  let acquired;
  try {
    acquired = await redis.set(PURGE_LOCK_KEY, Date.now(), {
      nx: true,
      ex: PURGE_LOCK_TTL_S,
    });
  } catch (error) {
    log.error("coach_purge_lock_failed", { timeout: isRedisTimeout(error) });
    return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
  }
  if (!acquired) {
    return NextResponse.json({ skipped: true, reason: "another run in progress" });
  }

  let totalDeleted = 0;
  try {
    for (let pass = 0; pass < PURGE_MAX_PASSES; pass++) {
      // PostgREST >=13 applies order/limit to RETURNING, not affected rows.
      // The RPC enforces the batch limit atomically inside PostgreSQL.
      const { data, error } = await supabase.rpc("purge_expired_coach_analyses");

      if (error) {
        log.error("coach_purge_failed", {
          code: error.code,
          pass,
          total_so_far: totalDeleted,
        });
        return NextResponse.json(
          { error: "purge failed", deleted_before_failure: totalDeleted },
          { status: 500 },
        );
      }

      if (!Number.isInteger(data) || data < 0 || data > PURGE_BATCH_SIZE) {
        log.error("coach_purge_invalid_count", { pass, total_so_far: totalDeleted });
        return NextResponse.json(
          { error: "purge failed", deleted_before_failure: totalDeleted },
          { status: 500 },
        );
      }
      const rows = data as number;
      totalDeleted += rows;
      if (rows < PURGE_BATCH_SIZE) break;
    }

    log.info("coach_purge_complete", { rows_deleted: totalDeleted });
    return NextResponse.json({ rows_deleted: totalDeleted });
  } catch {
    log.error("coach_purge_unexpected_failure", { total_so_far: totalDeleted });
    return NextResponse.json(
      { error: "purge failed", deleted_before_failure: totalDeleted },
      { status: 500 },
    );
  } finally {
    await redis.del(PURGE_LOCK_KEY).catch(() => {
      log.warn("coach_purge_lock_release_failed", {});
    });
  }
}
