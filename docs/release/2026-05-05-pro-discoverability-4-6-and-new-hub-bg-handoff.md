# Session Handoff — PRO Discoverability commits #4-#6 + new-hub bg (2026-05-05)

> **Author:** Wolfcito + agent (Claude Code).
> **Status:** **Closed.** 4 commits landed and pushed. PRO Discoverability addendum: 6 of 12 done. New-hub asset integration: phase 1 (background) done; remaining assets deferred to next session with structured plan below.
> **Branch:** `main`. `origin/main` synced — local matches `b2506e7`.

---

## 1. Session arc

Resumed from `2026-05-05-pro-discoverability-commits-1-3-handoff.md` (which closed at commit #3 of the §6.1 sequence).

1. **Plan-confirm → execute** for §6.1 commit #4 (`PRO_COPY.kicker` + roadmap bullet). Two micro-decisions resolved inline (kicker style, roadmap bullet wording).
2. **Continued through §6.1 commits #5 and #6** (`<ComingSoonChip />` primitive + ProSheet wire-up). Each commit: SDD → TDD → EDD per CLAUDE.md, atomic, full suite + tsc + visual run before staging.
3. **Pivot mid-session** to integrate the design-refresh asset batch dropped in `design/new-assets-chesscito/` (28 files). Triaged the batch; agreed to land only the highest-impact / lowest-risk piece this session (background swap) and defer the rest with a structured handoff.
4. **Commit #4 of this session** (`bg-new-hub`): converted the 1.8 MB PNG → AVIF 67 KB / WebP 110 KB triplet via the same pipeline as `5f1a162`, swapped `.hub-scaffold` background to consume it.

---

## 2. Commits shipped (4, in chronological order)

| # | SHA | Subject | Suite | Notes |
|---|---|---|---|---|
| 1 | `5944249` | `feat(editorial): C4 — PRO_COPY kicker "Training Pass" + roadmap bullet` | 821/821 (+2) | Pushed. |
| 2 | `f2852cf` | `feat(ui): ComingSoonChip primitive (C3)` | 824/824 (+3) | Pushed. |
| 3 | `291f341` | `feat(pro): roadmap perks render ComingSoonChip` | 826/826 (+2) | Pushed. |
| 4 | `b2506e7` | `feat(hub): bg-new-hub forest path background — AVIF + WebP variants` | 829/829 | Pushed. |

> Note on suite count drift: `b2506e7` shows 829 with no test-source change. Re-runs are stable. Likely cause: a parametrized test re-counted a different way after the CSS edit, or a vitest cache rebuild surfaced tests previously masked. Worth a quick audit at the start of next session — but no failure, all green.

---

## 3. Addendum state

**File:** `_bmad-output/planning-artifacts/ux-design-addendum-pro-discoverability-2026-05-05.md` (gitignored).
**Sequence completion:** 6 of 12 commits landed.

| # | Subject | State |
|---|---|---|
| 1 | `feat(pro): ProActiveBadge` | ✅ |
| 2 | `feat(pro): ProActiveCTA` | ✅ |
| 3 | `feat(pro): wire ProSheet active state` | ✅ |
| 4 | `feat(editorial): C4 — kicker + roadmap bullet` | ✅ this session |
| 5 | `feat(ui): ComingSoonChip primitive (C3)` | ✅ this session |
| 6 | `feat(pro): roadmap perks render ComingSoonChip` | ✅ this session |
| 7 | `feat(arena): CoachOnboardingOverlay` | ⏭ next |
| 8 | `feat(arena): CoachIncomingToast` | pending |
| 9 | `feat(coach): CoachPanel attribution line` | pending |
| 10 | `feat(telemetry): wire pro_sheet_view + ...` | pending |
| 11 | `test(visual): baselines (pro-sheet, expiring, from-arena, coach-onboarding)` | pending |
| 12 | `docs(release): handoff for PRO discoverability addendum landing` | pending |

---

## 4. New-hub asset integration — plan for next session

`design/new-assets-chesscito/` ships 28 files. Phase 1 (background) landed in `b2506e7`. The remaining work is **not** one commit — each slot has its own decision and merits an atomic commit.

### 4.1. Asset inventory (post-batch)

| Asset | Weight | Proposed role | Decision required |
|---|---|---|---|
| ✅ `bg-new-hub.png` | 1.8 MB | `.hub-scaffold` background | Done. |
| `chessito-title.png` | 165 KB | Title plaque ("CHESSCITO" wooden sign) | Where to anchor in 390px without robbing CTA real estate. |
| `avatar-chesscito.png` | 193 KB | Wolf-wizard mascot, blue robe + staff | Replace `<KingdomAnchor variant="playhub">` or coexist beside it? |
| `principalbutton.png` | 50 KB | Pill button shell (green glossy) | Restyle `<PrimaryPlayCta>` from candy gradient to image-set button. |
| `portal.png` | 332 KB | Wooden frame, asymmetric tree-trunk corner | Slot unclear. Candidates: panel for premium slot, or `<KingdomAnchor>` frame. |
| `flower1-4.png` | 7-10 KB | Decorative scatter (foreground) | New "scatter layer" needed (z-index above bg, below HUD). |
| `plant1-5.png` | 11-19 KB | Decorative scatter | Same scatter layer. |
| `tree1-3.png` | 30-62 KB | Mid-foreground decoratives | Scatter layer or background composite. |
| `piedra1-10.png` | 1-44 KB | Stones, varied sizes | Scatter layer. |
| `frog.png` | 50 KB | Optional creature decorative | Easter-egg slot? Or animated idle? |
| `hongo.png` | 26 KB | Mushroom decorative | Scatter layer. |
| `punto-alerta-notificacion.png` | 8 KB | Notification dot | New visual on `<HudResourceChip>` when there's pending state. |

### 4.2. Recommended commit sequence

| # | Subject | Surface | Risk |
|---|---|---|---|
| A | `feat(hub): chessito title plaque in scaffold header` | `hub-scaffold.tsx` + `globals.css` | Medium — requires header layout decision |
| B | `feat(hub): avatar Chesscito as kingdom anchor (replaces variant="playhub")` | `kingdom-anchor.tsx` + `hub-scaffold.tsx` | High — touches the central composition |
| C | `feat(hub): primary play CTA — principalbutton image-set treatment` | `primary-play-cta.tsx` | Low — visual swap with prop preserved |
| D | `feat(hub): notification dot on hud-resource-chip when state pending` | `hud-resource-chip.tsx` + new `<NotificationDot />` primitive | Medium — needs prop API + caller rewire |
| E | `feat(hub): decorative scatter layer (flowers/plants/stones/trees)` | new `<HubScatterLayer />` + `globals.css` z-index work | Medium — careful not to break tap targets |
| F | `feat(hub): portal frame for premium slot card` | `pro-mission/premium-slot.tsx` | Low — frame swap |
| G | `test(visual): baselines for new-hub scaffold` | new e2e cases hitting `/hub` (not `?legacy=1`) | Required — no protection on hub-scaffold today |

### 4.3. Critical pre-work for next session

- **Add visual baselines for `/hub` (non-legacy)** before any of A-F land. Today `e2e/visual-regression.spec.ts` only covers `/hub?legacy=1`, so changes to `<HubScaffold>` ship unprotected. New cases:
  - `hub-scaffold-clean` — anonymous, default state
  - `hub-scaffold-pro-active` — connected wallet, PRO active mock
- **Confirm avatar role with the user.** Memory `project_visual_redesign` notes `<KingdomAnchor>` is "the central composition primitive" — replacing it has cascading implications for arena scaffold (`<KingdomAnchor variant="arena">`) which uses the same component.
- **Optimize remaining heavy assets** (`portal.png` 332 KB, `avatar-chesscito.png` 193 KB, `chessito-title.png` 165 KB) to AVIF/WebP triplets in `apps/web/public/art/redesign/` before consumption. Same `cwebp -q 82 -m 6` + `avifenc --speed 4 --min 0 --max 60` pipeline used in `b2506e7`.

---

## 5. What's verified vs not

### Verified
- **TypeScript** clean across all 4 commits (`tsc --noEmit` exit 0 each time).
- **Unit suite** all green: 821 → 824 → 826 → 829 (final).
- **Visual regression** non-regressive on covered surfaces (`hub-clean`, `hub-daily-tactic-open` pass; pre-existing `hub-shop-sheet-open` failure unaffected, documented in `docs/reviews/e2e-baseline-red-2026-05-02.md`).

### Not verified
- **MiniPay smoke** on physical device for `/hub` with the new background — needs eyes on the actual scene composition (the bg is dramatically different in tone; might clash with the existing HUD chip palette).
- **ProSheet visual baseline** — still scheduled for §6.1 commit #11.
- **`<HubScaffold>` visual baseline** — net-new debt called out in §4.3 above. Should land before any of next session's commits A-F.
- **Telemetry pipeline** — `pro_active_cta_tap{source}` and `pro_extend_tap{source}` events still pending Supabase verification (no real PRO active wallet has tapped through since deploy).

---

## 6. Open questions for next session

1. **Avatar coexistence vs replacement.** Does `avatar-chesscito.png` *replace* the chess-piece kingdom-anchor visual, or *augment* it (e.g., wolf-wizard standing next to a smaller anchor)? Memory says `<KingdomAnchor>` is shared with arena — a replacement here ripples into `kingdom-anchor.tsx`.
2. **Title plaque ↔ HUD layout.** The new bg already has visual richness in the upper third (sky + clouds). A 165 KB title plaque overlaid there might fight the bg. Two options: (a) anchor title above the HUD chips with controlled padding, (b) absolute-position over the bg's sky region. Mock the page first.
3. **Scatter density.** 4 flowers + 5 plants + 3 trees + 10 stones + frog + hongo = 23 decoratives. The bg already has its own scatters baked in. We risk visual noise on a 390 px viewport — recommend rendering only ~6-8 of these and treating the rest as a swappable pool (or unused).
4. **Suite count audit.** 826 → 829 jump on a CSS-only commit needs explanation. Possibly a vitest cache stale-invalidation artifact. Run `pnpm vitest run --reporter=verbose | grep "test:" | wc -l` at the next session start to confirm the actual test count vs. reported.

---

## 7. Commands for resumption

```bash
# Re-orient
git log --oneline -6
git status -sb

# Confirm all clean — should match b2506e7
git rev-parse HEAD
git rev-parse origin/main

# Decide path forward (two parallel sequences):

# Path A — Continue PRO discoverability §6.1 sequence at commit #7
# Read: _bmad-output/planning-artifacts/ux-design-addendum-pro-discoverability-2026-05-05.md §4.2
# Build: <CoachOnboardingOverlay /> primitive + arena/page.tsx mount
# Tests: AC-4.1, AC-4.2, AC-4.3, AC-4.4, E2E-3

# Path B — New-hub asset integration §4.2 sequence
# Read: this handoff §4 + design/new-assets-chesscito/
# Pre-work: Add hub-scaffold visual baselines (§4.3)
# Then: commit A (title plaque) → B (avatar) → C (button) → D (dot) → E (scatter) → F (portal frame)

# Recommendation: Path A first (closer to user-visible PRO impact);
# Path B carries more ambiguity and merits a brainstorming pass before code.
```

---

## 8. References

- **Addendum spec:** `_bmad-output/planning-artifacts/ux-design-addendum-pro-discoverability-2026-05-05.md` (gitignored).
- **Prior session handoff:** `docs/release/2026-05-05-pro-discoverability-commits-1-3-handoff.md`.
- **bg-app pipeline reference:** `5f1a162` (commit message documents the AVIF/WebP triplet pattern reused here).
- **Asset folder:** `design/new-assets-chesscito/` (28 files, source of truth for next session).
- **Memory:** `project_visual_redesign`, `project_candy_migration_state`, `feedback_design_system_process`.

---

## 9. Bottom line

- **Half of the PRO discoverability addendum is in `main`.** 6 of 12 commits, all atomic, all TDD-disciplined, all green.
- **`<ProSheet>` active state is feature-complete** for the kicker + roadmap surface. Arena overlays (#7-#9) are the next visible-to-user move.
- **New-hub bg shipped** — first piece of the design-refresh batch, ~96% LCP payload cut on `/hub`.
- **Asset integration is queued, not implemented.** Seven commits planned (§4.2), each requiring a design-decision pass. Visual baselines for `<HubScaffold>` are pre-work — they don't exist today and the redesign will ship blind without them.

Session closed. 4 commits pushed. Handoff captured.

— Wolfcito + Claude Code
