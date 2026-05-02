# `<ContextualHeader />` Canary — Phase 2 Handoff (2026-05-01)

> Author: Sally (BMad UX persona) + Wolfcito.
> Status: **Phase 2 commit series #1–#3 closed.** Series ships the Z2 zone primitive, wires the canary in `/play-hub`, and lands the design-system entry. All four commits pushed to `origin/main`. No PR — direct-to-main per the same operating model used for Phase 1.

---

## 1. Series arc

This series opens **Phase 2** of the UI Zone Map work that closed Phase 1 in `df7fc97`. Phase 1 established the 6-zone canonical layout + 12 invariants + audit/decision-record docs. Phase 2 starts implementing the **three zone primitives** (`<GlobalStatusBar />` for Z1, `<ContextualHeader />` for Z2, `<ContextualActionRail />` for Z4) that those audits called out as the missing structural layer.

This series ships the **Z2 primitive** (smallest first per the Phase 1 handoff recommendation) and proves it on `/play-hub` as the canary screen. The other two primitives are deferred to future series and tracked in `DESIGN_SYSTEM.md §10.6`.

The series followed the project's standard cycle: spec → red-team → spec amendment → re-review → implementation → implementation review → canary → docs. Two adversarial passes (red-team + implementation review) caught real bugs (8 P0 + the pixel-delta + the type-safety over-claims) before any code shipped, and one more (canary visual review) caught the absolute-z-30 PRO chip overlap before the canary went live.

---

## 2. Commits included (4, in chronological order)

| SHA | Subject | Scope |
|---|---|---|
| `fda38a0` | `feat(ui): add ContextualHeader primitive` | New `apps/web/src/components/ui/contextual-header.tsx` (318 LOC) + 20 unit tests + spec RR-1 prose fix. 4 variants typed. No callers wired. |
| `853d493` | `docs(reviews): implementation review of ContextualHeader fda38a0` | Mid-PR adversarial review — 0 P0, 2 P1 (deferred to first `mode-tabs` consumer), recalibrates the implementation plan. |
| `24ac2ef` | `refactor(ui): wire ContextualHeader canary in play hub` | Replaces the inline Z2 row in `mission-panel-candy.tsx`. New `<PiecePickerTrigger>` (sibling). `<PiecePickerSheet>` `trigger` prop made optional. New E2E spec `contextual-header.spec.ts` (6 tests). |
| `034f325` | `docs(design-system): document ContextualHeader rules and polish docs` | `DESIGN_SYSTEM.md §10.5` (Z2 primitive entry) + `§10.6` (Phase 2 carry-forward). JSDoc on the component. Zero behavioral change. |

Spec + review docs that informed the series (already on `main` from Phase 1 close + earlier in this session):

- `docs/specs/ui/contextual-header-spec-2026-05-01.md` (v1, amended `b38cfa3` + RR-1 prose fix in `fda38a0`).
- `docs/reviews/contextual-header-spec-red-team-2026-05-01.md` (`1d2be9c`).
- `docs/reviews/contextual-header-spec-red-team-followup-2026-05-01.md` (`18f5750`).
- `docs/reviews/contextual-header-implementation-review-2026-05-01.md` (`853d493`).

---

## 3. Tests run / status

### Unit (vitest)

- Baseline at series start: 510/510 (Phase 1 close).
- After series close: **530/530 in 59 files.** (+20 new tests across `apps/web/src/components/ui/__tests__/contextual-header.test.tsx`.)

### E2E (Playwright, project=minipay)

- New spec: `apps/web/e2e/contextual-header.spec.ts` — **6/6 passing**. Asserts: Z2 height envelope (52–64px), piece-picker trigger opens the sheet, `MissionDetailSheet` reachable, no live timer / monetization in Z2, Z3 board renders 64 cells without overlap, Z5 dock at viewport bottom.
- Existing specs: **7/7 passing** (`home-loads.spec.ts`, `dock-anchor.spec.ts`, `floating-actions-vs-dock.spec.ts`).
- **Total E2E: 13/13** on minipay.

### Visual snapshots (Playwright, project=minipay)

- 9/9 captures generated successfully on the canary build.
- Manual review of `e2e-results/snapshots/play-hub.png`: Z2 reorganized as planned (title "Rook" + subtitle "Move to h1" + chevron trigger), Z3 board mounts behind welcome modal, Z4 action area unchanged, Z5 dock intact (5 icons at viewport bottom). PRO chip still pinned top-right.

### Type-check

- `tsc --noEmit` (apps/web): **0 errors** through the entire series. Stayed at 0 from start to finish.

---

## 4. What got implemented

- **`<ContextualHeader />` primitive** (`apps/web/src/components/ui/contextual-header.tsx`, 318 LOC). Discriminated-union props, 4 variants (`title`, `title-control`, `mode-tabs`, `back-control`), `ReactElement`-typed trailing slot, tuple-capped `modeTabs.options`, dev-mode runtime guards (length caps, fragment escape, trigger-width drift, duplicate-key warning), semantic `<header>` wrapper with `data-component="contextual-header"` for runtime auditing, no `className` escape hatch.
- **`<PiecePickerTrigger />`** (`apps/web/src/components/play-hub/piece-picker-trigger.tsx`, ~60 LOC). Compact button extracted from the legacy `pieceChip` JSX. Lives inside the canary's trailing slot; opens the picker via lifted state.
- **`<PiecePickerSheet />` API softened**: `trigger` prop made optional. When omitted, the sheet is purely controlled and the trigger lives elsewhere (per the canary pattern).
- **Canary integration** (`mission-panel-candy.tsx`). Inline three-element flex row replaced with `<ContextualHeader>` + sibling `<PiecePickerSheet>` + sibling `<MissionDetailSheet>` (transitional row) + `exerciseDrawer` slot preserved. State lifted to the parent.
- **`DESIGN_SYSTEM.md §10.5`** — Z2 primitive entry: variant catalogue, compile-time / runtime contracts, forbidden cases, mandatory caller contract, full cross-link graph.
- **`DESIGN_SYSTEM.md §10.6`** — Phase 2 carry-forward table making every deferred P1/P2 item visible with its trigger-to-ship.
- **Compile-time contracts documented** as commented-out fixtures in the test file (project has no `tsd` / `expect-type` library yet).

---

## 5. What is visible at `/hub` now

- The top of the play-hub renders the new `<ContextualHeader variant="title-control">` strip:
  - **Title**: piece label (e.g. "Rook").
  - **Subtitle**: current objective (e.g. "Move to h1", "Capture", or labyrinth name).
  - **Trailing**: small piece-picker chevron button (~44px, with piece sprite icon).
- Below the strip, a thinner **transitional sibling row** carries:
  - `MissionDetailSheet` peek button (still shows its existing chip — duplicates the objective text by design during the canary; resolves in the Phase 2 follow-on that folds it into the picker).
  - `exerciseDrawer` slot (unchanged from before).
- Z3 board, Z4 contextual action rail, and Z5 dock are pixel-functional vs the pre-canary state. E2E asserts no overlap, no displacement.
- Absolute z-30 "Get PRO" chip still pinned top-right. The canary wrapper (`mr-[140px]`) reserves horizontal space so the trailing trigger never sits under it.

---

## 6. Transitional debt accepted

Each of these is **explicitly known and tracked**, not silently shipped:

| Debt | Where | Resolution trigger |
|---|---|---|
| Objective text "Move to h1" appears twice (header subtitle + mission peek pill). | `mission-panel-candy.tsx` Z2 + sibling row. | Phase 2 follow-on folds `MissionDetailSheet` into the piece-picker as a sub-tab → mission peek pill goes away. TODO comment in the code. |
| Z2 wrapper carries `mr-[140px]` to clear the absolute z-30 PRO chip. | `mission-panel-candy.tsx`. | PRO chip migrates into `<GlobalStatusBar />` (Z1 primitive). At that point the reservation drops. Inline TODO comment. |
| Trigger width slightly exceeds the 44px soft cap (icon + chevron + padding). Dev-mode width warning fires. | `<PiecePickerTrigger>`. | Acceptable for v1; the icon is needed for discoverability. Re-evaluate if real users complain. |
| `mode-tabs` variant lacks WAI-ARIA tablist keyboard navigation (roving tabindex, arrow keys). | `contextual-header.tsx` `ModeTabsHeader`. | Bundle into the same PR as the first `mode-tabs` consumer (Trophies filter is the leading candidate). Tracked in §10.6. |
| `mode-tabs` puts `role="tablist"` on `<header>`, overriding the implicit `banner` role. Cleaner pattern is `<header><div role="tablist">`. | Same component. | Same trigger as the previous. |
| Compile-time contracts validated by commented-out fixtures, not a real `tsd` suite. | `__tests__/contextual-header.test.tsx`. | When the project adopts a type-test library. Until then, contracts hold via discriminated-union design + reviewer discipline. |

---

## 7. What is deferred to Phase 2 follow-ons

From `DESIGN_SYSTEM.md §10.6` (the canonical list — link kept here for cross-reference):

1. **Migrate other screens** to `<ContextualHeader>`: `/arena`, `/missions`, `/badges` sheet, secondary pages. One PR per screen.
2. **Fold `MissionDetailSheet` into the piece-picker** as a sub-tab. Resolves the duplicate-objective debt in §6 above.
3. **`<GlobalStatusBar />` (Z1 primitive)** — its own spec → red-team → TDD cycle. Migrates the PRO chip into Z1; unlocks the canary's `mr-[140px]` removal.
4. **`<ContextualActionRail />` (Z4 primitive)** — same cycle. Replaces the per-screen ad-hoc action layouts and enforces "max 1 primary + 1 secondary."
5. **Mode-tabs refinements** (keyboard nav + semantic wrapper) bundled with the first consumer.
6. **Focus management for variant transitions** — when a screen actually swaps variants mid-flow.
7. **CI lint anti-misuse** — ESLint rule or grep CI check that flags raw `<header>` / inline `<div className="...header...">` patterns inside `apps/web/src/app/**/page.tsx`.
8. **Z1 + Z2 combined budget** — codify "≤ 104px combined" as a hard constraint when `<GlobalStatusBar />` ships.

---

## 8. Open questions for the next session

- **Order of Z1 vs Z4 primitive**: which one comes after the canary stabilizes? Recommendation: `<GlobalStatusBar />` next, because it unlocks the PRO migration which removes the `mr-[140px]` debt (most visible reservation). `<ContextualActionRail />` can follow.
- **Trophies filter (first `mode-tabs` consumer)**: ship as a bundled "first consumer + ARIA refinements" PR, or as a standalone consumer that opens the ARIA-bug ticket separately? Recommendation: bundled, since the ARIA gaps are 1-day work and shipping a non-accessible tablist would be a step backwards.
- **Sprite production for Z2 challenges row** (`puzzle-day-ch.png`, `mastery-ch.png` — flagged in the zone-map decision record §6 risks): queue with the candy art pipeline now or wait until the Z2 challenges row PR? Either works; queuing now means assets are ready when the PR lands.

---

## 9. Bottom line

Phase 2 has its first primitive. `<ContextualHeader />` is documented, tested, type-safe by construction, and live on `/play-hub` as a canary. The two follow-on primitives (`<GlobalStatusBar />`, `<ContextualActionRail />`) and the per-screen migrations are queued in `DESIGN_SYSTEM.md §10.6` with explicit triggers, not buried in review docs.

The series cost 4 commits, 530/530 unit + 13/13 e2e + 9/9 visual, zero production-behavior regressions. Two adversarial reviews caught real defects before code shipped. The canary debt is small, named, and resolves automatically when later Phase-2 work lands.

Phase 2 commit series #1–#3 done. Ready for the next series whenever Wolfcito picks the lever.

— Sally
