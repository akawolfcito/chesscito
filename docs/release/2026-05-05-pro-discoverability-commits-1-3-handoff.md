# Session Handoff — PRO Discoverability commits #1-#3 (2026-05-05)

> **Author:** Wolfcito + agent (Sally on UX, Claude Code on implementation).
> **Status:** **Closed.** 3 of 12 commits in the PRO Discoverability addendum sequence landed local. Push pending. Working tree clean (modulo `_bmad-output/`, gitignored).
> **Branch:** `main`. Local ahead of origin: 4 commits (`5f1a162`, `adb8dc4`, `4a42e61`, `889c97b`).

---

## 1. Session arc

Started on the §6 backlog from the prior `2026-05-03-observability-abi-automation-ux-handoff.md`:

1. **bg-app texture optimization** (#4 from prior backlog) — `bg-app.png` 1.71MB → AVIF 52KB / WebP 88KB; `globals.css` `.hub-scaffold` + `.arena-scaffold` consume via `image-set()` matching the existing `bg-ch.*` pattern. ~97% LCP payload cut. Commit `5f1a162`. Pushed earlier in session.
2. **PRO discoverability bundle decision** (#1-#3 from prior backlog) — re-audited against existing docs and confirmed the bundle was already designed in `docs/product/chesscito-pro-training-academy-strategy-2026-05-03.md`. The freeze gating C3+C4 was lifted (memory `project_pro_freeze_lifted` 2026-05-04). The genuine open work was P0-1 from `docs/reviews/product-ux-gameplay-triage-2026-05-02.md`: ProSheet active-state CTA + Coach signposting.
3. **Sally facilitated** a focused UX addendum in `bmad-create-ux-design` continuation mode (parent `ux-design-specification.md` was already at lastStep 14). Output: `_bmad-output/planning-artifacts/ux-design-addendum-pro-discoverability-2026-05-05.md` (533 lines, 7 sections).
4. **Implementation** kicked off SDD→TDD→EDD per CLAUDE.md. 3 commits landed against the §6.1 sequence in the addendum. Stopped at commit #3 by mutual agreement to maintain quality and ship a clean handoff.

---

## 2. Commits shipped (4, in chronological order)

| # | SHA | Subject | Suite | Notes |
|---|---|---|---|---|
| 1 | `5f1a162` | `perf(bg): bg-app AVIF + WebP variants — ~95% LCP payload cut` | 798/798 | Pushed. |
| 2 | `adb8dc4` | `feat(pro): ProActiveBadge — pill + counter + expiring variant` | 804/804 (+6) | Local only. |
| 3 | `4a42e61` | `feat(pro): ProActiveCTA — surface-aware Play in Arena / Got it` | 816/816 (+12) | Local only. |
| 4 | `889c97b` | `feat(pro): wire ProSheet active state — badge + CTA + extend link` | 819/819 (+3 net) | Local only. |

---

## 3. Addendum state

**File:** `_bmad-output/planning-artifacts/ux-design-addendum-pro-discoverability-2026-05-05.md` (gitignored — local artifact).
**Sections:** 7/7 written.
**Status:** complete.

| § | Topic | Status |
|---|---|---|
| §1 | Problem + evidence (P0-1) | written |
| §2 | Coach surface decision — `/arena` post-match only, v1 (ratified) | written |
| §3 | ProSheet active state — wireframe + components + edge cases | written |
| §4 | Arena in-match signposting — `<CoachOnboardingOverlay />` + `<CoachIncomingToast />` + attribution | written |
| §5 | Acceptance criteria + tests (16 unit + 4 E2E + 4 visual + telemetry contract) | written |
| §6 | Implementation order — 12 atomic commits, ~1.5 days est. | written |
| §7 | Done definition | written |

---

## 4. Implementation progress vs §6.1 sequence

**3 of 12 commits done. 9 remain.**

| # | Subject | State | Files affected |
|---|---|---|---|
| 1 | `feat(pro): ProActiveBadge — pill + counter + expiring variant` | ✅ | `pro-active-badge.tsx`, test, `editorial.ts` |
| 2 | `feat(pro): ProActiveCTA — surface-aware Play in Arena / Got it` | ✅ | `pro-active-cta.tsx`, test, `editorial.ts` |
| 3 | `feat(pro): wire ProSheet active state — badge + CTA + extend link` | ✅ | `pro-sheet.tsx`, test, `editorial.ts` |
| 4 | `feat(editorial): C4 — PRO_COPY kicker "Training Pass" + roadmap bullet` | ⏭ next | `editorial.ts`, `pro-sheet.tsx` (kicker render) |
| 5 | `feat(ui): ComingSoonChip primitive (C3)` | pending | new primitive + own test |
| 6 | `feat(pro): roadmap perks render ComingSoonChip` | pending | `pro-sheet.tsx` |
| 7 | `feat(arena): CoachOnboardingOverlay — first-visit PRO expectation setter` | pending | new component + test + `arena/page.tsx` mount |
| 8 | `feat(arena): CoachIncomingToast — post-checkmate bridge` | pending | new component + test + `arena/page.tsx` mount |
| 9 | `feat(coach): attribution line in CoachPanel` | pending | `coach-panel.tsx` |
| 10 | `feat(telemetry): wire pro_sheet_view + pro_active_cta_tap + coach_*` | pending | `lib/telemetry/*` + call sites |
| 11 | `test(visual): baselines for pro-sheet active + expiring + from-arena + coach-onboarding` | pending | snapshot baselines |
| 12 | `docs(release): handoff for PRO discoverability addendum landing` | pending | new handoff doc |

---

## 5. What's verified vs not

### Verified

- **TypeScript** clean across all 4 commits (`tsc --noEmit` exit 0).
- **Unit suite** clean: 819/819 (started 798, added net +21 tests for ProActiveBadge + ProActiveCTA + ProSheet rewrites + expiring sub-tests).
- **Visual regression** non-regressive on covered surfaces: `hub-clean` + `hub-daily-tactic-open` baselines unchanged; `hub-shop-sheet-open` failure is **pre-existing** (reproducible on prior HEAD; documented in `docs/reviews/e2e-baseline-red-2026-05-02.md` baseline lineage).
- **Build** `next build` clean (run before bg-app commit).

### Not verified yet

- **MiniPay smoke** on physical device — the four commits change ProSheet active-state UI; required before declaring P0-1 closed.
- **ProSheet visual baseline** — scheduled for commit #11 in §6.1 sequence. Today's surfaces produce no diff against pre-commit baselines because no ProSheet baseline existed.
- **Telemetry pipeline** — `pro_active_cta_tap{source}` and `pro_extend_tap{source}` events are emitted by code but not yet visible in Supabase `analytics_events` (no real PRO active wallet has tapped through since deploy).
- **`arena=new` smoke** carry-over from `2026-05-05-arena-scaffold-handoff.md` — independent, still pending owner action on physical MiniPay.

---

## 6. Open questions for next session

1. **Push timing.** 4 commits ahead of `origin/main` — `5f1a162` (bg-app, pushed earlier today) is up; `adb8dc4` + `4a42e61` + `889c97b` (PRO discoverability) are still local. Recommend pushing before starting commit #4 so origin reflects the wire-up.
2. **Commit #4 kicker render decision.** The addendum §3.6 lists `kicker: "Training Pass"` as a PRO_COPY key. Where does it render visually inside ProSheet? Two options:
   - (a) Above the existing `<SheetTitle>` "Chesscito PRO" header — small uppercase brown text.
   - (b) Replacing the existing `<SheetDescription>` tagline.
   Recommendation: (a). Keeps tagline as the "mission line" (canon §11), kicker as a category marker. Brief decision needed before commit #4.
3. **`<ComingSoonChip />` primitive scope.** Is this v1 chip used only in ProSheet roadmap, or also in `/about` / landing roadmap copy? If the latter, the component should accept a `variant` prop and live in `components/ui/`. Recommendation: keep it minimal in v1 (`components/pro/coming-soon-chip.tsx`), promote to `ui/` only when a second consumer materializes.
4. **`<CoachOnboardingOverlay />` mount point.** §4.2 specifies it must mount when arena state is `selecting`. The current `/arena/page.tsx` has multiple sub-states (selecting, mid-match, end-state, coach panel open). Need to confirm exact prop signature for the mount: probably gate inside `<ArenaSelectScaffold>` since that component **is** the selecting state.
5. **Verify-pro session attribution.** Memory note `project_pro_phase_0` mentions the Phase 0 freeze was informally lifted but a formal post-soft-launch baseline will need re-instating. Today's commits do not contaminate that future window because the funnel events (`pro_card_viewed`, `pro_purchase_*`) are unchanged — only post-purchase active-state UX shifted. Document explicitly when soft-launch happens.

---

## 7. Commands a next agent should run on resumption

```bash
# Re-orient
git log --oneline -5
git status -sb

# Sync first (3 commits ahead)
git push origin main

# Resume sequence at commit #4
# Read: _bmad-output/planning-artifacts/ux-design-addendum-pro-discoverability-2026-05-05.md §6.1 row 4
# Edit: apps/web/src/lib/content/editorial.ts → add PRO_COPY.kicker + new perksRoadmap entry "Guided by FIDE Master + dev team"
# Edit: apps/web/src/components/pro/pro-sheet.tsx → render kicker above SheetTitle
# Test: write RED + GREEN per SDD→TDD→EDD
# Commit: feat(editorial): C4 — PRO_COPY kicker "Training Pass" + roadmap bullet
```

---

## 8. References

- **Addendum spec:** `_bmad-output/planning-artifacts/ux-design-addendum-pro-discoverability-2026-05-05.md` (gitignored, local).
- **Parent UX spec:** `_bmad-output/planning-artifacts/ux-design-specification.md` (parent, lastStep 14).
- **Triage source:** `docs/reviews/product-ux-gameplay-triage-2026-05-02.md` row P0-1.
- **Strategy decision (Coach surface):** `docs/product/chesscito-pro-training-academy-strategy-2026-05-03.md` §11.
- **Freeze-lifted memory:** `~/.claude/projects/.../memory/project_pro_freeze_lifted.md`.
- **Prior session handoff:** `docs/release/2026-05-05-arena-scaffold-handoff.md` (Story C arena scaffold, also unpushed at start of this session).
- **Earlier prior:** `docs/handoffs/2026-05-03-observability-abi-automation-ux-handoff.md` (the §6 backlog this session attacked).

---

## 9. Bottom line

- **bg-app LCP optimization shipped.** ~97% payload cut on a high-traffic mobile surface.
- **PRO discoverability addendum is the new source of truth** for the active-state surface decisions. 533-line spec, 7 sections, 12-commit implementation roadmap. Sally facilitated; Wolfcito ratified each fork inline.
- **3 of 12 commits landed** with full TDD discipline: types first, RED tests, GREEN implementation, atomic commits, full suite + tsc verified at each step. ~1 day of focused work remains in the sequence.
- **No regression introduced.** Visual snapshots unchanged on covered surfaces; the one failing baseline is pre-existing and documented.

Session closed. Handoff captured. Push origin and resume at commit #4 next session.

— Wolfcito + agent (Sally + Claude Code)
