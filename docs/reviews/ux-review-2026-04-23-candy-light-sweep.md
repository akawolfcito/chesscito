# UX Review — Candy-Light Modal Sweep (#103 closure)

**Date:** 2026-04-23
**Scope:** Adversarial audit of the 10-commit sweep that unified modals/sheets/
panels to the candy-light aesthetic (piece picker as reference), plus the
`background-size: cover → 100% auto` change on the four hub sheet
background classes.

**Surfaces reviewed (10):**
- piece-picker-sheet, badge-sheet, shop-sheet, leaderboard-sheet (4 hub sheets)
- exercise-drawer (shares `.sheet-bg-hub`)
- purchase-confirm-sheet, promotion-overlay, victory-page, trophies page, splash
- pergamino surfaces (NOT touched, verified no regression):
  mission-detail-sheet, difficulty-selector, coach-loading/welcome, result-overlay × 3

**Artifacts consulted:**
- `apps/web/e2e-results/lf-sweep/*.png` (5 mobile captures)
- `apps/web/e2e-results/snapshots/*.png` (14 automated snapshots)
- Source files for every migrated component

---

## Critical (must fix)

_None._ All tested flows render correctly; no content is clipped, hidden, or
rendered with unreadable contrast. 305/305 unit + 112/112 E2E tests pass.

---

## Major (should fix)

### M1 — `bg-image: 100% auto` leaves implicit transparent band on tall sheets
**Files:** `apps/web/src/app/globals.css` (`.sheet-bg-hub::before`, `.sheet-bg-
badges::before`, `.sheet-bg-shop::before`, `.sheet-bg-leaderboard::before`)
**Where it's visible:** badge-sheet, leaderboard-sheet on viewports ≥700px
tall (tall iPhone).

The switch from `background-size: cover` to `100% auto` means the
bg-ch.png (1920×1200) now only covers `width × (1200/1920)` = 243.75px of
vertical space on a 390px-wide sheet. Below that 244px line, the ::before
image stops and the Sheet's `bg-background` (shadcn token, near-white in
light mode) shows through the `::after` cream gradient.

**Observed outcome:** In snapshots it looks visually OK — the cream wash
from the ::after gradient blends the transition convincingly. **BUT** on
darker devices (OLED, true-black dark mode browsers) or when the Radix
Sheet's `bg-background` resolves to a different value, the bottom half of
the sheet could flash to the resolved token, creating a visible horizontal
seam.

**Risk:** LOW today (all captured snapshots look fine), but fragile.
**Suggested fix:** explicitly set `background-color: var(--paper-bg)` on
the sheet container OR add a second background-image with solid cream below
the ::before image via `background-image: [image], linear-gradient(var(--paper-bg),var(--paper-bg))` with proper `background-position`.

### M2 — Tailwind color classes instead of CSS vars (token compliance)
**Files:** most migrated components
**Examples:**
- `piece-picker-sheet.tsx:68` — `border-cyan-400/75 bg-cyan-400/15 ring-2 ring-cyan-400/40`
- `trophy-card.tsx:8-26` — `bg-emerald-500/25 text-emerald-800`, `border-l-emerald-500/60`, etc.
- `badge-sheet.tsx:102` — `from-emerald-500 to-emerald-400`, `bg-amber-500`
- Multiple places use `rgba(110, 65, 15, X)` inline instead of a `--warm-brown-*` token.

**Issue:** The skill explicitly calls hardcoded Tailwind colors a token
violation (`text-amber-400` etc.). Project uses a mix: `--paper-text`,
`--paper-bg`, `--paper-text-muted` exist, but the sweep introduced many
inline `rgba(110, 65, 15, …)` literals. Future theme iteration will
require grepping and replacing dozens of call sites.

**Risk:** MEDIUM for maintenance. No user impact today.
**Suggested fix:** introduce `--warm-brown-text`, `--warm-brown-muted`,
`--warm-brown-subtle`, `--warm-brown-border-soft`, `--warm-brown-border-strong`,
`--candy-chip-locked-bg`, `--candy-chip-locked-text`, etc. Replace in a
follow-up dedicated commit.

### M3 — Duplicated inline style blocks
**Files:** purchase-confirm-sheet.tsx, shop-sheet.tsx, leaderboard-sheet.tsx,
badge-sheet.tsx, trophies/page.tsx, trophy-card.tsx

The "candy chip" style (`background: "rgba(120, 65, 5, 0.85)", color:
"rgba(255, 240, 180, 0.98)", letterSpacing: "0.10em"`) is literally
copy-pasted in 7 places: piece-picker SOON, badge-sheet LOCKED, shop-sheet
FEATURED, trophy-card rank 1-3 chips, purchase-confirm miniPayWarning,
etc.

**Issue:** If the user later adjusts the chip tone, 7 sites must be updated.
**Risk:** MEDIUM for maintenance.
**Suggested fix:** extract to `.candy-chip-locked`, `.candy-chip-warning`,
`.candy-chip-feature` CSS utility classes or a small `<CandyChip>` component.

---

## Minor (nice to fix)

### m1 — Aspect-ratio-dependent tree framing
On narrow mobile (390px) the forest image at `100% auto` shows ~244px of
trees at the top, which is ~29% of a typical 100dvh mobile sheet. On wider
tablets (600px+), the image is taller relative to viewport, potentially
covering stats/rows. Not a bug, but design intent is inconsistent across
breakpoints.
**Suggested:** clamp with `max-height` on the ::before layer.

### m2 — Rose-700 error text on cream is readable but could be warmer
**Files:** `trophy-list.tsx:42-53`, `victory-claim-error.tsx`
Error pill on cream uses `rgba(190, 18, 60, 0.35)` border + cream-rose
fill. Passes AA but reads slightly cold vs the warm-brown body text.
**Suggested:** use the `rose-700` / `#9f1239` token with a warm-tinted
border (`rgba(190, 18, 60, 0.5)` + cream highlight).

### m3 — Difficulty chips in trophy-card lose semantic tint hierarchy
**File:** `trophy-card.tsx:8-12`
Chips for difficulty 1/2/3 use saturated emerald/amber/rose at 25-30%
alpha. On cream, all three chips look similarly muted — the "rose = hard"
signal that existed on dark is weaker on light.
**Suggested:** crank alpha to 35-45% for rose specifically, or add a 1px
warm border to differentiate the tiers more clearly.

### m4 — `aria-pressed` missing on BadgeCard active state
**File:** `badge-sheet.tsx:72-77`
Piece picker picked up `aria-pressed` (CE5 from earlier red-team) but
BadgeCard never distinguishes "selected piece" visually and doesn't have
that state. **Not actionable**, just flagging the pattern isn't applied
uniformly.

### m5 — `drop-shadow(0_0_4px_rgba(251,191,36,0.5))` on earned achievement
**File:** `achievements-grid.tsx:46`
Drop-shadow with blur and alpha on a small (h-4 w-4) icon renders at ~4px
offscreen blur — barely visible on cream background. The glow that was
meaningful on dark slate doesn't read at all on cream.
**Suggested:** replace with amber text-shadow or drop the decoration
entirely (the "earned" state is already communicated by the amber card tint).

### m6 — Splash overlay has no content change
**File:** `apps/web/src/app/globals.css:1738-1766`
The fallback bg-color changed from dark to cream, but the white loading
text on top (`text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]` in
`app/page.tsx:793`) was calibrated for dark fallback. On the cream fallback
the white text with heavy dark drop-shadow reads as "text floating on a
dark blur over light background" — visually disjointed if the splash image
doesn't load instantly.
**Suggested:** use warm-brown text with cream shadow, matching the other
migrated surfaces — OR accept the transient state since it's <500ms visible.

---

## Passed

- **Piece picker (reference)** — all warmth + tree framing + readable chips.
- **Badge sheet** — trees now visible at top, LOCKED chips prominent,
  claim CTA legible.
- **Shop sheet** — FEATURED badge solid warm-brown chip reads clearly,
  "Coming soon" fallback warm-muted.
- **Leaderboard** — rank tier colors (bronze/silver/gold) preserved semantic
  via text color instead of frosted dark bg.
- **Purchase confirm** — info rows with warm-brown label + dark-brown value
  establish clear hierarchy, MiniPay warning as solid amber chip replaces
  previous dark-bg-amber-text which was illegible.
- **Promotion overlay** — candy-light modal over arena board, all 4 piece
  choices have consistent card styling.
- **Victory page** — trophy + amber CTA preserved, warm-brown title with
  cream shadow matches other hero moments.
- **Trophies page** — full viewport migration successful, purple roadmap
  chips distinguish speculative features without reverting to dark.
- **Mission briefing (floating)** — text-shadow escalation keeps readability
  on dim-grass scrim.
- **Pergamino consumers (hollow)** — mission-detail, arena selector,
  coach-loading/welcome, result-overlay × 3 untouched by this sweep.
  Verified unchanged in current snapshots; ribbon + border chrome still
  renders over dim scrim with no regressions.
- **Arena playing state (not modified)** — HUD pills intentionally remain
  dark as accent on grass bg (per design intent noted in `memory/project_candy_migration_state.md`).
- **All automated tests pass** — 305 unit, 112 E2E, 14 visual snapshots.

---

## Summary
- Surfaces audited: **10 migrated + 7 pergamino verified no regression**
- Critical: **0**
- Major: **3** (fragile tall-sheet bg transition, Tailwind token compliance, duplicated chip styles)
- Minor: **6** (aspect-ratio framing, error tone, difficulty chip contrast, ARIA gap, dead decoration, splash fallback text)
- Regressions introduced: **0**

**Recommendation:** ship the sweep as-is. Follow up with a single "design
tokens" commit that addresses M2 + M3 together (extracts warm-brown vars
and `.candy-chip-*` utility classes). Defer m1-m6 to a polish iteration.
