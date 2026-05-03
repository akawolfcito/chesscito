# E2E Baseline — Pre-existing Failures (2026-05-02)

> Captured during the `<GlobalStatusBar />` Z1 canary commit (`refactor(play-hub): adopt GlobalStatusBar canary`). The canary itself introduces **0 new e2e failures** — the 26 listed below already failed at the prior commit `6b8fdd6` and persist after the canary lands.
>
> This document exists so the canary's commit history doesn't carry the impression that 26 broken tests are its responsibility. It is a marker for a separate baseline-cleanup sprint.

---

## 1. Numbers

| Stage | Failed | Passed | Skipped |
|---|---|---|---|
| Baseline (HEAD = `6b8fdd6`, no canary) | **26** | (not measured full) | — |
| Canary applied (`apps/web/e2e/global-status-bar.spec.ts` + play-hub edits) | **26** | 57 | 3 |
| **Delta introduced by canary** | **0** | — | — |

The 26 failures are bit-identical between the two states (same spec files, same line numbers, same error messages). Confirmed by stashing the canary's three modified files (`play-hub-root.tsx`, `mission-panel-candy.tsx`, the new `e2e/global-status-bar.spec.ts`) and re-running the same playwright project — three sample failures (`victory-page renders two nav links`, `surface-integrity board canvas`, `tutorial-banner first visit`) reproduced 1:1 at baseline.

The Z1 + Z2 targeted specs pass **16/16** in isolation:
- `e2e/global-status-bar.spec.ts` — 10/10 (new in this canary).
- `e2e/contextual-header.spec.ts` — 6/6 (existing; survived the `mr-[140px]` drop without modification).

---

## 2. Categories affected (pre-existing)

| Spec file | Failing tests | Likely category |
|---|---|---|
| `e2e/arena-flow.spec.ts` | 2 | Arena setup flow drift |
| `e2e/candy-shell-previews.spec.ts` | 3 | Candy shell preview captures |
| `e2e/capture-exercise.spec.ts` | 2 | Rook capture exercise |
| `e2e/exercise-flow.spec.ts` | 2 | Play hub exercise interaction |
| `e2e/lf-sweep-captures.spec.ts` | 4 | Look-and-feel sweep visuals |
| `e2e/redesign-validation.spec.ts` | 2 | Redesign validation captures |
| `e2e/share-previews.spec.ts` | 2 | Share modal previews |
| `e2e/surface-integrity.spec.ts` | 4 | Board canvas + dock-on-top sheets |
| `e2e/tutorial-banner.spec.ts` | 2 | Mission briefing first-visit |
| `e2e/ux-review.spec.ts` | 1 | Trophies sheet open |
| `e2e/victory-page.spec.ts` | 2 | Back-path integrity |
| **Total** | **26** | — |

---

## 3. Concrete drift examples

These are real assertions in current `main` that no longer match shipped code. Each is isolated, none caused by Z1.

### `victory-page.spec.ts` — `href="/" expected, "/hub" received`

```
e2e/victory-page.spec.ts:34
expect(await hubLink.getAttribute("href")).toEqual("/");
// Received: "/hub"
```

The play-hub canonical route migrated from `/` to `/hub` at some point; the victory page's "Back to Hub" link now links to `/hub` (correct in product), but the spec still asserts the legacy `/`. **Fix: update assertion to `/hub`** (or change product copy). 1-line spec change.

### `tutorial-banner.spec.ts` — `first visit shows the briefing modal`

The spec expects the briefing modal to mount on first visit. Current behavior likely mounts it but the spec's wait condition or selector drifted. Needs investigation, not Z1-related.

### `surface-integrity.spec.ts` — `board canvas has non-zero dimensions`

The board canvas test expects non-zero `getBoundingClientRect`. Was failing at baseline; continues to fail with canary. Either a canvas mount race or a selector that changed during the candy migration.

### Visual sweep specs (`lf-sweep-captures`, `candy-shell-previews`, `share-previews`, `redesign-validation`)

These are screenshot-comparison specs. They tend to fail when ANY visual surface drifts from baseline snapshot — even a 1-pixel shift in a candy decoration. Baseline snapshots likely need a deliberate refresh sweep; not gated on Z1.

---

## 4. Recommendation

**Open a separate "E2E baseline cleanup sprint"** with three layers of work, in priority order:

1. **Spec drift fixes** (1-2 hours each, mechanical) — `victory-page` href, `tutorial-banner` selector update, `arena-flow` element waits. Not load-bearing on product correctness; the product works, the assertions are stale.
2. **Visual snapshot sweep** (~half day) — re-baseline `lf-sweep-captures`, `candy-shell-previews`, `share-previews`, `redesign-validation` after a manual visual review. Owner reviews the snapshot diffs in PR.
3. **Surface-integrity investigation** — the board-canvas-non-zero assertion is the most concerning because if it's a real race, it's a real bug. Even if the spec is wrong, this one deserves source recon before the assertion is updated.

Estimated total cost: 1-2 days of focused work. Should NOT be merged into product feature commits.

---

## 5. Rule (process discipline)

Adopted by this commit forward:

- **A canary commit may land with baseline e2e failures still present, IF AND ONLY IF**:
  - The canary's targeted specs are green (16/16 here).
  - Full-suite e2e delta is **zero new failures** introduced by the canary.
  - This baseline state is documented (this file).
  - Unit tests, type-check, and visual halt criteria all pass.
- **A future PR that adds even one new failure to the baseline is rejected** until either the failure is fixed or the spec is removed/updated with reviewer sign-off. Hiding new failures inside a growing baseline is the regression we are guarding against.
- The cleanup sprint above is a separate work item, scoped on its own.

Hiding baseline rot is not acceptable. Letting it accumulate without a marker is also not acceptable. This file is the marker.

— Wolfcito + canary author
