# UI Zone Map — Phase 1 Handoff (2026-05-01)

> Author: Sally (BMad UX persona) + Wolfcito.
> Status: **Phase 1 closed.** Phase 0 (audit) + Phase 1 (quick wins) shipped on `main`. Branch is 20 commits ahead of `origin/main`, **no push yet** — pending Wolfcito's call.

---

## 1. Session arc

This session began as a UI consistency audit and became a structural cleanup of the play-hub interface. Critical course-correction at the start of Phase 1: the original visual audit had recommended deleting three "floating buttons" (trophy / whistle / blue-star) on the assumption they were ornamental or duplicates. Manual user validation revealed at least one of them opened a different surface than expected (the K+R vs K mate challenge, not dock Trophies). We paused commits, ran a functional audit by reading source (not screenshots), and discovered all three were first-class engagement features. The corrected Phase 1 plan dropped 3 cold-cut deletions and shipped 4 minimal-risk fixes + 3 docs commits + 1 regression test.

---

## 2. Commits included (8, in chronological order)

| SHA | Subject | Scope |
|---|---|---|
| `e46aaa2` | `docs(reviews): add functional audit + correct zone-map decision record` | Phase 0 — systems audit, functional audit, decision record, Playwright regression spec. |
| `8ae928a` | `feat(ui): label ContextualActionSlot pin in compact mode` | Phase 1 #2 — adds compact label below pin so submitScore / claimBadge / useShield / retry are no longer icon-only. |
| `41b2467` | `test(ui): cover compact ContextualActionSlot label` | Phase 1 #2.5 — RTL regression for the label-below-pin behavior. |
| `5e1e0a1` | `fix(ui): aria-label for dock arena trigger` | Phase 1 #3 — `aria-label="Free Play"` → `DOCK_LABELS.arena` ("Arena"). |
| `bd06214` | `test(arena): lock easy as default difficulty` | Phase 1 #4 — RTL regression locking the soft-gate default to Easy (already implemented; now defended). |
| `914c1d6` | `docs(reviews): mark phase 1 #5 as resolved by 1de7df6` | Phase 1 #5 — skip; mission-briefing-vs-PRO-sheet guard already shipped pre-Phase-1. |
| `6c58216` | `docs(ui): document z-index ladder at top of globals.css` | Phase 1 #6 — canonical ladder + anti-patterns at the top of globals.css. |
| `19b42e8` | `docs(design-system): add UI system rules and audit links` | Phase 1 #7 — appends §10 to DESIGN_SYSTEM.md with the zone map, 12 invariants, cross-links, and the "visual vs functional audits" lesson. |

---

## 3. Tests run / status

### Unit (vitest)

- Baseline at session start: 506/506 in 56 files.
- After Phase 1 close: **510/510 in 58 files.** (+4 new tests across +2 new files: contextual-action-slot.test.tsx, arena-entry-sheet.test.tsx.)

### E2E (Playwright)

- New spec: `apps/web/e2e/floating-actions-vs-dock.spec.ts` — **4/4 passing on project=minipay** (390×844). Covers: trophy floating opens K+R vs K (not dock Trophies), Daily Tactic opens its own sheet, dock Trophies opens distinct sheet, gating works (button hidden without 12+ stars on rook).
- Visual snapshots: `pnpm test:e2e:visual --project=minipay` runs **9/9 green**, hashes unchanged (no layout regression on play-hub, arena, sheets, etc.).
- Pre-existing E2E failures (NOT caused by this work, NOT in scope here):
  - `e2e/home-loads.spec.ts` and `e2e/dock-anchor.spec.ts` target route `/`, which is now the public landing page (PlayHubRoot moved to `/hub`). Both fail identically with and without Phase 1 changes. **Logged for a separate cleanup commit.**

### Type-check

- `tsc --noEmit` baseline: 827 errors (all pre-existing path-alias errors from `@/...` that require `next build` to resolve). **Unchanged** after every Phase 1 commit (827 → 827). No new type errors introduced.

---

## 4. What got resolved

- **The 3 floating buttons are documented and protected**: trophy floating = `MiniArenaBridgeSlot` (K+R vs K), whistle = `DailyTacticSlot` (daily puzzle + streak), blue-star = `submitScore` action of `ContextualActionSlot`. Each one classified, each one with a regression test where deletable behavior matters.
- **Compact ContextualActionSlot pin now has a visible label** (Submit / Shield / Claim / Retry / Connect / Network) — no more icon-only guessing game.
- **Dock arena aria-label fixed** to `"Arena"` (matches visible label, sourced from `DOCK_LABELS.arena`).
- **Easy-default-on-soft-gate** verified and locked with a regression test in `apps/web/src/components/play-hub/__tests__/arena-entry-sheet.test.tsx`.
- **Z-index ladder documented** at the top of `globals.css` with anti-patterns explicit.
- **DESIGN_SYSTEM.md §10** added — zone map + 12 invariants + cross-links + the "visual vs functional audits" lesson. This is the canonical reference for any future UI decision in Chesscito.
- **The misclassification cannot recur silently**: Playwright spec at `apps/web/e2e/floating-actions-vs-dock.spec.ts` fails CI if a future PR breaks the trophy-floating ≠ dock-trophies contract.

---

## 5. What is deferred to Phase 2

These are structural changes that need their own spec + red-team review + TDD plan:

1. **Three zone primitive components** (`<GlobalStatusBar />`, `<ContextualHeader />`, `<ContextualActionRail />`). Replace ad-hoc top treatments and float-around-board layouts everywhere.
2. **Z2 challenges row unification**: Daily Tactic + Mini Arena bridge as a single row, with new candy sprites:
   - `puzzle-day-ch.png` (Daily Tactic — replace misleading `coach` icon).
   - `mastery-ch.png` (Mini Arena bridge — replace generic `trophy` icon).
3. **PRO architecture split**: kill the single chip; replace with (a) passive gold ring on Z1 level chip when active, (b) Z4 promo card with 7-day gate when inactive, (c) PRO sub-section inside Shop as a Type-B destination sheet.
4. **PRO conversion measurement freeze** (7 days) — tied to commit (3) above, not to Phase 1.
5. **Migrate `/play-hub`, `/arena`, `/missions`, `/badges` sheet, secondary pages** to use the three zone primitives once they ship.
6. **Surface taxonomy enforcement layer**: `/dev/surfaces` debug route or Storybook-equivalent + CI lint requiring `// surface-type: B` comments on every new `<Sheet>`.
7. **Pre-existing E2E cleanup**: `home-loads.spec.ts` and `dock-anchor.spec.ts` target stale `/` route — update to `/hub`.

---

## 6. Push or PR?

**Recommended: push directly to `main`** with a single follow-up announcement.

Reasons:
- All 8 commits are docs / tests / aria-label / labeled CTA. Zero changes to handlers, contracts, routes, state machines, or game flow.
- No risk to production behavior — verifiable from the commits' diffs.
- 510/510 unit + 4/4 new e2e + 9/9 visual snapshots + tsc unchanged.
- The decision record + handoff capture the reasoning so a reviewer arriving cold can read the path in 10 minutes.

**Alternative: open a PR** if you want a public review surface (screenshot comparison in PR diff, CI run on origin).
- The branch tip is `19b42e8`. A PR titled "UI Zone Map — Phase 1 (audit + 7 quick wins)" with the body pointing to this handoff would be a clean review surface.
- Use this if you want stakeholder visibility (e.g., MiniPay business-model collaborators) before it lands.

**Do NOT**: force-push, rebase, or squash — every commit was sized as a logical unit and is reversible independently. Preserve the granularity.

---

## 7. Open questions for next session

- Phase 2 starts when? Recommend writing the spec for `<ContextualHeader />` first (smallest primitive, used by every screen).
- Sprite production for `puzzle-day-ch.png` and `mastery-ch.png`: queue with the candy art pipeline now or defer until the Z2 refactor lands?
- Phase 2 PRO architecture: stakeholder check-in needed, or proceed with the three-channel split as currently scoped?

---

## 8. Bottom line

Chesscito has a UI operating system now. Six zones, twelve invariants, two audit docs, one regression spec, one decision record, and a lesson — "visual audits read screens; functional audits read source" — codified into DESIGN_SYSTEM.md §10. Future feature placement is no longer a redesign question; it's a placement question.

Phase 1 done. Ship when ready.

— Sally
