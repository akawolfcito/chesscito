import type { Redis } from "@upstash/redis";
import { REDIS_KEYS } from "./redis-keys";

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
 * write of `coach:analysis:<wallet>:<gameId>` could land between the JS
 * `redis.exists(...)` check and the `redis.lrem(...)` removal — causing
 * a freshly-analyzed game record to be evicted while its analysis row
 * survives, leaving an orphaned analysis with no replayable game.
 *
 * - `KEYS[1]` = game list key (`coach:games:<wallet>`).
 * - `KEYS[2]` = analysis key (`coach:analysis:<wallet>:<gameId>`).
 * - `ARGV[1]` = candidate `gameId`.
 * - Returns `1` when the entry was unanalyzed and got removed, `0` when
 *   the entry is analyzed and was protected.
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
  if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
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

type GameCapRedis = Pick<Redis, "llen" | "lrange" | "eval">;

/**
 * Enforces the per-wallet game-list cap by evicting the oldest unanalyzed
 * entries until either the list is back at `cap` or every overflow entry
 * is analyzed (soft overflow).
 *
 * The Redis list is push-newest-to-head (via `lpush` upstream), so the
 * overflow window is `[cap, length-1]` and the array returned by
 * `lrange(cap, -1)` is ordered newest→oldest. The function iterates the
 * array in reverse so the OLDEST gameId is evicted first.
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
  const overflowCount = length - cap;
  const evicted: string[] = [];
  let analyzedInTail = 0;

  for (let i = tail.length - 1; i >= 0 && evicted.length < overflowCount; i -= 1) {
    const gameId = tail[i];
    if (!gameId) continue;
    // Atomic EXISTS-then-LREM via Lua. See EVICT_IF_UNANALYZED_LUA
    // docstring for the race this closes.
    const result = await redis.eval(
      EVICT_IF_UNANALYZED_LUA,
      [listKey, REDIS_KEYS.analysis(wallet, gameId)],
      [gameId],
    );
    if (result === 0) {
      analyzedInTail += 1;
      continue;
    }
    evicted.push(gameId);
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
