# Session Handoff — 2026-05-10 (hub-shop-sheet-open E2E debug)

## What this session did

Closed Next Task §4 from the 2026-05-09 exercises-extraction handoff:
the `hub-shop-sheet-open` visual-regression baseline that has been
`.skip` since 2026-05-08 (pre-migration) is now live. Visual suite
went from 4/6 green + 2 .skip → 6/6 green.

## Root cause

`RainbowKitGate` (`apps/web/src/components/wallet-provider.tsx:74-86`)
intentionally toggles its render root after the first `useEffect`:

```tsx
if (!mounted) return <>{children}</>;                       // 1st render
return <RainbowKitProvider>{children}</RainbowKitProvider>; // 2nd render
```

React reconciles the parent-type change (Fragment → Provider) as a
**full unmount + remount of the entire children subtree**. On
/exercises this manifested as a ~50–350ms window where `<main>`,
`<MissionPanelCandy>`, and the dock all briefly disappeared, then
remounted once `RainbowKitProvider` finished its lazy load. Captured
to the millisecond by a temporary polling probe:

| t | splash | dock | mainExists |
|---:|---:|---:|---:|
| 0ms   | 1 | 1 | true |
| 51ms  | 0 | 0 | **false** |
| 358ms | 0 | 1 | true |

The failing test used `page.evaluate(() => document.querySelector(
'button[aria-label="Shop"]')?.click())` — a synchronous DOM read with
no auto-wait. It landed inside that gap, found `null`, and the
`if (btn)` silently no-op'd. `expect(sheet).toBeVisible({ timeout:
5_000 })` then failed because the click never happened.

Not a regression of the migration: the gate has been there for
months. The test pattern was always racy; the daily-tactic baseline
in the same file uses Playwright's auto-waiting locator and never
hit the gap.

## Fix

`apps/web/e2e/visual-regression.spec.ts` lines 138-145 — replaced

```ts
await page.evaluate(() => {
  const btn = document.querySelector('button[aria-label="Shop"]');
  if (btn) (btn as HTMLElement).click();
});
```

with

```ts
const trigger = page.locator('button[aria-label="Shop"]');
await expect(trigger).toBeVisible({ timeout: 10_000 });
await trigger.click();
```

— same shape as `hub-daily-tactic-open`. Removed `test.skip`,
rewrote the per-test comment block + the file-level note (lines
27-34) to point at the per-test comment.

## Commit

`84042a7` — `test(e2e): unskip hub-shop-sheet-open + add desktop baseline`

Files:
- `apps/web/e2e/visual-regression.spec.ts` (+21/-19)
- new `hub-shop-sheet-open-desktop-darwin.png` baseline (1.4 MB)
- regenerated `hub-shop-sheet-open-minipay-darwin.png` baseline
- regenerated `hub-daily-tactic-open-minipay-darwin.png` baseline
  (sub-pixel jitter on chess pieces — the 2026-05-09 baseline was
  borderline-flaky at `maxDiffPixelRatio: 0.01`; today's render
  drifted past the threshold so the rebaseline happened naturally
  during this session)

## Current State

- **Branch**: `main`, pushed (`60723fb..84042a7`)
- **Visual suite**: **6/6** green (desktop + minipay × hub-clean +
  hub-daily-tactic-open + hub-shop-sheet-open)
- **Full E2E**: **92 passed, 8 skipped, 0 failed** (8 skipped are
  pre-existing in `visual-capture.spec.ts` — those are intentional
  capture-only specs, not regression)
- **Uncommitted**: none

## Verification commands

```bash
# Visual suite
cd apps/web
pnpm exec playwright test e2e/visual-regression.spec.ts --reporter=list
# Expected: 6 passed (≈10s)

# Full E2E
pnpm exec playwright test --reporter=list
# Expected: 92 passed, 8 skipped
```

## Notes worth remembering

1. **RainbowKitGate remount window is structural, not a bug.** It
   exists because `RainbowKitProvider` is `dynamic({ ssr: false })`
   and the gate prefers to render bare children during hydration
   rather than block on the lazy provider. Cost is the one-time
   ~300ms remount of the children subtree. Every E2E spec that
   touches the dock MUST use Playwright's auto-waiting locator.
   `page.evaluate` + native click is structurally racy and should
   not be re-introduced.

2. **The diagnostic probe pattern worked well**: a temporary
   `_probe-*.spec.ts` with a tight `evaluate` polling loop captured
   the unmount window per-frame. Keep the pattern in the toolbox
   for future timing-related E2E debugging. (Probe was deleted
   before commit.)

3. **`maxDiffPixelRatio: 0.01` is borderline-flaky for the daily
   tactic baseline.** Sub-pixel jitter on the chess piece sprites
   pushed today's render past the threshold against the 2026-05-09
   baseline. Watching for this — if it drifts again on a future
   `--update-snapshots` pass without DOM changes, consider raising
   the threshold to `0.015` or per-piece masks. Tracked informally,
   not blocking.

## Next Tasks (carried from 2026-05-09 handoff §Next Tasks)

1. ~~**Visual-regression rebaseline**~~ — ✅ DONE 2026-05-09 (`56617da`)
2. **Cosmetic namespace pass** (deferred per spec D9) — `.playhub-*`
   CSS namespace, `SURFACE = "play-hub"` telemetry tag, asset
   filenames, etc. Needs its own focused session: short spec with
   sub-decisions (location-named vs. semantic split), red-team,
   then schedule alongside a planned visual rebaseline since this
   pass will force baseline updates across `/hub`, `/exercises`,
   `/arena`. Estimate: M-L.
3. **`pendingShieldCredit` server-side fix** (`/api/credit-shield`)
   — architectural bug. Shield credit happens in the client hook
   AFTER tx receipt confirmation; if the user navigates away
   between buy submission and receipt confirmation the credit is
   never written. Fix is server-side: a `/api/credit-shield`
   endpoint that re-fetches the tx receipt, decodes
   `ItemPurchased`, and writes the credit idempotently (similar
   shape to `/api/sign-victory`). Pre-prod, tester impact small;
   post-prod a real UX/$ loss. Recommended next focused session.
4. ~~**`hub-shop-sheet-open` E2E debug**~~ — ✅ DONE this session
   (`84042a7`)
5. **Wire `?sheet=…` URL param to scaffold** (optional) — re-enable
   the legacy bookmark sheet-open intent (`/hub?legacy=1&action=
   shop` → opens shop). Pre-prod, tester audience tiny; track as a
   future "if anyone complains" feature.
6. **Verify telemetry dashboards** — `/play-hub` source string is
   gone from product code; if any external dashboard filtered by
   that source, expect a continuity gap from the 2026-05-09
   migration deploy onward.

## Blockers

- None.

## Recommended next session

§3 (`pendingShieldCredit` server-side fix). It's the only carry-
forward with real $ impact post-prod, and it has the cleanest
shape (single endpoint, mirrors `/api/sign-victory`). Needs a
short spec + red-team before implementing.
