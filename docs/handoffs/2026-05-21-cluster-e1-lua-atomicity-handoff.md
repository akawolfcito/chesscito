# Session Handoff — 2026-05-21 (Cluster E #1 · Lua atomicity)

Fifth session of the day, sibling of:

- `2026-05-21-session-handoff.md` (editorial cleanup + DeepSeek)
- `2026-05-21-traceability-hygiene-handoff.md` (Acción B housekeeping)
- `2026-05-21-vr-fixture-harness-handoff.md` (VR-5/7/8 fixture harness)
- `2026-05-21-cluster-e-hardening-trio-handoff.md` (Blind #12 + Edge #5 + Edge #16-telemetry)

This one closes **Cluster E adversarial-review defer #1** — the last remaining
correctness item from the 2026-05-20 review. Scope was tight (one ship, ½ día)
and the defect was well-bounded (atomic envelope around 2 Redis commands).

## Status snapshot

- **Branch**: `main` — pushed (`origin/main` is at `e000ed3f`).
- **Build**: 1743 passing / 0 baseline failing · `tsc` clean.
- **Last commit**: `e000ed3f`.

## Decision before code: red-team first

Per CLAUDE.md ("spec → red-team → staged TDD → atomic commits → handoff"), wrote
an adversarial review **before** touching code:
`docs/reviews/2026-05-21-cluster-e1-lua-atomicity-redteam.md` (112 lines).

Verdict: 0 critical / 0 high / 3 medium / 4 low. Two mediums folded into the plan
(F1 Lua truthiness of `0`, F3 test-mock cleanup); two lows accepted with reasoning
(F4 script location → `game-persistence.ts`; F5 no real atomicity test in unit env
— correctness derives from Redis Lua single-threaded semantics + existing
`SHIELD_CREDIT_LUA` precedent).

## Shipped this session (1 commit)

**`e000ed3f` — fix(api): atomic LPOS+LPUSH on /api/games POST via Lua eval**

- Defect: after `44488d29` the route did `lpos` then conditional `lpush`. That
  closes **serial retries** but leaves a TOCTOU window for **concurrent
  same-`gameId` POSTs** — both see `lpos === null`, both `lpush`, two head
  entries → FIFO eviction `lrem(list, 1, gameId)` strips the newer copy first
  and the stale one stays.
- Fix: replace the two-step with a single `redis.eval()` Lua script. Redis Lua
  runs single-threaded; no command interleaves. Same pattern as
  `SHIELD_CREDIT_LUA` in `/api/credit-shield/route.ts:42-50`.
- Constant location: exported `GAME_LIST_LPUSH_LUA` from
  `apps/web/src/lib/coach/game-persistence.ts` (clusters with `enforceGameCap`,
  enables exact-string assertion in tests).
- Tests: 3 old "idempotent lpush dedupe" tests replaced by 5 new "atomic
  LPOS+LPUSH via Lua eval" tests — eval delegation + script reference + return
  branches (`1`=pushed, `0`=skipped) + "no direct LPOS/LPUSH calls" guard +
  5-parallel-POST regression net. Net +2 tests (1741 → 1743).
- Perf side effect: 3 Upstash round-trips → 2 on the duplicate path.

## Lua script (canonical reference)

```lua
-- KEYS[1] = gameList key (`coach:games:<wallet>`)
-- ARGV[1] = candidate gameId
-- Returns 1 when pushed, 0 when already present.
if redis.call('LPOS', KEYS[1], ARGV[1]) then return 0 end
redis.call('LPUSH', KEYS[1], ARGV[1])
return 1
```

Note on Lua semantics: `LPOS` returns `nil` when absent, integer index when
present (including `0` for the head). In Lua, only `nil` and `false` are falsy;
integer `0` is truthy — so `if redis.call('LPOS', …) then return 0 end`
correctly treats "found at head" as a duplicate.

## Pivots from initial plan

| Original step | Pivot | Reason |
|---|---|---|
| Inline `GAME_LIST_LPUSH_LUA` in `route.ts` | Export from `game-persistence.ts` | Red-team F4: enables `expect(redis.eval).toHaveBeenCalledWith(GAME_LIST_LPUSH_LUA, …)` in tests vs. brittle string match. Also clusters with sibling `enforceGameCap`. |
| Plain `vi.mock` of game-persistence | `vi.mock` with `importOriginal` | Need real `GAME_LIST_LPUSH_LUA` available alongside the `enforceGameCapMock` override. |
| Keep `lpush`/`lpos` mocks configured | Reset only, no `mockResolvedValue` | Red-team F3: dead mock setup hides a real regression if route accidentally re-introduces direct calls. Added explicit "not called" guard test. |

## Verification

- `pnpm exec tsc --noEmit` (apps/web) → 0 errors.
- `pnpm test` → **1743 passing / 0 failing** (route-scoped: 23/23 green).
- RED phase verified before GREEN: 3 expected failures (eval not called, lpos
  still called by route) — exactly the contract under test.

## In flight — nothing

Pushed clean to `origin/main`. No local-only state.

## Cluster Closure Protocol checklist

Per CLAUDE.md "Cluster Closure Protocol", this closes the **adversarial-review
defer list** subset that was actionable. State of remaining items:

1. **GitHub housekeeping** — N/A this session (no issues opened for individual
   defer items; they live in `_bmad-output/implementation-artifacts/deferred-work.md`).
2. **README sync** — N/A (no user-visible surface change).
3. **MEMORY.md sync** — defer #1 closed; deferred-work.md is the canonical ledger.
4. **Branch hygiene** — N/A (worked on `main` directly).
5. **Handoff doc** — this file.

## Backlog (carried forward)

### High payoff (next session candidates)

- **Cluster F (Coach re-entry + GameRecord persistence)** — outstanding per
  `2026-05-20-post-domain-migration-addendum-handoff.md`. **Recommended next.**
  Bigger surface; benefits from a dedicated session with full context loading.
- **PR #107 (`phase-1-ui-zone-map`)** — open since 2026-05-02, needs triage.
  Tracked in `_bmad-output/implementation-artifacts/deferred-work.md`.

### Medium

- **VR-7 expansion** — 4 variants (win/loss/draw/resigned) differ in surrounding
  CTAs. Would need a `/dev/arena-end-state` route mounting `<ArenaEndState>`
  with controlled props.
- **Coach-history toast surface** — deferred UX half of Edge hunter #16. Needs
  toast infra decision.

### Deferred (low priority / tracked)

- **D. CI VR job** — explicit activation triggers in `deferred-work.md`.
- **Cluster E remaining defers** (5 items now, all Low/Very-low polish):
  - **#4** UUID validation on GET response (client-side).
  - **#5** LatestReviewCard a11y (outside `role="list"`).
  - **#11** + **#15** + **#18** — defer-work.md tracks them.
- **enforceGameCap eviction race** — non-atomic `LLEN` → `LRANGE` → `LREM`
  sequence. Pre-existing, not introduced by this fix; worst case over-evicts by
  1 and self-corrects on next POST. Acceptable; own QD spec if it ever needs one.

### Closed in-session

- ~~**Cluster E defer #1.** Concurrent POST atomicity (Lua script)~~ — commit
  `e000ed3f`.

## Decisions made this session

1. **Red-team before code, even on a ½-día item.** Defer list called for "own QD
   spec needed" — substituted a focused 112-line adversarial review for a full
   spec because the defect was narrow (atomic envelope around 2 commands) and
   precedent existed. Trade-off documented; full spec would have been overkill.
2. **Export Lua constant over inline.** Red-team F4. Test assertability +
   discoverability beat the marginal simplicity of an inline string.
3. **TDD discipline kept.** RED → 3 expected failures → GREEN → 1743 passing.
   No shortcut via "I know what the fix is, let me just edit."
4. **Push immediately, handoff per discipline.** Cluster E #1 was a clean
   shipment; mixing it with Cluster F in the same handoff would dilute both.

## Next session — recommended order

1. **Cluster F (Coach re-entry + GameRecord persistence)** — outstanding per
   2026-05-20 addendum handoff. Largest open user-visible item.
2. Apply Cluster Closure Protocol when F wraps.
3. Optional: triage PR #107 if F lands quickly.

Session budget: this session used ~10 tasks (red-team + 4 edits + 3 verifications
+ commit + push + handoff). Plenty of headroom remaining.

---

**Wolfcito 🐾 @akawolfcito**
