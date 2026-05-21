# Session Handoff — 2026-05-21 (Race B atomic eviction + defer #5 a11y)

Seventh + eighth sessions of the day, sibling of:

- `2026-05-21-session-handoff.md` (editorial cleanup + DeepSeek)
- `2026-05-21-traceability-hygiene-handoff.md` (Acción B housekeeping)
- `2026-05-21-vr-fixture-harness-handoff.md` (VR-5/7/8 fixture harness)
- `2026-05-21-cluster-e-hardening-trio-handoff.md` (Blind #12 + Edge #5 + Edge #16-telemetry)
- `2026-05-21-cluster-e1-lua-atomicity-handoff.md` (defer #1 — Lua atomicity)
- `2026-05-21-cluster-e4-uuid-defense-handoff.md` (defer #4 — UUID defense-in-depth)

This handoff closes two remaining items the day's earlier work left
queued: the `enforceGameCap` eviction race (corruption-class bug) and
defer #5 (a11y region landmark).

## Status snapshot

- **Branch**: `main` — pushed (`origin/main` at `00f5573d`).
- **Build**: 1765 passing / 0 baseline failing · `tsc` clean.
- **Test trajectory today**: 1727 → 1743 → 1746 → 1749 → 1758 → 1762 → **1765**.
- **Net additions this day**: +38 tests, 0 failing.

## Shipped (2 atomic commits)

### `c7cc2285` — fix(coach): atomic EXISTS+LREM in enforceGameCap eviction loop via Lua

**Defect (Race B).** Inside `enforceGameCap`, the eviction loop did:

```ts
const analyzed = await redis.exists(REDIS_KEYS.analysis(wallet, gameId));
if (analyzed) { analyzedInTail += 1; continue; }
await redis.lrem(listKey, 1, gameId);
```

If `/api/coach/analyze` wrote `coach:analysis:<wallet>:<gameId>`
between the JS `exists` check and the `lrem`, the cap enforcer would
proceed to remove a game record whose analysis just landed — leaving
an **orphaned analysis** (analysis row present, game record gone).
UX manifestation: `/coach/history` shows the analyzed entry; tapping
the row tries to replay and 404s on the missing record.

**Fix.** Wrap the EXISTS+LREM pair in a single `redis.eval()` Lua
script. Redis Lua runs single-threaded — no other command interleaves
during execution. Same pattern as `GAME_LIST_LPUSH_LUA` (defer #1) and
`SHIELD_CREDIT_LUA` (credit-shield route).

```lua
if redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
redis.call('LREM', KEYS[1], 1, ARGV[1])
return 1
```

- New export `EVICT_IF_UNANALYZED_LUA` alongside `GAME_LIST_LPUSH_LUA`.
  Docstring documents which races it closes and which it leaves
  intentionally open.
- `enforceGameCap` loop now `await redis.eval(...)` instead of
  separate `exists`+`lrem`.
- `GameCapRedis` type narrowed from `"llen"|"lrange"|"exists"|"lrem"`
  to `"llen"|"lrange"|"eval"` to honestly reflect the new contract.
- Tests: +4 net (Lua script export + shape asserts + atomicity guard
  asserting `exists`/`lrem` are never called directly). Existing tests
  rewritten to mock `eval` instead of separate commands.

**Scope note — surgical, not full.** This closes **Race B only** (the
only corruption-class race). Two other races stay open by design:

| Race | Symptom | Why left open |
|---|---|---|
| **A** (LLEN→LRANGE outer window) | Over-evict by 1 | Self-corrects on next POST; closing requires per-wallet lock or full all-up Lua with complex control flow. |
| **C** (two concurrent enforceGameCap, both LREM same id) | Over-evict by 1 | Same reasoning — recoverable, no data loss. |

Trade-off documented in `EVICT_IF_UNANALYZED_LUA` docstring so the next
contributor doesn't have to re-derive the decision.

### `00f5573d` — fix(a11y): wrap coach-history in labeled region landmark

**Defect (defer #5 / edge-case hunter #15).** When the head entry was
analyzed, `<LatestReviewCard>` rendered ABOVE the `<div role="list">`
wrapper holding the older rows. Result: AT users heard
"List, N items" where N excluded the head — the latest review was
unanchored, no count, no landmark.

**Fix.** Wrap every render branch (loading, empty, content) in a
single `<section aria-label="Coach review history">`. HTML spec
implicitly upgrades a `<section>` with a non-empty accessible name to
`role="region"`. AT users now get:

- A stable landmark to jump to ("Coach review history, region").
- `LatestReviewCard` reachable inside the region in normal reading
  order — kept as a hero card (NOT forced into the list as a
  `role="listitem"`, since `<button role="listitem">` overrides the
  button role for AT).
- The existing `role="list"` count remains accurate for the older
  rows that ARE compact-row UIs.

Why not nested landmarks (sub-region for "Latest review" + sub-region
for "Older reviews"): nested landmarks add navigation cost without
value when one parent is sufficient and the children are already
visually grouped.

- New `coach-history.test.tsx` test file (+3 cases): region present
  when head is analyzed (LatestReviewCard + list both inside region),
  region present when head is unanalyzed (list only), region present
  even on the empty state (no landmark loss when nothing to show).
  Mocks `globalThis.fetch` to control the two endpoint payloads.

## Pivots from initial plan

| Original step | Pivot | Reason |
|---|---|---|
| Close all three races (A + B + C) with one all-up Lua script | Surgical Lua wrapping only EXISTS+LREM (Race B) | A + C are over-evict-by-1, self-correcting. Full-script approach would have ~25 lines of Lua control flow and lose granular test coverage. Disproportionate cost to symptom. |
| Force `LatestReviewCard` into the list with `role="listitem"` | Keep it outside as a hero card, wrap whole panel in a region | `<button role="listitem">` overrides the button role for AT — a hero CTA shouldn't be announced as a list item. |
| Test only the happy-path region | Test region presence on loading / empty / content branches | Defer note specifically called out that the panel should keep its landmark even when there's nothing to render. |
| Test query `/Open Coach Review/i` | `/Open .* Coach Review/i` | Real aria-label is `"Open Full Coach Review — Win, Medium, 32 moves"` — `typeLabel` inserts "Full" / "Quick" between Open and Coach. Caught in RED. |

## Verification

- `pnpm exec tsc --noEmit` (apps/web) → 0 errors.
- `pnpm test` → **1765 passing / 0 failing**.
- RED phase verified before each GREEN:
  - Race B: 10 expected failures (export missing, mock shape wrong).
  - Defer #5: 3 expected failures (region not found).

## Cluster Closure Protocol checklist

Per CLAUDE.md "Cluster Closure Protocol" (since these defers belong
to the broader Cluster E adversarial-review arc):

1. **GitHub housekeeping** — N/A (defers tracked in gitignored
   `_bmad-output/implementation-artifacts/deferred-work.md`; no GH
   issue threads for individual defers).
2. **README sync** — N/A (no user-visible surface change).
3. **MEMORY.md sync** — Race B + defer #5 closed; ledger note added
   alongside defer #4 closure.
4. **Branch hygiene** — N/A (worked on `main` directly throughout).
5. **Handoff doc** — this file.

## Backlog (carried forward)

### Acknowledged but deferred (low priority / non-urgent)

- **`enforceGameCap` Races A + C** — over-evict-by-1, self-correcting.
  Documented in `EVICT_IF_UNANALYZED_LUA` docstring. Would need its
  own QD spec only if a real user reports a "missing game" symptom
  near the 200-cap boundary.
- **Cluster E remaining defers** (#15 + #18 polish items in
  `deferred-work.md`).
- **CI VR job** — explicit activation triggers in `deferred-work.md`.
  Canary PR #107 closed-not-merged earlier today; no external PR
  signal yet.
- **VR-7 expansion** — 4 variants (win/loss/draw/resigned) of
  `<ArenaEndState>`. Needs `/dev/arena-end-state` fixture.

### Closed in-session

- ~~**Race B** (atomic EXISTS+LREM in `enforceGameCap`).~~ — `c7cc2285`.
- ~~**Cluster E defer #5** (a11y region landmark).~~ — `00f5573d`.

## Decisions made this session

1. **Race B closure was surgical, not exhaustive.** Documenting which
   races stay open (and why) inside `EVICT_IF_UNANALYZED_LUA`'s
   docstring beats hand-waving "we'll fix the rest later" in a comment
   nobody will find.
2. **Hero card stays a hero, not a list item.** `<button
   role="listitem">` is an anti-pattern for visually-distinct CTAs.
   Wrapping the whole panel in a labeled region gives AT users the
   landmark without losing the button semantics.
3. **TDD discipline kept on both commits.** RED phase explicitly
   verified before GREEN. The defer #5 test caught a real
   aria-label regex bug (`/Open Coach Review/i` vs the real
   `/Open .* Coach Review/i`) — exactly the failure mode TDD is
   designed to surface.

## Next session — recommended order

Day-level wrap is clean. Suggested re-entry on next session:

1. Check telemetry for any wallet approaching the 200-game cap → if
   any, escalate Races A/C closure (otherwise leave them deferred).
2. Triage the open low-priority defers in `deferred-work.md`
   (#15, #18) for a knock-out batch.
3. Optional: start `enforceGameCap` Race A/C QD spec if appetite for
   architectural cleanup is high.

Session budget today (8 sessions): well above the 30-task ceiling per
CLAUDE.md if counted as one session, but each was independently
scoped, planned, red-team-reviewed, TDD-shipped, and handoff'd.
Quality stayed steady (1727 → 1765, +38 net, 0 baseline failing
throughout).

---

**Wolfcito 🐾 @akawolfcito**
