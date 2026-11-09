/**
 * Atomic LPOS-then-LPUSH for `coach:analyses:<wallet>` — the per-wallet
 * list of analyzed gameIds rendered by `/api/coach/history`.
 *
 * Background. After the 2026-05-24 per-locale cache key migration the
 * legacy unconditional `redis.lpush(REDIS_KEYS.analysisList(wallet),
 * gameId)` in `/api/coach/analyze` started pushing the same `gameId`
 * twice whenever a game was analyzed in both EN and ES. Two costs:
 *   1. Duplicate read amplification on the GET path (every duplicate id
 *      doubles the `coach:analysis:<wallet>:<gameId>:<locale>` round-trip
 *      via `getCachedAnalysisWithFallback`).
 *   2. Pagination corruption — duplicates eat the visible window's 20
 *      slots even after a Set-dedup, because old entries get evicted
 *      off the tail to make room for the duplicate head push.
 *
 * Cost (1) was mitigated at read-time by widening the LRANGE to 0..49
 * and Set-deduping client-side. Cost (2) is closed here, at write-time,
 * by gating the LPUSH on absence — mirroring `GAME_LIST_LPUSH_LUA`
 * (Cluster E defer #1).
 *
 * - `KEYS[1]` = analysis list key (`coach:analyses:<wallet>`).
 * - `ARGV[1]` = candidate `gameId`.
 * - Returns `1` when the entry was pushed, `0` when the gameId is
 *   already present and the call was a no-op.
 *
 * Lua semantics note (same as the game-list cousin): `LPOS` returns
 * `nil` when absent, an integer index when present. In Lua only `nil`
 * and `false` are falsy — `0` (head position) is truthy — so the
 * conditional correctly treats "found at head" as a duplicate.
 */
export const ANALYSIS_LIST_LPUSH_LUA = `
  if redis.call('LPOS', KEYS[1], ARGV[1]) then return 0 end
  redis.call('LPUSH', KEYS[1], ARGV[1])
  return 1
`;
