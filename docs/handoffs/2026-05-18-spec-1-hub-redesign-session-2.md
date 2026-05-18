# SPEC 1 Hub Redesign — Session 2 Handoff

**Date:** 2026-05-18 (same day, second sitting)
**Branch:** `feat/spec-1-hub-redesign`
**Worktree:** `/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito-spec-1-hub-redesign`
**Plan:** `docs/superpowers/plans/2026-05-18-hub-redesign-destinations-and-profile.md`
**Spec:** `docs/superpowers/specs/2026-05-18-hub-redesign-destinations-and-profile-design.md`
**Previous handoff:** `docs/handoffs/2026-05-18-spec-1-hub-redesign-session-1.md`

---

## Progress: 16 of 30 tasks complete (Phase 0 ✅, Phase 1 ✅, Phase 2 ✅, Phase 3 ✅)

### Session 2 commits (this sitting)

| # | SHA | Task | Notes |
|---|---|---|---|
| 9 | `7a2a6c5` | 2.3 useClaimQueue | Unblocked. 3/3 tests. **Fixed infinite-effect loop** in `!address` branch — see §Bug. |
| 10 | `3016ae2` | 2.4 useDisplayName | 5/5 tests. Verbatim from plan. |
| 11 | `b24bfb9` | 2.5 useHubOnboarding | 3/3 tests. Verbatim. |
| 12 | `8f60b42` | 3.1 TierBadge | 2/2 tests. CSS appended inside existing `@layer components`. |
| 13 | `7768a90` | 3.2 DisplayNameDialog | 4/4 tests. `role="dialog"`, 44px touch targets, `aria-label` from `DISPLAY_NAME_COPY.dialogTitle`. |
| 14 | `385d495` | 3.3 SecondaryCta | 2/2 tests. D5 (calm Arena link below Hero). |
| 15 | `0f901c3` | 3.4 SettingsSheetStub | 2/2 tests. Disabled toggles with `Coming soon` tooltip. |
| 16 | `a0b563f` | 3.5 HubOnboardingCard | 2/2 tests. Single-button dismiss; no tap-outside. |

**Total deltas this session:** ~23 new tests (8 files, all passing). Combined repo state: 60+ new tests added across SPEC 1 work, zero regressions in the touched surfaces.

---

## §Bug — Vitest hang in `useClaimQueue` (resolved)

### Root cause

The `useEffect(() => { ... }, [address, tick, optimisticRemoved])` in the original `use-claim-queue.ts` had this block:

```ts
if (!address) {
  setState(INITIAL);
  setOptimisticRemoved(new Set());   // <-- bug: new Set ref each call
  return;
}
```

`new Set()` creates a fresh reference. React's dep-array comparison is `Object.is`, so the effect saw `optimisticRemoved` "change" every render → re-ran → called `setOptimisticRemoved(new Set())` again → infinite effect loop. The hook never settled, vitest worker pegged at 100% CPU, `expect(...)` in the test never executed (the test body runs *after* `renderHook` returns; it never returned).

Hypothesis from session-1 handoff (vi.mock hoisting / wagmi heavy import) was wrong — the mocks worked fine; the real loop was in the hook itself.

### Fix (committed in `7a2a6c5`)

```ts
setOptimisticRemoved((prev) => (prev.size === 0 ? prev : new Set()));
```

Functional updater returns the same `prev` reference when it's already empty, so the dep array sees `Object.is`-equal value and the effect does not re-run. Set is still cleared the one time an address-set hook transitions to address-undefined.

### Diagnostic note

`diag` test (single sync assertion on `useClaimQueue(undefined)`) confirmed the loop happened on the simplest case. That isolated the bug to the hook (not the mocks).

---

## Open issues carried forward (unchanged from session 1)

- **O-1.** `useProfileStats` returns 0 for trophies/streak/puzzles. Merge in Task 4.4 ProfileSheet composite. (Server endpoint is correctly bounded; do NOT fix inside the hook.)
- **O-2.** Residual `HUB_V2_*` naming legacy — park as follow-up cleanup spec. `chesscito:hub-v2:splash:seen` requires migration shim if renamed.
- **O-3.** Plan command `pnpm --filter web test --run` does not work. Use `cd apps/web && pnpm exec vitest run <path>`.
- **O-4.** `pnpm test` baseline has ~46 pre-existing failures unrelated to this branch (Coach PRO card, "Train with Coach", etc.) — do not try to fix here.

### New observation (session 2)

- Effect-loop pattern (`setState({inFlight: new Set(), ...})` inside an effect) was used in several places in `use-claim-queue.ts`. Today's fix only addressed the `!address` branch; the other setState calls populate state fields that are NOT in the dep array, so they don't loop. If you later add `inFlight` (or any Set/object) to a dep array, audit those branches.

---

## How to resume next session (Phase 4)

> **User asked to pause before Phase 4 for review.** Do not start 4.1 until user confirms.

### Phase 4 — Profile composites (4 tasks)

- **4.1 `<ProfileBanner>`** — display name + tier + wallet + xp + edit pen. Pure-presentational, integrates TierBadge.
- **4.2 `<PendingClaims>` + wire `performClaim`** — biggest task in Phase 4. Real on-chain wiring: badges (`badge.claim`), scoreboard (`scoreboard.save`), victory NFT (route to `/victory/{txHash}`). Each branch currently throws a sentinel error in `actions.ts`. Implementer should treat this as a multi-file integration task and may need NEEDS_CONTEXT escalation.
- **4.3 `<ProfileStats>`** — small stats grid; reads from the composed merge described in O-1.
- **4.4 `<ProfileSheet>`** (composite) — integrates banner + claims + stats + display-name dialog. This is where O-1's server-vs-client merge happens.

### Remaining tasks (14 of 30)

- Phase 4: 4.1, 4.2, 4.3, 4.4
- Phase 5: 5.1–5.5 (5 hub integration)
- Phase 6: 6.1 (trophies port)
- Phase 7: 7.1, 7.2 (anchor — 2 atomic commits)
- Phase 8: 8.1, 8.2 (E2E + manual QA)

### Estimate

- **Phase 4** alone is ~1 session (4.2 is the heaviest — multi-flow wiring).
- Phases 5–8 ≈ 1–1.5 sessions.
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

8 new test files run together:

```
Test Files  8 passed (8)
Tests       23 passed (23)
Duration    2.01s
```

No regressions on the 8 surfaces touched. Working tree clean. Branch `feat/spec-1-hub-redesign` ready for Phase 4.
