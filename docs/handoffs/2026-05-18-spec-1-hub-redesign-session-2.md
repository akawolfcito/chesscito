# SPEC 1 Hub Redesign — Session 2 Handoff

**Date:** 2026-05-18 (same day, second sitting)
**Branch:** `feat/spec-1-hub-redesign`
**Worktree:** `/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito-spec-1-hub-redesign`
**Plan:** `docs/superpowers/plans/2026-05-18-hub-redesign-destinations-and-profile.md`
**Spec:** `docs/superpowers/specs/2026-05-18-hub-redesign-destinations-and-profile-design.md`
**Previous handoff:** `docs/handoffs/2026-05-18-spec-1-hub-redesign-session-1.md`

---

## Progress: 21 of 30 tasks complete (Phase 0 ✅, Phase 1 ✅, Phase 2 ✅, Phase 3 ✅, Phase 4 ✅, Task 4.5 ✅)

### Session 2 commits (this sitting, 12 atomic commits)

| # | SHA | Task | Notes |
|---|---|---|---|
| 9 | `7a2a6c5` | 2.3 useClaimQueue | Unblocked. 3/3 tests. **Fixed infinite-effect loop** — see §Bug. |
| 10 | `3016ae2` | 2.4 useDisplayName | 5/5 tests. Verbatim from plan. |
| 11 | `b24bfb9` | 2.5 useHubOnboarding | 3/3 tests. Verbatim. |
| 12 | `8f60b42` | 3.1 TierBadge | 2/2 tests. |
| 13 | `7768a90` | 3.2 DisplayNameDialog | 4/4 tests. `role="dialog"`, 44px touch targets. |
| 14 | `385d495` | 3.3 SecondaryCta | 2/2 tests. D5 (calm Arena link). |
| 15 | `0f901c3` | 3.4 SettingsSheetStub | 2/2 tests. Disabled toggles + Coming soon tooltip. |
| 16 | `a0b563f` | 3.5 HubOnboardingCard | 2/2 tests. |
| 17 | `deeebb7` | 4.1 ProfileBanner | 2/2 tests. **Spec deviation:** removed duplicate `.profile-banner-tier-row` block — plan's verbatim JSX rendered "Knight" twice (badge + row) which broke `getByText("Knight")`. Test is the contract. |
| 18 | `2040b61` | 4.2 PendingClaims | 5/5 tests. **Part B wiring DEFERRED — see §Wiring.** |
| 19 | `8b0a7db` | 4.3 GeneralStats | 2/2 tests. Always renders 6 cells. |
| 20 | `42ff0d5` | 4.4 ProfileSheet | 2/2 tests. **Spec deviation:** tightened `getByText(/wallet/i)` → `/^wallet$/i` because `PROFILE_COPY.disconnect = "Disconnect wallet"` collided with the Wallet utility row label. Component matches plan verbatim. |
| 21a | `917ec8c` | 4.5a useClaimQueue DI | 4/4 tests (+ new DI test). Optional `opts.performClaim` overrides default import. Default sentinel-throwing kept as defensive fallback. |
| 21b | `da52351` | 4.5b ProfileSheet wiring | 2/2 ProfileSheet tests (mock extended with `useChainId` + `useWriteContract`). Badge + Score wired w/ MiniPay fee-currency fallback. Victory-nft routes to `/arena`. |

**Cumulative SPEC 1 test surface:** 13 files / 38 tests, ALL green. Zero regressions on SPEC 1 surfaces.

**Baseline failures unchanged (O-4):** 9 failing tests in `hub-scaffold-client.test.tsx` + `hub-scaffold.test.tsx` (Coach PRO chip + Coach PRO card CTAs). These pre-date this branch — confirmed via stash diff during Task 0.1 and re-confirmed today. Do NOT try to fix in this branch.

---

## §Bug — Vitest hang in `useClaimQueue` (resolved)

### Root cause

The `useEffect(() => { ... }, [address, tick, optimisticRemoved])` in the original `use-claim-queue.ts` had:

```ts
if (!address) {
  setState(INITIAL);
  setOptimisticRemoved(new Set());   // <-- new Set ref each call
  return;
}
```

`new Set()` creates a fresh reference each time. React's dep-array comparison is `Object.is`, so the effect saw `optimisticRemoved` "change" every render → re-ran → called `setOptimisticRemoved(new Set())` again → infinite effect loop. The hook never settled, vitest worker pegged at 100% CPU, `expect(...)` in the test never executed (the test body runs *after* `renderHook` returns; it never returned).

Hypothesis from session-1 handoff (vi.mock hoisting / wagmi heavy import) was wrong. The mocks worked fine; the real loop was in the hook itself.

### Fix (committed in `7a2a6c5`)

```ts
setOptimisticRemoved((prev) => (prev.size === 0 ? prev : new Set()));
```

Functional updater returns the same `prev` reference when it's already empty. `Object.is`-equal → effect doesn't re-run. Set is still cleared when an address-set hook transitions to address-undefined.

### Diagnostic note

`diag` test (single sync assertion on `useClaimQueue(undefined)`) confirmed the loop happened on the simplest case. That isolated the bug to the hook (not the mocks).

---

## §Wiring — `performClaim` real flows (DEFERRED at Task 4.2 → RESOLVED via Task 4.5)

### Investigation summary

The plan's Step 3 of Task 4.2 asked to wire `performClaim` (a plain async function in `apps/web/src/lib/claims/actions.ts`) to the existing on-chain flows. Investigation found:

- `apps/web/src/components/exercises/exercises-screen.tsx:313-315` — `useWriteContract` (React hook) drives `claimBadgeSigned` and `submitScoreSigned`.
- `apps/web/src/app/arena/page.tsx:152` — `useWriteContract` (React hook) drives EIP-712 sign → approve → mint.

All three flows are **tightly coupled to React hooks** (`useWriteContract`, `useSignTypedData`, `useAccount`). There is no plain-function escape hatch underneath. `performClaim(claim)` is a plain `Promise`-returning function; it can't legally call hooks. Refactoring `exercises-screen.tsx` and `arena/page.tsx` to extract walletClient-parameterised helpers is explicitly out of scope per the plan.

### Decision

Shipped UI component + tests + CSS only (commit `2040b61`). Left `actions.ts` untouched (still throws sentinel errors). ProfileSheet (Task 4.4) renders PendingClaims correctly; if a user taps "Claim" in v1, the sentinel error from `actions.ts` will surface. Tests don't exercise that path (mocked `useClaimQueue` returns `claims: []`).

### Follow-up options

1. **Option A — DI pattern** (lower risk): refactor `useClaimQueue(address)` → `useClaimQueue({ address, performClaim })`. ProfileSheet (a component, hooks-legal) constructs the wired `performClaim` from `useWriteContract` and passes it in. Estimated 1 small commit + integration tests.
2. **Option B — extract plain helpers**: refactor exercises-screen + arena to extract walletClient-parameterised helpers, then call them from actions.ts. Larger refactor, touches working code.

**Recommendation:** Option A. Track as new Task (Phase 5.5 or new Phase 4.5).

### Resolution (Task 4.5a + 4.5b, commits `917ec8c` + `da52351`)

Shipped both sub-tasks before Phase 5:

- **4.5a:** Added optional `opts.performClaim` to `useClaimQueue`. Default still imports the sentinel-throwing fallback. Added a 4th unit test confirming the injected fn takes precedence.
- **4.5b:** Built `performClaim` inside `ProfileSheet` using `useChainId` + `useWriteContract` + inline `fetch`-based `requestSignature`. Badge + Score wired 1:1 with the badge sheet's MiniPay fee-currency fallback pattern (matches `apps/web/src/lib/badges/use-badge-sheet-state.ts:194-201`). Victory-nft routes to `/arena` — the existing arena retry flow handles in-flight mints via its `chesscito:claim` sessionStorage marker; profile can't replay the mint because `verifiedMoves`/`elapsedMs`/`chainDifficulty` aren't persisted in the `victory-pending` localStorage payload.

The sentinel default in `lib/claims/actions.ts` was kept as defensive fallback (currently no caller forgets to inject; the stub trips loudly if someone does).

Score wiring note: the existing exercise score flow includes `timeMs`, but profile-side claims only persist `points` in localStorage. The implementation infers `levelId` from `scoreKey` suffix `-l(\d+)$` and submits `timeMs=0`. If the score signing endpoint enforces a stricter `timeMs > 0` invariant in the future, this needs an extra field in the `score-pending` localStorage payload.

---

## Spec collisions discovered (worth a follow-up to clean up editorial/test pairs)

Two of the plan's verbatim test-and-component pairs had internal collisions that broke verbatim-paste TDD:

1. **Task 4.1 ProfileBanner**: Test asserts `getByText("Knight")`. Component had both `<TierBadge ... title="Knight" />` AND `<span className="profile-banner-tier-title">{tierTitle}</span>` (literal "Knight"). Multi-match throws. Fix: removed redundant `.profile-banner-tier-row` block. Test is the contract.
2. **Task 4.4 ProfileSheet**: Test asserts `getByText(/wallet/i)`. `PROFILE_COPY.disconnect = "Disconnect wallet"` + utility-row "Wallet" label both match. Fix: tightened to `/^wallet$/i` in the test. Component matches plan verbatim.

These are minor and now documented; future similar specs should run a self-check that `screen.getByText(...)` queries are unique across the rendered tree.

---

## Open issues carried forward

- **O-1.** `useProfileStats` returns 0 for trophies/streak/puzzles. **Partly addressed in Task 4.4** — ProfileSheet uses `stats?.dailyStreak`, `puzzlesSolved`, `trophies`, `arenaWins`, `nftsMinted` from the server. Client-side merge for `piecesMastered` is still hardcoded to 0 inside `ProfileSheet`. When the piece-progress aggregator lands, wire it in `ProfileSheet` per the inline `// wired in integration when piece progress aggregator lands` comment.
- **O-2.** Residual `HUB_V2_*` naming legacy — park as follow-up cleanup spec.
- **O-3.** Plan command `pnpm --filter web test --run` does not work. Use `cd apps/web && pnpm exec vitest run <path>`.
- **O-4.** Hub-scaffold baseline failures (Coach PRO chip + card) — pre-existing, 9 tests, do not fix on this branch.
- **NEW.** Two spec/copy collisions documented above (ProfileBanner + ProfileSheet).
- **NEW.** Wiring `performClaim` deferred (see §Wiring).

---

## How to resume next session (Phase 5)

> Phase 4 closed. Phase 5 starts hub integration. **User confirms before starting Phase 5.**

### Phase 5 — Hub integration (5 tasks)

- 5.1 Extend `parseInitialSheet` in `app/hub/page.tsx` (add `profile`, `settings`, `trophies`).
- 5.2 Wire `<ProfileSheet>` into the hub scaffold.
- 5.3 Wire `<SettingsSheetStub>` similarly.
- 5.4 Wire `<HubOnboardingCard>` (first-launch).
- 5.5 Wire `<SecondaryCta>` below the Hero region.

(Detailed sub-tasks in the plan, lines 2722+.)

### Remaining tasks (10 of 30)

- Phase 5: 5.1–5.5 (5 hub integration)
- Phase 6: 6.1 (trophies port)
- Phase 7: 7.1, 7.2 (anchor — 2 atomic commits)
- Phase 8: 8.1, 8.2 (E2E + manual QA)

Plus the deferred follow-up: wire `performClaim` via Option A (DI pattern) — recommend tracking as a new sub-task either at the end of Phase 5 or in Phase 7.

### Estimate

- Phase 5: most likely 1 session.
- Phase 6 + 7: half session.
- Phase 8: half session (E2E + manual QA on real device).
- Total to merge: ~2 more focused sessions.

---

## Tooling notes (unchanged)

- Test command: `cd apps/web && pnpm exec vitest run <path>` (NOT pnpm --filter)
- Typecheck: `cd apps/web && pnpm exec tsc --noEmit`
- Commit signature: `Wolfcito 🐾 @akawolfcito`
- Always specific paths in `git add` (security: never `-A` or `.`)
- Conventional commits enforced

---

## Files in this worktree (do not look in main)

All implementation lives in `chesscito-spec-1-hub-redesign` worktree. Main branch only contains docs commits (spec/plan/red-team/handoffs).

---

## Session 2 verification snapshot

13 SPEC 1 test files run together:

```
Test Files  13 passed (13)
Tests       37 passed (37)
Duration    2.53s
```

Zero regressions on SPEC 1 surfaces. 9 pre-existing baseline failures (hub-scaffold Coach PRO) unchanged. Working tree clean. Branch `feat/spec-1-hub-redesign` ready for Phase 5 review.
