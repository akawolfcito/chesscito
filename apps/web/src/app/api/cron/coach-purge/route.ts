import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { getSupabaseServer } from "@/lib/supabase/server";
import { createLogger } from "@/lib/server/logger";

export const runtime = "nodejs";
export const maxDuration = 60;

const PURGE_BATCH_SIZE = 5_000;
const PURGE_LOCK_TTL_S = 600;
const PURGE_LOCK_KEY = "coach:cron:purge";
const PURGE_MAX_PASSES = 20;

const redis = Redis.fromEnv();

/**
 * Daily cron: deletes `coach_analyses` rows where `expires_at < now()`.
 *
 * Race-safe (red-team P0-6):
 * - Bearer auth via CRON_SECRET. Fails CLOSED when env unset (deliberate
 *   divergence from /api/cron/sync, which fails open — purge is destructive
 *   so a misconfigured deploy must not silently allow anonymous calls).
 * - Redis SETNX advisory lock with 600s TTL prevents overlapping runs
 *   (scheduled run + manual workflow_dispatch + GH Actions retries).
 * - Batched LIMIT 5000 with up to 20 passes (≤ 100k rows/run cap)
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

  const acquired = await redis.set(PURGE_LOCK_KEY, Date.now(), {
    nx: true,
    ex: PURGE_LOCK_TTL_S,
  });
  if (!acquired) {
    return NextResponse.json({ skipped: true, reason: "another run in progress" });
  }

  let totalDeleted = 0;
  try {
    for (let pass = 0; pass < PURGE_MAX_PASSES; pass++) {
      const { data, error } = await supabase
        .from("coach_analyses")
        .delete()
        .lt("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true })
        .limit(PURGE_BATCH_SIZE)
        .select("game_id");

      if (error) {
        log.error("coach_purge_failed", {
          err: error.message,
          pass,
          total_so_far: totalDeleted,
        });
        return NextResponse.json(
          { error: "purge failed", deleted_before_failure: totalDeleted },
          { status: 500 },
        );
      }

      const rows = data?.length ?? 0;
      totalDeleted += rows;
      if (rows < PURGE_BATCH_SIZE) break;
    }

    log.info("coach_purge_complete", { rows_deleted: totalDeleted });
    return NextResponse.json({ rows_deleted: totalDeleted });
  } finally {
    await redis.del(PURGE_LOCK_KEY).catch(() => {});
  }
}
