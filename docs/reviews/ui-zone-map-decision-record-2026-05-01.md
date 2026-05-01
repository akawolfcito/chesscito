# UI Zone Map — Decision Record (2026-05-01)

> Phase 0 output. Captures the canonical UI system decisions before any code change.
> Source brief: `docs/reviews/ui-systems-audit-2026-05-01.md` (Sally / BMad UX).
> Status: **Approved by Wolfcito 2026-05-01**, **REVISED 2026-05-01** after functional audit corrected 3 misclassified elements.
> Owner: Wolfcito. UX advisor: Sally (BMad).
>
> **REVISION NOTICE (2026-05-01)**: A functional audit (`docs/reviews/ui-floating-actions-functional-audit-2026-05-01.md`) found that 3 elements originally tagged for deletion are NOT what the visual audit assumed:
> - **Trophy floating button** = `MiniArenaBridgeSlot` (K+R vs K mastery challenge), gated unlock at 12+ stars on rook. **NOT a duplicate of dock Trophies.** Do not delete.
> - **Whistle button** = `DailyTacticSlot` (daily chess puzzle + streak mechanic). **NOT a hint button.** Do not relabel.
> - **Blue-star button** = `submitScore` action of `ContextualActionSlot` — **CRITICAL on-chain CTA** (submit score to leaderboard). **NOT ambiguous, NOT decorative.** Do not delete.
>
> Sections 2, 3, 4, and 7 below have been updated to reflect the corrected understanding. The original-but-cancelled lines are kept with `~~strikethrough~~` for traceability. Playwright regression added at `apps/web/e2e/floating-actions-vs-dock.spec.ts`.

---

## 1. Zone map (approved as canonical)

The 6-zone layout is the canonical contract for every Chesscito mobile screen (390px). Every UI element must belong to exactly one zone — or to a defined overlay type (A/B/C/D from `DESIGN_SYSTEM.md` §8).

| Zone | Name | Height | Always visible? | Purpose |
|---|---|---|---|---|
| **Z1** | Global Status Bar | 32–40px | Yes | Player identity (handle, level, streak, PRO state as passive ring). Read-only. |
| **Z2** | Contextual Header | 52–64px | Per-screen | Screen title + ONE contextual control. Mode tabs live here when present. |
| **Z3** | Content / Board | flex-1 | Per-screen | The gameplay surface. Dominant. Nothing competes here. |
| **Z4** | Contextual Action Rail | 56px | Per-screen | ONE primary CTA + optional ONE secondary. Collapses to 0 when empty. |
| **Z5** | Dock | 72px (z-60) | INVARIANT | 5 destinations, fixed forever. Defended by `DESIGN_SYSTEM.md` §8. |
| Overlays | Type A/B/C/D | varies | Orthogonal | A=full page, B=destination sheet, C=quick picker, D=system modal. |

**Invariants** that follow directly from this map:

1. The dock (Z5) never grows or shrinks. 5 items, z-60.
2. Z3 owns the eye. No floating buttons, no chips, no monetization in Z3.
3. Z4 has a hard cap of 2 buttons. Three is not "rich UI" — it's paralysis.
4. Z1 is identity, never action.
5. Monetization never lives in Z1 or Z3.

> Reference: full audit in `docs/reviews/ui-systems-audit-2026-05-01.md` §3 and §4.

---

## 2. Current elements → new destinations

| Current element | Today's location | New destination | Treatment notes |
|---|---|---|---|
| **Trophy floating button** = `MiniArenaBridgeSlot` (K+R vs K) | Bottom-right of board, gated by 12+ stars on rook | **Z2 challenges row** alongside Daily Tactic | ~~Deleted~~ **REVISED**: this is a Mastery / Special Challenge — pedagogical bridge between Play Hub and Arena. **Keep, reclassify.** Rebrand label so it reads as a challenge unlock, not a trophy ("Mastery: K+R vs K"). Icon `trophy` may need a dedicated `mastery-ch.png` sprite to disambiguate from dock Trophies. |
| **Whistle button** = `DailyTacticSlot` | Bottom-left of board (always rendered) | **Z2 challenges row** alongside Mini Arena bridge | ~~Z4 secondary "Hint"~~ **REVISED**: this is a daily chess puzzle with streak mechanic — a recurring engagement loop. **Keep.** The icon (currently `coach`) reads as "whistle" to users; queue a `puzzle-day-ch.png` sprite. Two together (Daily Tactic + Mini Arena bridge) form a unified "today's challenges" sub-row in Z2. |
| **Blue-star button** = `submitScore` state of `ContextualActionSlot` | Bottom-center of board, state-driven | **Z4 contextual action rail — primary slot (already correct)** | ~~Deleted (temporarily)~~ **REVISED**: this is the on-chain submit-score CTA — critical conversion to leaderboard. **Keep.** The element is in the right zone already (Z4); the only fix needed is to **add a label** in compact mode so `submitScore` / `claimBadge` / `useShield` / `retry` are not guessing games. Promote to full-width treatment when present and primary, OR add text below the pin. |
| GET PRO chip | Top header band (`absolute z-30 top-right` inside `<main>`) | **Split by state**: (a) when active → Z1 status indicator (gold ring on level chip); (b) when inactive → Z4 promo card on play-hub (first-7-days gate); (c) full conversion flow → Shop sub-section (Type-B). | Same end direction as before, but **two-track migration**, not a cold-cut removal. PRO-active users keep their status visible in identity zone; PRO-inactive users see promo only at gated moments. |
| Piece selector | Top band, separate chip | **Z2 primary control** | Chip with `▾` chevron. Opens piece-picker as Type-C quick-picker. |
| Objective ("Move to h1") | Top band, separate pill | **Z2 subtitle** | Folded into the same Zone-2 row, below or right of the piece chip. NOT a separate equivalent button. Single visual treatment. |
| Mode tabs | Variable (top header / contextual / inline) | **Z2 only** | Single row, segmented-control treatment, max 4 tabs. If a screen needs >4 tabs, it needs sub-screens — split it. |
| Dock (Badges, Shop, **Arena center**, Trophies, Leaderboard) | z-60 bottom | **Z5 defended as-is** | Corrected from earlier note: dock is Badges / Shop / Arena (center, "Free Play" aria-label is stale — should be "Arena") / Trophies / Leaderboard. **Trophies dock destination ≠ Trophy floating button** (different surfaces). No 6th slot. |

---

## 3. What gets eliminated

**REVISED 2026-05-01** — earlier deletion list was retracted after functional audit. Nothing in Phase 1 is deleted now.

~~- **Trophy floating button** — permanent removal. Trophies are already addressable via dock + `/trophies` route.~~ **Reclassified**: it's the K+R vs K mastery challenge. Stays.

~~- **Blue-star button** — temporary removal pending purpose definition.~~ **Reclassified**: it's the on-chain submit-score CTA. Critical. Stays in Z4 with a label fix.

- **GET PRO chip in header (inactive state only)** — removed from permanent header placement. Replaced by Z4 promo card with first-7-days gate. PRO **active state** is preserved as a Z1 status indicator (gold ring on level chip).

Rule of return: **anything deleted only comes back through the zone-map contract.** Anything reclassified must have its functional surface (sheet, route, state) preserved while only its position/label changes.

---

## 4. What gets moved (Phase 1, no spec required)

**REVISED 2026-05-01.** Reclassification of Daily Tactic + Mini Arena bridge into a unified Z2 challenges row is **structural** (depends on `<ContextualHeader />` primitive) — promoted to Phase 2. Phase 1 keeps only operations that ship as ≤2-file atomic commits without new components:

- ~~**Whistle → Z4 secondary "Hint" button.**~~ **Cancelled.** "Whistle" is `DailyTacticSlot`. No move; reclassification deferred to Phase 2.
- **`ContextualActionSlot` compact pin → add label** so `submitScore` / `claimBadge` / `useShield` / `retry` are unambiguous. Either text below the pin or auto-promote to full-width when action is present + primary.
- **Dock Arena trigger → fix stale `aria-label="Free Play"`** to `"Arena"` (matches `DOCK_LABELS.arena`).
- **Piece selector + objective → unified Z2 row.** Same DOM block, single border treatment, chip + subtitle pattern. (Cosmetic restyle within existing markup; no new component yet.)
- **Mode tabs → enforce Z2 placement.** Audit each screen; fix if outside Z2.
- **Mission-briefing modal → verify guard already covers `proSheetOpen`** (`play-hub-root.tsx:1318` shows `showBriefing && activeDockTab === null && !proSheetOpen` — looks correct, just verify).
- **Arena difficulty → pre-select Easy** (`visual-qa-2026-04-30` quick-win).

---

## 5. What stays for structural refactor (Phase 2+)

These changes require a written spec, red-team review, and a TDD implementation plan before code:

1. **`<GlobalStatusBar />` component** (Z1 primitive). Replaces ad-hoc top treatments across all screens.
2. **`<ContextualHeader title slot />` component** (Z2 primitive). Standardizes piece chip + objective + back button + mode tabs.
3. **`<ContextualActionRail primary secondary />` component** (Z4 primitive). Replaces every floating button. Hard-coded max 2 children.
4. **PRO architecture rework**: kill the chip, add `<PROIndicator />` (passive ring), wire Shop → PRO sub-section as Type-B destination sheet. Retire any temporary Phase-1 placeholder.
5. **Surface-taxonomy enforcement layer**: a `/dev/surfaces` debug route or Storybook-equivalent that catalogs every existing sheet/modal classified A/B/C/D. CI lint rule: every new `<Sheet>` requires a `// surface-type: B` comment.
6. **Z-index ladder documented at top of `globals.css`** (already partially in §8 of DESIGN_SYSTEM.md; promote to top-of-file canonical comment block).
7. **Migration of all screens** to use the three primitives: `/play-hub` (canary), then `/arena`, `/missions`, `/badges` sheet, secondary pages.

These are **structural** because they change component contracts, not just element placement. Each one needs its own plan and PR.

---

## 6. Risks (REVISED 2026-05-01)

After removing cold-cut deletions from Phase 1, most original risks shrunk. The dominant remaining risks are around (a) the deferred Phase-2 reclassifications and (b) the misclassification not happening again.

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **Future PR re-introduces the misclassification** ("just clean up these floating buttons") | Medium | High | Playwright spec `apps/web/e2e/floating-actions-vs-dock.spec.ts` locks the contract: trophy floating opens `mini-arena-sheet`, not trophies sheet. Any deletion that breaks the contract fails CI. |
| ~~**PRO conversion drops** after removing the chip~~ | — | — | **No longer applicable in Phase 1** — chip is not removed cold; only the inactive-state placement changes, deferred to Phase 2. The 7-day measurement freeze tied to the chip removal is also deferred to Phase 2. |
| **Mission-briefing guard regression** breaks first-visit onboarding | Low | Medium | The guard is already in place (`play-hub-root.tsx:1318`). Phase 1 commit #5 only verifies it. Add E2E spec if missing. |
| **Daily Tactic + Mini Arena unification (Phase 2)** loses the streak/unlock mental model when re-grouped in Z2 | Medium | Medium | Phase 2 spec must explicitly preserve: streak badge on Daily Tactic, gated visibility on Mini Arena bridge, and per-element copy. Visual QA before merging the Z2 challenges row. |
| **Z2 unification (piece chip + objective)** confuses returning players | Low | Low | Cosmetic restyle, same DOM block. Single visual QA pass post-merge. |
| **Phase 1 ships labels for ContextualActionSlot but creates copy debt** | Medium | Medium | Use existing `FOOTER_CTA_COPY.label` per action — already in editorial.ts. No new strings to author. |
| **Dock becomes a target for "just one more item"** later | Low | High (system integrity) | Hard-code the rule in code review checklist. Any PR adding a 6th dock slot is auto-blocked unless an existing slot is being formally retired. |
| **Phase 2 reclassification needs new candy sprites** (`puzzle-day-ch.png`, `mastery-ch.png`) blocking Phase 2 ship | Medium | Low | Queue sprite requests now (in functional audit doc). Phase 2 components can ship with placeholder icons (`coach`, `trophy`) and swap on sprite arrival. |

---

## 7. Recommended commit order — Phase 1 quick wins (REVISED 2026-05-01)

**Original commits #1, #2, #3 are CANCELLED** — they were based on misclassified elements. The corrected list below is shorter and lower-risk. Each line is one atomic commit. Run full test suite before each. Conventional Commits + `Wolfcito 🐾 @akawolfcito` footer.

1. **`docs(reviews): add functional audit + correct zone-map decision record`**
   - Adds `docs/reviews/ui-floating-actions-functional-audit-2026-05-01.md`.
   - Applies the corrections in this section (already done as part of the decision-record revision).
   - Adds Playwright spec `apps/web/e2e/floating-actions-vs-dock.spec.ts` so the misclassification can't recur silently.
   - Risk: docs only + 1 test file; no production code.

2. **`feat(ui): label ContextualActionSlot pin in compact mode`**
   - In `compact` mode, add a small text label (or auto-promote to full-width when present + primary) so `submitScore` / `claimBadge` / `useShield` / `retry` are no longer guessing-game icons.
   - Editorial copy through `FOOTER_CTA_COPY` (already exists).
   - Risk: low — single component, no new wiring.

3. **`fix(ui): aria-label for dock arena trigger`**
   - In `play-hub-root.tsx:1223`, change `aria-label="Free Play"` → `"Arena"` to match `DOCK_LABELS.arena`.
   - Risk: trivial.

4. **`feat(arena): pre-select Easy difficulty on soft-gate`** (was original #7)
   - Default `selectedDifficulty = 'easy'` on first mount of `ArenaEntrySheet`.
   - Reduces decision blocks (visual-qa-2026-04-30 Issue 3 partial fix).

5. **`fix(ui): verify mission-briefing guard covers proSheetOpen`** (was original #6)
   - Verify the existing guard at `play-hub-root.tsx:1318` (`showBriefing && activeDockTab === null && !proSheetOpen`) is complete. Add E2E spec if not already covered.
   - Likely no-op or one-line tweak; included for completeness.

6. **`docs(ui): document z-index ladder at top of globals.css`** (was original #9)
   - Comment block listing the canonical ladder: 0, 1, 10, 11, 12, 30, 40, 50, 60, 70.
   - Reference DESIGN_SYSTEM.md §8 for the dock invariant.

7. **`docs(design-system): add 12 system rules + link to both audit docs`** (was original #10, extended)
   - Append §10 to `DESIGN_SYSTEM.md` with the 12 invariants from `ui-systems-audit-2026-05-01.md` §7.
   - Cross-link the systems audit + the functional audit + this decision record.

After commit 7 ships, Phase 1 is closed. **Move to Phase 2** for:

- The three zone primitives (`<GlobalStatusBar />`, `<ContextualHeader />`, `<ContextualActionRail />`).
- Unification of Daily Tactic + Mini Arena bridge as a Z2 "challenges row" (with new candy sprites: `puzzle-day-ch.png`, `mastery-ch.png`).
- PRO chip split: active state → Z1 passive ring; inactive state → Z4 promo card with 7-day gate.

The PRO measurement freeze (originally tied to the chip removal in commit #5) **is deferred to Phase 2** because we no longer cold-cut the chip in Phase 1.

---

## Status & next step (REVISED 2026-05-01)

**Phase 0 is complete with this document + the functional audit + the Playwright regression spec.**

Next session: open Phase 1 with commit #1 (the docs commit) and proceed in order. The corrected list has 7 commits instead of 10; commits #2–#7 are all minimal-risk and don't touch the misclassified elements.

**Hard rule, reinforced**: if any Phase 1 commit drifts beyond ~50 lines or touches more than 2 files, stop and promote to Phase 2. Quick wins must stay quick.

**Lesson captured for the future**: visual audits read screens; functional audits read source. **Do both before deleting anything.** The Playwright regression at `apps/web/e2e/floating-actions-vs-dock.spec.ts` is the codified version of this lesson — running `pnpm test:e2e` will flag any future PR that breaks the trophy-floating ≠ dock-trophies contract.

— Sally
