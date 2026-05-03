# Visual Regression Plan — From Capture-Only to Real Regression (2026-05-02)

> **Status**: Diagnosis + plan only. No code in this document.
> **Companion to**: [`docs/reviews/product-ux-gameplay-triage-2026-05-02.md`](product-ux-gameplay-triage-2026-05-02.md).
> **Why now**: P1-1 (disclaimer placement) and P1-3 (move animation) are visual fixes. Without a real visual regression suite, we cannot prove the fixes don't drift back. This plan converts the existing capture-only suite into a regression gate.

---

## 1. Current state — capture-only

`apps/web/e2e/visual-snapshot.spec.ts` (verified by reading the file in full):

```ts
for (const pg of PAGES) {
  test(`snapshot: ${pg.name}`, async ({ page }) => {
    if (pg.path === "/hub") { await waitForPlayHub(page); }
    else { await page.goto(pg.path, ...); await page.waitForTimeout(2_000); }
    await page.screenshot({ path: `${SNAPSHOT_DIR}/${pg.name}.png`, fullPage: true });
  });
}
```

What it does: navigates to each page, waits for it to load, calls `page.screenshot({ path })` to **write** a PNG to `e2e-results/snapshots/`. **Never** calls `expect(...)` against the screenshot.

What this means in practice:

- The suite **always passes** as long as: (a) the dev server is up, (b) the page loads without throwing, (c) the screenshot is written.
- A 100% blank screen, a wrong layout, a regressed dock position, a missing button — none of these would fail the suite. Only a dev-server timeout or a navigation error fails it.
- The suite produces useful artifacts (the PNG files), but provides **zero regression signal**.

This is not a Playwright misuse — it's a deliberate design that uses Playwright as a screenshot-capture tool. The signal it produces lands in `e2e-results/snapshots/play-hub.png` etc., for **manual visual review**. Not automated.

---

## 2. What "real regression" means for this project

Playwright ships `expect(page).toHaveScreenshot(name, options)` and `expect(locator).toHaveScreenshot(name, options)`:

- First run on a fresh branch: writes a baseline PNG to `__screenshots__/<spec-name>/<test-name>-<projectName>-<platform>.png`.
- Subsequent runs: compares the live screenshot to the baseline using a configurable pixel diff threshold (`maxDiffPixels`, `maxDiffPixelRatio`, `threshold`).
- If the diff exceeds the threshold, the test fails and Playwright writes the diff image alongside the baseline.
- Updating baselines is explicit: `pnpm test:e2e --update-snapshots`. Never silent.

For Chesscito the right shape is a hybrid:

- **Real regression** for canonical surfaces that should NOT drift between commits unless deliberately re-baselined: `/hub` clean, `/arena` empty board, `/landing`, dock surfaces, contextual zones.
- **Capture only** for transient state captures used in PR reviews (badge-earned modal, share modal): we want the artifact but the modal is animation-driven and pixel-flaky.
- Keep both in the suite, but in different specs so the assertion intent is unambiguous.

---

## 3. Proposed structure

Two specs, separated by intent:

### `e2e/visual-regression.spec.ts` (new — real regression)

Strict pixel comparison. Fails CI on real visual drift.

```ts
// Conceptual shape — not committed in this plan
test("hub clean — anonymous, briefing dismissed", async ({ page }) => {
  await bypassFirstVisit(page);
  await page.goto("/hub");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("hub-clean.png", {
    maxDiffPixelRatio: 0.005, // 0.5% pixel tolerance for font + AA
  });
});
```

Canonical states (one assertion each):

1. `hub-anonymous-clean` — no wallet, no welcome modal, no PRO sheet open.
2. `hub-anonymous-pro-sheet-open` — anonymous + ProSheet mounted (CTA = Connect).
3. `hub-anonymous-daily-tactic-sheet-open` — anonymous + DailyTacticSheet mounted on a fixed test puzzle FEN.
4. `hub-anonymous-mini-arena-sheet-open` — anonymous + MiniArenaSheet (gated by stars; bypass via test fixture or render in isolation as a story).
5. `dock-default` — close-up screenshot of the persistent dock (5 items, default state).
6. `dock-active-tab` — same, with one dock tab active.
7. `arena-empty-board` — `/arena` route, board mounted, no game in progress.
8. `victory-page-1` — `/victory/1` route (mock the contract read with `NEXT_PUBLIC_VICTORY_NFT_ADDRESS=` empty so the page renders the migrated `notFound()` chrome consistently).
9. `landing-default` — `/` route.
10. `about-default` — `/about` route.

Each has:

- A bypass for first-visit overlays (the existing `chesscito:onboarded` + `chesscito:welcome-dismissed` localStorage init script — already used in the canary specs).
- A wait for `networkidle` + a final `await page.waitForTimeout(300)` to let any one-frame animation settle.
- An explicit `name` so the baseline filename is deterministic.
- A per-test `maxDiffPixelRatio` (default `0.005` = 0.5%; lower for static surfaces like the dock, higher for surfaces with subtle animation like the landing's particle background).

### `e2e/visual-capture.spec.ts` (rename of current `visual-snapshot.spec.ts`)

Capture-only. Does not assert. For PR review artifact generation.

- Move `page.screenshot({ path })` calls here.
- Add a comment block at the top: "This file produces review artifacts; it does NOT regression-test. For regression, see visual-regression.spec.ts."
- CI may run this nightly or on `--ui-review` flag, but it doesn't fail PRs.

---

## 4. Threshold strategy

Different surfaces tolerate different drift:

| Surface | `maxDiffPixelRatio` | Rationale |
|---|---|---|
| Dock-only crop | 0.001 (0.1%) | Dock invariant per `DESIGN_SYSTEM.md` §8 — anything moving here is a regression. |
| Hub clean (anonymous) | 0.005 (0.5%) | Allows font hinting + AA noise; catches structural drift. |
| Sheets (Type-B) | 0.01 (1%) | Subtle gradient + scrim noise. |
| Landing (`/`) | 0.02 (2%) | Has parallax / particle background — needs more slack. |
| Arena empty board | 0.005 (0.5%) | Static; tight. |
| Victory page (mocked) | 0.005 (0.5%) | Static; tight. |

Tune over the first 2-3 PRs after adoption. Document each threshold change in the spec body comment.

---

## 5. Updating baselines

Adopt this rule (codified in this doc + `DESIGN_SYSTEM.md` §10.x carry-forward):

- **Baselines are updated explicitly with `pnpm test:e2e --update-snapshots`** as part of the PR that intentionally changes the visual.
- The PR diff MUST include the changed baseline PNG; reviewer eyeballs the change.
- **No automatic snapshot regeneration in CI.** A CI re-baseline is silent regression-laundering.
- If a baseline is updated WITHOUT a clear "visual change" reason in the PR description, the PR is rejected.

---

## 6. Bypass strategy for first-visit overlays

The existing canary specs (`contextual-header.spec.ts`, `global-status-bar.spec.ts`) use:

```ts
async function bypassFirstVisit(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("chesscito:onboarded", "true");
    window.localStorage.setItem("chesscito:welcome-dismissed", "1");
  });
}
```

The new regression spec inherits this. **Important: a separate test in the same file must EXERCISE the first-visit overlay** (so we don't lose visual coverage of the onboarding flow):

```ts
test("hub-first-visit-briefing", async ({ page }) => {
  // Do NOT call bypassFirstVisit — let the briefing modal mount.
  await page.goto("/hub");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("hub-first-visit-briefing.png", { maxDiffPixelRatio: 0.005 });
});
```

That keeps onboarding visually locked even though the rest of the suite bypasses it.

---

## 7. CI integration

Two changes:

1. The current `pnpm test:e2e:visual` script in `apps/web/package.json` runs `playwright test e2e/visual-snapshot.spec.ts`. Update to:
   ```jsonc
   "test:e2e:visual": "playwright test e2e/visual-regression.spec.ts",
   "test:e2e:visual-capture": "playwright test e2e/visual-capture.spec.ts"
   ```
   The first becomes a real CI gate; the second is review-artifact-only.
2. CI workflow (if any — check `.github/workflows/`) must run `test:e2e:visual` and fail on regression. PRs that need a re-baseline run it locally + commit the updated PNGs.

---

## 8. Rollout plan (3 steps, no parallel work)

### Step 1 — Foundation commit (1-2 hours)

- Create `e2e/visual-regression.spec.ts` with **only** the 3 simplest assertions: `hub-anonymous-clean`, `dock-default`, `arena-empty-board`.
- Generate baselines (`--update-snapshots`).
- Commit the spec + the 3 baseline PNGs.
- Rename `visual-snapshot.spec.ts` → `visual-capture.spec.ts`. Add the disclaimer comment.
- Update `package.json` scripts.
- CI: confirm the new script runs and the 3 assertions pass on a fresh PR.

### Step 2 — Coverage expansion (half day)

- Add the remaining 7 canonical states from §3 above (sheet-open variants, hub-first-visit-briefing, victory-page, landing, about).
- Generate baselines.
- Tune thresholds based on first-PR run.

### Step 3 — Process discipline

- Document the rule from §5 in `DESIGN_SYSTEM.md` §10.x (extension of the existing visual QA rule in §9): "Baselines are updated explicitly. PRs that update baselines without a visual-intent explanation are rejected."
- Train team (one PR review walkthrough is enough — the rule is mechanical).

---

## 9. What this plan does NOT do

- **Does not commit any code.** This document is the plan; the foundation commit (Step 1) is a separate work item.
- **Does not extend coverage to mobile-only viewports right now.** All assertions run on the project's current `--project=minipay` (390×844). Cross-viewport regression is a Step 4+ concern.
- **Does not gate Phase-2 layout primitives.** Z1 + Z2 are already shipped with their own E2E coverage. The visual regression spec catches future drift but does not retroactively validate the canary commits.
- **Does not promise to catch every visual issue.** Threshold tuning is approximate. Real visual review (the candy art, the typography, the gameplay feel) will always need human eyes.

---

## 10. Cost / benefit

| Cost | Benefit |
|---|---|
| 1-2 hours for Step 1 + half day for Step 2 + writing into `DESIGN_SYSTEM.md`. | Real CI gate on visual drift. Pixel-diff PNG attached to every failing PR. Process discipline that prevents silent baseline rot. |
| Baselines must be checked in (~10-15 PNGs at ~1MB each → ~15MB in git). | A PR that "fixes the move animation" can be proven not to break the dock, the board, the sheets. |
| Threshold tuning over first ~3 PRs. | Subsequent visual fixes (P1-1 disclaimer, P1-3 move animation) ship with verified non-regression on the rest of the surface. |

The cost is small compared to the alternative — shipping P1-1 and P1-3 fixes blind, then waiting for users to complain that "the dock looks weird now."

---

## 11. Recommended order vs the triage

Per the companion triage doc §6:

> Sprint commit #1 — convert visual-snapshot.spec.ts to real regression (per companion doc). Foundation for shipping P1 fixes safely.

Step 1 of this plan is sprint commit #1. Steps 2 and 3 can land alongside the P1 fixes (commit #5 area).

— Wolfcito + canary author
