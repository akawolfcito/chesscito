import type { Redis } from "@upstash/redis";
import type { GameRecord } from "./types";
import { REDIS_KEYS } from "./redis-keys";
import { getCachedAnalysisWithFallback } from "./cache-fallback";

/**
 * Cluster E — unconditional GameRecord persistence.
 *
 * The legacy `/api/games` route capped the per-wallet game list at 100
 * via `ltrim(0, 99)`, which silently evicted analyzed games once a player
 * generated more than 100 matches. Cluster E raises the cap to 200 and
 * replaces the blind trim with this helper, which evicts the oldest
 * UNANALYZED entry first and protects analyzed games from eviction.
 *
 * The helper lives in its own module — separate from `persistence.ts`,
 * which handles the `coach:analysis` Supabase domain — to keep storage
 * concerns from blurring across files. Spec §0.1 / Code Map.
 */
export const GAME_LIST_CAP = 200;

/**
 * Canonical RFC4122 v4 UUID shape for `gameId`. Single source of truth
 * for every persistence boundary that touches the per-wallet game list:
 *
 * - `/api/games` POST input validation,
 * - `/api/games` GET response filter (defense-in-depth against legacy
 *   or corrupt entries that bypassed input validation),
 * - `/api/coach/analyze` input validation,
 * - `coach-history.tsx` client-side parse guard.
 *
 * Case-insensitive — Redis stores whatever case the client sent. Cluster
 * E defer #4 (edge-case hunter #11): defense-in-depth UUID validation.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Atomic LPOS-then-LPUSH for the per-wallet game list. Closes the
 * TOCTOU race where two concurrent POSTs with the same gameId both
 * observe `LPOS = nil` and both `LPUSH`, producing duplicate head
 * entries. Redis Lua scripts execute single-threaded — no other
 * command interleaves during execution.
 *
 * - `KEYS[1]` = game list key (`coach:games:<wallet>`).
 * - `ARGV[1]` = candidate `gameId`.
 * - Returns `1` when the entry was pushed, `0` when it was already
 *   present and the call was a no-op. Cluster E defer #1; red-team
 *   at `docs/reviews/2026-05-21-cluster-e1-lua-atomicity-redteam.md`.
 *
 * Note on Lua semantics: `LPOS` returns `nil` when absent, an integer
 * index when present (including `0` for the head). In Lua only `nil`
 * and `false` are falsy — integer `0` is truthy — so the conditional
 * `if redis.call('LPOS', …) then` correctly treats "found at head"
 * as a duplicate.
 */
export const GAME_LIST_LPUSH_LUA = `
  if redis.call('LPOS', KEYS[1], ARGV[1]) then return 0 end
  redis.call('LPUSH', KEYS[1], ARGV[1])
  return 1
`;

/**
 * Atomic EXISTS-then-LREM for a single candidate eviction. Closes the
 * TOCTOU race inside the `enforceGameCap` loop where a `/api/coach/analyze`
 * write of any `coach:analysis:<wallet>:<gameId>[:<locale>]` could land
 * between the JS `redis.exists(...)` check and the `redis.lrem(...)`
 * removal — causing a freshly-analyzed game record to be evicted while
 * its analysis row survives, leaving an orphaned analysis with no
 * replayable game.
 *
 * - `KEYS[1]` = game list key (`coach:games:<wallet>`).
 * - `KEYS[2]` = legacy analysis key (`coach:analysis:<wallet>:<gameId>`).
 * - `KEYS[3]` = per-locale EN key (`coach:analysis:<wallet>:<gameId>:en`).
 * - `KEYS[4]` = per-locale ES key (`coach:analysis:<wallet>:<gameId>:es`).
 * - `ARGV[1]` = candidate `gameId`.
 * - Returns `1` when the entry was unanalyzed and got removed, `0` when
 *   the entry is analyzed (in ANY locale) and was protected.
 *
 * `EXISTS` accepts multiple keys and returns the count of existing keys —
 * `> 0` means "at least one analysis record survives, do not evict."
 *
 * Note on race scope: this script only closes the inner EXISTS+LREM
 * window (Race B in the defer notes — the only one with corruption
 * potential). The outer LLEN→LRANGE window (Race A) is left non-atomic
 * by design: its worst case is an over-evict-by-1 that self-corrects on
 * the next POST. Closing it would require either a single all-up Lua
 * script (much more complex control flow) or a per-wallet lock — both
 * disproportionate to the symptom.
 */
export const EVICT_IF_UNANALYZED_LUA = `
  if redis.call('EXISTS', KEYS[2], KEYS[3], KEYS[4]) > 0 then return 0 end
  redis.call('LREM', KEYS[1], 1, ARGV[1])
  return 1
`;

export type EnforceGameCapResult = {
  /** GameIds removed from the list, in eviction order (oldest first). */
  evicted: string[];
  /**
   * `true` when the overflow window contained at least one analyzed
   * entry that could not be evicted. Callers should fire
   * `game_persist_cap_overflow` server-side telemetry via the
   * `onOverflow` hook.
   */
  softOverflow: boolean;
};

export type EnforceGameCapOverflowInfo = {
  wallet: string;
  listLength: number;
  analyzedInTail: number;
};

export type EnforceGameCapOptions = {
  /** Override for tests; defaults to {@link GAME_LIST_CAP}. */
  cap?: number;
  /**
   * Fires once when the overflow window contained at least one analyzed
   * entry that could not be evicted. The route handler binds this to a
   * structured logger (`game_persist_cap_overflow`). The helper itself
   * is logger-agnostic.
   */
  onOverflow?: (info: EnforceGameCapOverflowInfo) => void;
};

type GameCapRedis = Pick<Redis, "llen" | "lrange" | "pipeline">;

/**
 * Enforces the per-wallet game-list cap by evicting the oldest unanalyzed
 * entries until either the list is back at `cap` or every overflow entry
 * is analyzed (soft overflow).
 *
 * The Redis list is push-newest-to-head (via `lpush` upstream), so the
 * overflow window is `[cap, length-1]` and the array returned by
 * `lrange(cap, -1)` is ordered newest→oldest. The function queues evals in
 * reverse iteration order so the OLDEST gameId is evicted first.
 *
 * Cluster E defer #18: every per-entry `EVICT_IF_UNANALYZED_LUA` invocation
 * is queued onto a single `redis.pipeline()` and flushed with one `.exec()`
 * — collapsing N HTTP round-trips to Upstash into one, regardless of the
 * overflow size. Each script invocation remains atomic per the Lua
 * docstring (Race B closure preserved); the pipeline is purely a wire-level
 * batch, not a Redis MULTI/EXEC transaction.
 *
 * Called after the route handler's `redis.lpush(...)`. Safe to call when
 * `length <= cap` — the function is a no-op in that case.
 */
export async function enforceGameCap(
  redis: GameCapRedis,
  wallet: string,
  options: EnforceGameCapOptions = {},
): Promise<EnforceGameCapResult> {
  const cap = options.cap ?? GAME_LIST_CAP;
  const listKey = REDIS_KEYS.gameList(wallet);

  const length = await redis.llen(listKey);
  if (length <= cap) {
    return { evicted: [], softOverflow: false };
  }

  const tail = await redis.lrange<string>(listKey, cap, -1);

  // Defense-in-depth: if `lrange` returns null entries (Redis-level data
  // corruption or a concurrent LREM hole), they can't be evicted by
  // gameId so they shouldn't count toward the eviction target. Without
  // this clamp, a null entry inflates `overflowCount` and the post-loop
  // `evicted.length < overflowCount` check fires a false softOverflow
  // burst into telemetry. Closes deferred-work Edge case hunter #9
  // (2026-05-20).
  const validTailCount = tail.reduce(
    (acc, entry) => (entry ? acc + 1 : acc),
    0,
  );
  const overflowCount = Math.min(length - cap, validTailCount);

  // First pass — collect candidate gameIds in eviction order (oldest first)
  // and queue one EVICT_IF_UNANALYZED_LUA call per candidate on a single
  // pipeline. Falsy entries (Redis-level corruption) are skipped above
  // via `overflowCount` clamping; the softOverflow signal now only fires
  // when a real analyzed entry blocks eviction.
  const candidates: string[] = [];
  const pipeline = redis.pipeline();
  for (let i = tail.length - 1; i >= 0; i -= 1) {
    const gameId = tail[i];
    if (!gameId) continue;
    candidates.push(gameId);
    pipeline.eval(
      EVICT_IF_UNANALYZED_LUA,
      [
        listKey,
        REDIS_KEYS.analysisLegacy(wallet, gameId),
        REDIS_KEYS.analysis(wallet, gameId, "en"),
        REDIS_KEYS.analysis(wallet, gameId, "es"),
      ],
      [gameId],
    );
  }

  // Single round-trip — skip the network call entirely when the overflow
  // window yielded no usable candidates (all falsy).
  const results =
    candidates.length > 0 ? await pipeline.exec<number[]>() : [];

  // Second pass — fold pipeline results into evicted[] / analyzedInTail.
  // Order is preserved: results[i] corresponds to candidates[i].
  const evicted: string[] = [];
  let analyzedInTail = 0;
  for (let i = 0; i < candidates.length; i += 1) {
    if (results[i] === 0) {
      analyzedInTail += 1;
      continue;
    }
    evicted.push(candidates[i]!);
  }

  if (evicted.length < overflowCount) {
    options.onOverflow?.({
      wallet,
      listLength: length,
      analyzedInTail,
    });
    return { evicted, softOverflow: true };
  }

  return { evicted, softOverflow: false };
}

type GetGameRecordRedis = Pick<Redis, "get">;

export type GetGameRecordOptions = {
  /** Locale to merge the cached Coach analysis under. Defaults to "en".
   *  When the requested locale isn't cached, the helper tries the
   *  other locale (then the legacy locale-agnostic key — already
   *  handled by `getCachedAnalysisWithFallback`) so a cold load of
   *  `/coach/[gameId]` never silently drops an analysis just because
   *  it was generated in the other language. */
  locale?: "en" | "es";
};

/**
 * Single source of truth for "read one game record by wallet+id".
 *
 * Used by both `/api/games/[id]` (client-facing) and the `/coach/[gameId]`
 * server component (SSR). The server component calls this directly instead
 * of going through the API route — that roundtrip used to be intercepted
 * by Vercel Deployment Protection with a 401 because internal server-to-
 * server fetches don't carry the user's auth cookie.
 *
 * 2026-06-05 — the helper also inlines the cached Coach analysis from
 * the separate `coach:analysis:<wallet>:<gameId>:<locale>` key when one
 * exists. Previously `GameRecord.analysis` was an aspirational field
 * filled by a `/api/coach/check-analysis` route that was never built;
 * `/coach/[gameId]` showed an empty viewer on cold load even when a
 * full analysis was sitting in Redis. The merge fixes that: cold loads
 * surface the same content the inline `/arena` flow showed at game-end,
 * so the two surfaces converge.
 *
 * Caller is responsible for input validation (`isAddress`, `UUID_RE`).
 * The wallet is normalized to lowercase to match the canonical Redis
 * key shape produced by `REDIS_KEYS.game`.
 */
export async function getGameRecord(
  redis: GetGameRecordRedis & Pick<Redis, "get">,
  wallet: string,
  gameId: string,
  options: GetGameRecordOptions = {},
): Promise<GameRecord | null> {
  const normalizedWallet = wallet.toLowerCase();
  const record = await redis.get<GameRecord>(
    REDIS_KEYS.game(normalizedWallet, gameId),
  );
  if (!record) return null;

  // Skip the analysis merge when the persisted record already carries
  // one (defensive — keep older write paths idempotent if they ever
  // write an inline analysis). Otherwise pull from the dedicated
  // analysis key, trying the requested locale first then the other.
  if (record.analysis) return record;

  const requestedLocale = options.locale ?? "en";
  const otherLocale: "en" | "es" = requestedLocale === "en" ? "es" : "en";

  // Cast to the cache-fallback signature — that helper takes the full
  // Redis client but only calls `.get`, which is the same surface this
  // helper already requires.
  const fullRedis = redis as Redis;

  const primary = await getCachedAnalysisWithFallback(
    fullRedis,
    normalizedWallet,
    gameId,
    requestedLocale,
  );
  if (primary) {
    return { ...record, analysis: primary };
  }

  const secondary = await getCachedAnalysisWithFallback(
    fullRedis,
    normalizedWallet,
    gameId,
    otherLocale,
  );
  if (secondary) {
    return { ...record, analysis: secondary };
  }

  return record;
}
