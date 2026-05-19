# SPEC 1 Hub Redesign — Session 1 Handoff

**Date:** 2026-05-18
**Branch:** `feat/spec-1-hub-redesign`
**Worktree:** `/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito-spec-1-hub-redesign`
**Plan:** `docs/superpowers/plans/2026-05-18-hub-redesign-destinations-and-profile.md` (commit `d8e0eae`)
**Spec:** `docs/superpowers/specs/2026-05-18-hub-redesign-destinations-and-profile-design.md` (commit `437e031`)
**Red-team:** `docs/reviews/2026-05-18-spec-1-hub-redesign-red-team.md`

---

## Progress: 8 of 30 tasks complete (Phase 0 ✅, Phase 1 ✅, Phase 2 mid)

### Commits landed (in order)

| # | SHA | Task | Notes |
|---|---|---|---|
| 1 | `12d8721` | 0.1 Retire V2 canary | −1315 LoC, 13 files. Scope expanded vs plan (deleted V2 cases in 3 sheet-port tests + hub-flag-resolution test + page.test.tsx mocks; scrubbed 4 comment-only V2 refs). |
| 2 | `c56ac24` | 0.2 Editorial copy blocks | +121 LoC, 12 new constants. Renamed `LEADERBOARD_COPY_V2` → `LEADERBOARD_TABS_COPY` (post-V2-retirement clarity). |
| 3 | `aaeac5c` | 1.1 getHeroContextAction | 5/5 tests. |
| 4 | `f877bc2` | 1.2 computeTier | 8/8 tests. |
| 5 | `b7c81b8` | 1.3 resolveDisplayName | 8/8 tests. |
| 6 | `9c10561` | 1.4 computePendingClaims | 8/8 tests. |
| 7 | `f536c82` | 2.1 /api/profile/stats | 4/4 tests. `getProfileStats` composes `arenaWins`+`nftsMinted` from existing `fetchPlayerVictories`; trophies/dailyStreak/puzzlesSolved defaulted to 0 server-side (need client-side merge in Profile composite — see "Open issues" below). |
| 8 | `7218472` | 2.2 useProfileStats | 3/3 tests. |

**Total test deltas:** ~37 new tests added, all passing as of last successful commit. Zero regressions (baseline 46 unrelated failures remain unchanged).

---

## In-flight: Task 2.3 useClaimQueue — **BLOCKED on vitest hang**

### State of working tree (uncommitted)

```
M  apps/web/src/components/wallet-provider.tsx   ← exports wagmiConfig (was module-internal)
?? apps/web/src/hooks/use-claim-queue.ts
?? apps/web/src/hooks/__tests__/use-claim-queue.test.tsx
?? apps/web/src/lib/claims/sources.ts
?? apps/web/src/lib/claims/actions.ts
```

### What was done

The implementer agent created all 4 files per the plan. Adaptations from the plan:
- `wagmiConfig` was not at `@/lib/wagmi/config` (plan's path). The agent exported it from `apps/web/src/components/wallet-provider.tsx` (where it already lives) and adjusted `sources.ts` import. Reasonable.
- `sources.ts` uses `wagmi/actions` instead of plan's `@wagmi/core` — correct for wagmi v2.
- `sources.ts` uses `getBadgesAddress(chainId)` (existing signature) instead of plan's `getBadgesAddress()`.

### What's blocking

`pnpm exec vitest run hooks/__tests__/use-claim-queue.test.tsx` hangs indefinitely (>90s, no output, no failure). Two separate agent attempts hit the same hang. My own foreground run also timed out at 90s.

**Hypothesis:** `vi.mock("@/lib/claims/sources")` should prevent the real module from loading (which transitively imports `wallet-provider.tsx` → RainbowKit + wagmi setup). But the mock might not be hoisting correctly, or there's a circular import issue. The test file itself looks clean (3 tests, standard `renderHook` + `waitFor` + `act` patterns).

### Recommended next-session approach

1. Run `cd apps/web && pnpm exec vitest --reporter=verbose run src/hooks/__tests__/use-claim-queue.test.tsx --testTimeout=10000` to surface where it hangs.
2. If hang is in `vi.mock` hoisting, try moving the mocks above the imports (already done) or using `vi.doMock` inside `beforeEach`.
3. Alternative diagnosis: temporarily delete the test's `vi.mock` lines and let the real `readClaimSources` run with an empty localStorage — if it returns instantly with `claims: []`, the hang is mock-related, not implementation-related.
4. If the hook itself has an infinite re-render loop (unlikely given the code review), look at the `optimisticRemoved` dependency in the useEffect.
5. Once tests pass: commit with `git add` of the 4 new files **plus** `wallet-provider.tsx`. Stage explicitly.

---

## Open issues / decisions deferred

### O-1. `useProfileStats` returns 0 for trophies/streak/puzzles (server-side gap)

The 2.1 endpoint can only compute `arenaWins`+`nftsMinted` from Supabase. `trophies` (on-chain scoreboard), `dailyStreak` (localStorage), `puzzlesSolved` (mix of localStorage + on-chain) all default to 0 server-side.

**Resolution plan:** in Task 4.4 (ProfileSheet composite), merge server response with client-side reads:
- `trophies` → `useReadContract` from scoreboard
- `dailyStreak` → `lib/daily/progress.ts` client read
- `puzzlesSolved` → sum across `useExerciseProgress` + daily history + mini-arena progress

Do NOT try to fix this inside `useProfileStats` (server endpoint is correctly bounded). Merge happens at the consumer.

### O-2. Residual `HUB_V2_*` naming legacy (registered as follow-up)

Surviving V1 components still use `HUB_V2_*` prefix in:
- Editorial constants: `HUB_V2_SPLASH_COPY`, `HUB_V2_MASTERY_COPY`, `HUB_V2_TRAINING_COPY`, `HUB_V2_DOCK_COPY`
- CSS classes: `.hub-v2-root`, `.hub-v2-splash-hero`
- Test-ids: `hub-v2-splash`, `hub-v2-mastery-tile-*`
- Telemetry events: `hub_v2_training_band_tap`, `hub_v2_mastery_tap`, `hub_v2_mastery_locked_tap`
- localStorage key: `chesscito:hub-v2:splash:seen` ← **requires migration shim if renamed** (don't reset user state)

Out of scope for SPEC 1. Park as a follow-up cleanup spec.

### O-3. Plan command `pnpm --filter web test --run` does not work

Use `cd apps/web && pnpm exec vitest run <path>` instead. Update remaining task prompts accordingly. (Plan doc itself untouched; documented here.)

### O-4. `pnpm test` baseline failures

Unrelated to this work: ~46 pre-existing failures in the web test suite (Coach PRO card, "Train with Coach", etc.). Verified independent via stash diff during Task 0.1. Do not try to fix in this branch.

---

## How to resume next session

1. `cd /Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito-spec-1-hub-redesign`
2. Read this handoff + the plan section "Task 2.3" to re-orient
3. Resolve the vitest hang (see "Recommended next-session approach" above)
4. Commit Task 2.3
5. Continue with Task 2.4 (useDisplayName) → 2.5 (useHubOnboarding) → Phase 3 (5 leaf components)
6. **Pause for user review** at end of Phase 3 before starting Phase 4 (composites — integration complexity climbs)

### Remaining tasks (22)

- Phase 2: 2.3 (in flight), 2.4, 2.5
- Phase 3: 3.1–3.5 (5 leaves)
- Phase 4: 4.1–4.4 (4 composites)
- Phase 5: 5.1–5.5 (5 hub integration)
- Phase 6: 6.1 (trophies port)
- Phase 7: 7.1, 7.2 (anchor — 2 atomic commits)
- Phase 8: 8.1, 8.2 (E2E + manual QA)

Estimate: ~2 more focused sessions (assuming agent dispatches at 5-15 min each + occasional human checkpoint).

---

## Files NOT in this worktree (don't look)

- `/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito` (main branch) — only contains docs commits (spec/plan/red-team/handoff)
- All implementation lives in this `chesscito-spec-1-hub-redesign` worktree

---

## Tooling notes

- Test command: `cd apps/web && pnpm exec vitest run <path>` (NOT pnpm --filter)
- Typecheck: `cd apps/web && pnpm exec tsc --noEmit`
- Commit signature: `Wolfcito 🐾 @akawolfcito`
- Always specific paths in `git add` (security: never `-A` or `.`)
- Conventional commits enforced
