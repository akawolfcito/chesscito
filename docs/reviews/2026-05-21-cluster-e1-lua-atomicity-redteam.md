# Red-team — Cluster E #1 (Lua atomicity, `/api/games` POST)

**Date**: 2026-05-21
**Reviewer**: self (pre-implementation, adversarial pass)
**Subject**: proposed plan to replace JS-level `LPOS`/`LPUSH` two-step with atomic `EVAL` Lua script.
**Verdict**: **PROCEED** with two minor adjustments (see §5).

---

## 1. Threat model — what is the defect?

After `44488d29`, POST `/api/games` does:

```ts
const existingIndex = await redis.lpos(listKey, gameId); // (a)
if (existingIndex === null) await redis.lpush(listKey, gameId); // (b)
```

This closes **serial retries** (same client retrying after timeout). It does **NOT** close **concurrent same-`gameId` POSTs** — two requests both observe `(a) === null` and both execute `(b)`. Result: two head entries with the same `gameId`. FIFO eviction `lrem(list, 1, gameId)` then strips the newer copy first, leaving the stale one stranded.

This is the TOCTOU window the Cluster E defer #1 calls out.

## 2. Proposed fix

Move the `LPOS` + conditional `LPUSH` into a Lua script executed via `redis.eval()`. Redis Lua scripts are single-threaded per server — no other command interleaves. Same pattern as the existing `SHIELD_CREDIT_LUA` in `apps/web/src/app/api/credit-shield/route.ts:42-50`.

```lua
-- KEYS[1] = gameList key · ARGV[1] = gameId
-- Returns 1 when pushed, 0 when skipped (already present)
if redis.call('LPOS', KEYS[1], ARGV[1]) then return 0 end
redis.call('LPUSH', KEYS[1], ARGV[1])
return 1
```

`SET` stays outside the script (naturally idempotent — last write wins, same content). `enforceGameCap` stays outside (its own correctness story; not introduced by this fix).

## 3. Adversarial findings

### F1 (Medium) — Lua semantics: index 0 truthy?

`LPOS` returns the integer index of the first match, or `nil` if not found. In Lua, the only falsy values are `nil` and `false`. **Integer `0` is truthy.** The script's `if redis.call('LPOS', …) then return 0 end` therefore correctly treats "found at head (index 0)" as duplicate.

**Status**: not a bug, but documented here to forestall a future "fix" that adds `~= nil`.

### F2 (Medium) — Upstash `LPOS` availability

`LPOS` was added in Redis 6.0.6. Upstash runs Redis 7+. Confirmed by direct usage in `route.ts:53` post `44488d29` — already in production.

**Status**: no risk.

### F3 (Medium) — Test migration: mock leakage

The current test file mocks `lpos` and `lpush` and verifies their call sequence in a dedicated `describe("idempotent lpush dedupe")` block. After migration both calls disappear from the route — tests would assert on stale mocks. **Risk**: leaving the old `lpush.mockResolvedValue(1)` / `lpos.mockResolvedValue(null)` lines as cargo-cult dead setup, hiding a real regression if the route ever re-introduces them by accident.

**Mitigation**: rewrite the `idempotent lpush dedupe` block to assert on `redis.eval` directly; remove the dead `lpush`/`lpos` lines from `beforeEach` setup. Add a "no direct lpush/lpos calls" guard test.

### F4 (Low) — Script location / discoverability

Two reasonable homes for the Lua constant:
- **(a)** Inline in `route.ts` (simplest, matches `SHIELD_CREDIT_LUA` which lives inside its own route file).
- **(b)** Exported from `apps/web/src/lib/coach/game-persistence.ts` (clusters with `enforceGameCap`, makes it directly importable for testing).

**Pick**: **(b)** — `game-persistence.ts` is already the "Cluster E storage concerns" home; the script is a sibling primitive to `enforceGameCap`. Exports make the constant directly assertable in tests via `expect(redis.eval).toHaveBeenCalledWith(GAME_LIST_LPUSH_LUA, …)` instead of a brittle string match.

### F5 (Low) — Concurrency test in unit env

A unit test cannot *prove* Lua atomicity — it can only prove the route delegates to `eval`. The real guarantee derives from Redis single-threaded script execution. Same limitation applies to `SHIELD_CREDIT_LUA` — it has no atomicity test either.

**Mitigation**: write one "5 parallel POSTs same gameId → eval called 5 times, no throws, all 200" test as a regression net for future refactors. Document the limitation in a code comment.

### F6 (Low) — Performance

Before: 1 `SET` + 1 `LPOS` + 0–1 `LPUSH` = 2–3 Upstash HTTP round-trips per POST.
After: 1 `SET` + 1 `EVAL` = exactly 2 round-trips.

**Status**: net positive (~33% reduction at the duplicate path). No latency regression risk.

### F7 (Low) — Rollback

Single-commit revert restores the prior LPOS/LPUSH guard. The fix is additive at the Redis layer and has no schema/contract change. Worst case during rollout: `EVAL` errors → 500 → game not persisted, same blast radius as the existing `redis.set` failure path (already returns 500 + logs `game_persist_error`).

### F8 (Out of scope, documented for transparency)

- **SET race**: idempotent. Two concurrent SETs with same key write the same content. Not addressed.
- **enforceGameCap race**: separate non-atomic `LLEN` → `LRANGE` → `LREM` sequence. Worst case: one POST over-evicts by 1; self-corrects on next POST. Not introduced by this change. Tracked separately if it ever needs its own QD spec.
- **EVALSHA caching**: micro-optimization. Upstash supports `script load` + `evalsha` but the script string is tiny; `eval` is fine.

## 4. Cross-check against existing Lua precedent

The repo already runs Lua via Upstash in three places:
- `credit-shield/route.ts:42` — `SHIELD_CREDIT_LUA` (SETNX + INCRBY).
- `verify-pro/route.ts` (per `REDIS_KEYS.pro` comment) — extend PRO TTL atomically.
- `coach/credits/route.ts` — credit ops.

This change does not introduce a new dependency, pattern, or runtime surface — it follows the established convention.

## 5. Adjustments before implementation

1. **Locate Lua constant in `game-persistence.ts`** (export `GAME_LIST_LPUSH_LUA`). Enables direct-string assertion in tests; clusters with `enforceGameCap`.
2. **Test cleanup**: remove `lpush`/`lpos` mock setup lines from the route test's `beforeEach`; rewrite the `idempotent lpush dedupe` block to assert on `eval` (script ref + keys + argv + return value). Add a "no direct LPOS/LPUSH calls" sanity test. Add one "5 parallel POSTs → eval called 5 times" regression test.

## 6. Open questions

None blocking.

## 7. Verdict

**PROCEED.** No critical or high findings. Two mediums (F1, F3) are documentation/discipline items, both addressed in §5. Lows are tradeoffs accepted with reasoning. The fix is narrower than a full QD spec warrants — defect is well-bounded (2 commands, atomic envelope), precedent exists, rollback is trivial.

---

**Next**: implement per `2026-05-21-cluster-e1-lua-atomicity-handoff.md` plan with §5 adjustments folded in.
