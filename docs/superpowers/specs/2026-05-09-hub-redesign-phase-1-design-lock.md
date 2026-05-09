# Hub Redesign — Phase 1 Design Lock

**Author**: Sally (UX Designer) — drafted via Claude
**Date**: 2026-05-09
**Status**: 🟢 P0 PATCHES LANDED — ready for Phase 3 implementation pending Wolfcito sign-off
**Predecessors**:
- `docs/superpowers/specs/2026-05-09-hub-redesign-design.md` §12 (locked decisions)
- `docs/handoffs/2026-05-09-sprint-4-arc-handoff.md` (Sprint 4E discovery + Phase 1 brief)
- `docs/audits/2026-05-07-hub-audit.md` (current scaffold + sheet round-trip baseline)
- `docs/superpowers/specs/2026-05-09-hub-redesign-phase-1-redteam.md` (Phase 2 red-team review)

**Patch ledger** (Phase 2 red-team P0 fixes applied 2026-05-09):
- **P0-1** §1.3 — `<TreasureTile size="medium">` → `size="small"` (canonical 88×100); grid math recalculated to 320 px content + 70 px buffer at 390 px viewport
- **P0-2** §1.1 — splash hero clarified as new `splash-knight-hero.webp` (NOT reused board-cell sprite)
- **P0-3** §1.1 + §4 — splash auto-dismiss removed (WCAG 2.2.1 compliance); tap-only dismiss; entrance + dismiss-hint fade-in retimed
- **P0-4** §1.5.1 (new) + §10 — atmosphere palette WCAG AA contrast gate added; Phase 7 merge blocked until contrast table is populated
- **P0-5** §6.4 (new) — Sheet → Hub `onPurchaseSuccess` callback contract typed (ProSheet + ShopSheet); race-condition guidance documented
- **P0-6** §7.1 — `URLSearchParams` replaced with Next.js 14 App Router `SearchParamsLike` object type

---

## 0. Reading order & scope

This is a **design-locked, prescriptive spec**. The discovery phase is closed (8 decisions locked 2026-05-09). This document specifies WHAT will be built without yet specifying HOW the React tree is rewritten — that's the implementation plan in Phase 3+.

**Sequence Wolfcito is committing to**: Phase 1 design lock (this) → Phase 2 red-team review (adversarial pass on the layouts, copy, motion, telemetry, a11y, flag mechanics, asset budget) → Phase 3+ implementation (prescriptive TDD plan in §9).

**No code changes are authorized by this spec alone.** It is an artifact for review.

**Locked decisions referenced throughout** (from discovery §12):
1. Direction **Z-revised** — mastery-first dashboard; PLAY at the dock with ceremony preserved
2. Splash **A** — onboarding-only (first-ever-visit cinematic; never re-shown)
3. Mastery **D** — full dashboard, 6 tiles dominant, locked Q/K visible with "coming soon"
4. Training Pass **C** — atmosphere shift (warm-wood when PRO active vs cool-stone default)
5. Migration **B** — `?hub=v2` flag, `[data-hub-v2]` body namespace
6. Heavy ports **B** — during (Phase 3 of arc)
7. Asset budget — **+20% (178 KB cap)**
8. DESIGN_SYSTEM update — see §8 of this spec

---

## 1. Layouts box-by-box

All measurements assume **390px viewport** (`--app-max-width`) and **`100dvh` height**. All zones respect existing UI Operating System invariants (DESIGN_SYSTEM.md §10).

### 1.1 Splash overlay — first-visit cinematic (Splash A)

```
┌──────────────────────────────────┐  390 × dvh, fixed inset:0
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  z-index: 60 (above dock z:50)
│                                  │  background: var(--scrim-deep) 92% opacity
│         ┌──────────────┐         │
│         │              │         │
│         │   ♞ knight   │         │  splash-knight-hero.webp (NEW asset, ≤6 KB)
│         │              │         │  hero-pulse 1.2s ease-spring entrance
│         └──────────────┘         │
│                                  │
│          Welcome, friend         │  text-2xl, font-display, gold tint
│      Small plays. Big habits.    │  text-sm, text-stone-300
│                                  │
│                                  │
│                                  │
│         (tap anywhere)           │  text-nano, text-stone-400, fade-in 600ms
│                                  │                              after entrance
└──────────────────────────────────┘
```

> **Asset note** (red-team P0-2 fix): the splash hero is a **purpose-cropped new asset**, NOT the reused `b-knight.webp` from `/art/pieces/`. The piece sprite is sized for board cells (~64 px target); upscaling it to hero-card size would look pixelated and waste bandwidth. The new `splash-knight-hero.webp` is a hero-framed crop optimized for the splash dimensions (see §3.2 for budget).

**Behavior** (post P0-3 fix — tap-only dismiss for WCAG 2.2.1 compliance):
- Mounts only when `localStorage.getItem("chesscito:hub-v2:splash:seen")` is null AND `?hub=v2` is active.
- **Entrance** (1.2s ease-spring hero-pulse) plays automatically on mount.
- **Dwell** is **indefinite** — splash remains visible until the user taps anywhere on the dialog. The "(tap anywhere)" hint fades in 600ms after the entrance completes (~1.8s post-mount), giving the cinematic moment full breathing room before nudging the user to act.
- **Tap-anywhere** → 0.6s exit transition + `localStorage.setItem("chesscito:hub-v2:splash:seen", "1")`. Never shown again on that device.
- **No auto-dismiss timer.** The splash will not unmount on its own. This is deliberate: WCAG 2.2.1 (Timing Adjustable) requires user control over time-limited content, and there is no "essential" exception that applies to a welcome screen. The localStorage flag already prevents re-show, so removing the auto-timer costs nothing in retention.
- `prefers-reduced-motion`: skip the entrance pulse; render hero static and immediately show the dismiss hint. Still requires tap to dismiss.
- ARIA: `role="dialog"`, `aria-labelledby="splash-title"`, `aria-modal="true"`. The dialog itself receives focus on mount (`tabindex="-1"`) so screen readers announce the title; tap-anywhere or `Enter`/`Space` on the focused dialog dismisses (addresses red-team P1-11 keyboard focus gap).

### 1.2 HUD top — compact chip rail (always visible, V2)

```
┌──────────────────────────────────┐  height: 56px (down from V1 ~72px)
│ [♔ 12] [PRO 26d] [Coach] [⊕ Connect?] │  scroll-x if overflow
└──────────────────────────────────┘
```

- 4 chip slots, each min 44px tap target, gap 8px.
- Chip order: **Trophies → PRO → Coach → Connect**. The Coach chip is now permanent (D1 audit fix).
- PRO chip atmosphere-aware: in cool-stone mode shows `PRO 26d` text-only; in warm-wood mode shows `PRO 26d` + tiny wax-seal glyph (◉) prefix.
- Connect chip: visible only when `!isWalletConnected && onConnectTap` is wired (existing logic preserved).
- Chip CSS: `<GemButton>` primitive (DESIGN_SYSTEM §16.1) for tappable chips; `<GemBadge>` for read-only counts.
- **Secondary row removed in V2** (streak/stars/shields). Stars relocate to mastery tile sub-text (per-piece star count). Streak relocates to a single sentence above the mastery dashboard ("4-day streak" or empty). Shields collapse into a single `Shield ×N` ribbon on the dock above PLAY (only when N > 0).

### 1.3 Mastery dashboard — 2×3 grid (canvas dominant, V2)

```
┌──────────────────────────────────┐  flex-1, takes all space between
│  4-day streak                    │  HUD and dock; min-h-0 + overflow-y-auto
│                                  │
│  ┌────┐  ┌────┐  ┌────┐         │  TreasureTile size="small" each
│  │ ♖  │  │ ♗  │  │ ♘  │         │  Tiles 88×100 px (canonical, §16.1)
│  │Rook│  │Bish│  │Knig│         │  gap 12px col, 16px row
│  │★★★ │  │★★· │  │··· │         │  → mastered / in-progress / locked
│  └────┘  └────┘  └────┘         │
│                                  │
│  ┌────┐  ┌────┐  ┌────┐         │
│  │ ♙  │  │ ♕  │  │ ♔  │         │  Q/K = "coming soon" placeholder
│  │Pawn│  │Quee│  │King│         │
│  │··· │  │soon│  │soon│         │
│  └────┘  └────┘  └────┘         │
│                                  │
│  ┌────────── Training Pass ──┐   │  TrainingPassBand (§1.5)
│  └──────────────────────────┘   │
└──────────────────────────────────┘
```

**Width math (verified, post P0-1)**: 88 px × 3 columns + 12 px × 2 column-gaps + 16 px × 2 container padding = **320 px** content width. Container `max-w-[var(--app-max-width)]` is 390 px → **70 px buffer** for safe-area-inset / device chrome. ✅

**Tile composition** (each cell):
- Background: `<TreasureTile size="small">` (DESIGN_SYSTEM §16.1, canonical 88×100 with ≤ 24 KB asset). Tile is tinted by state via the `data-mastery-state` attribute (see §3.1 selector contract).
- Foreground: piece art (`/art/pieces/w-{piece}.webp`) at **48×48** (scaled-down for the small tile), centered with 8 px top padding inside the tile. CSS tone filter:
  - **mastered**: full saturation + soft golden glow (`drop-shadow(0 0 6px rgba(243, 191, 92, 0.4))`)
  - **in-progress**: 80% saturation, no glow
  - **locked-buildable** (player can but hasn't): 40% saturation + 50% opacity
  - **coming-soon** (Q/K): 30% saturation + 50% opacity + diagonal "soon" wax-seal stamp at the bottom-right corner (8×8 SVG)
- Below piece: a single line of label + sub at `text-nano` (8px) for the small footprint:
  - Mastered: `Rook` over `★★★`
  - In-progress: `Rook` over `★★· 2/3`
  - Locked-buildable: `Rook` (sub line empty)
  - Coming-soon: `Queen` over `Soon` (full-contrast text, NOT dimmed — the piece sprite is dim, the LABEL is readable; addresses red-team P1-12)
- Tile tap → routes to `<BadgeSheet piece={piece}>` (in-place sheet, no `?legacy=1` round-trip — heavy port done in Phase 3).
- ARIA: tile `aria-label` follows existing `REWARD_COPY[piece].ariaLabel(state)` contract (extended with `coming-soon` state).

> **Why size="small"?** Red-team P0-1 caught that `<TreasureTile size="medium">` does not exist in `DESIGN_SYSTEM.md §16.1` — only `small | large` are canonical. `small` (88×100) fits 6 tiles with comfortable buffer at 390 px viewport; `large` (120×136) would overflow. No primitive contract change needed.

### 1.4 Dock — PLAY ceremony pinned (V2)

```
┌──────────────────────────────────┐  height: 96px (footer)
│ Practice pieces · See all trophies │  text-link row, text-xs, gap-3
│                                  │
│      ┌────────────────────┐     │  PrincipalButton size="large"
│      │   ▶  PLAY ARENA    │     │  full-width minus 24px padding
│      └────────────────────┘     │  carved-wood asset, idle-pulse 2s loop
│                                  │
└──────────────────────────────────┘
```

- `<PrincipalButton size="large">` rendered at the dock anchor. Idle-pulse animation (2s ease-in-out, scale 1.0 → 1.02 → 1.0) preserves "ceremony" without requiring full-canvas dominance.
- Above the button: a 2-link micro-row (text-xs, gap-3, justify-center). Links: **Practice pieces** (→ `/exercises`), **See all trophies** (→ `/trophies`).
- `Shield ×N` ribbon (when N > 0): renders ABOVE the link row, right-aligned, `<GemBadge>` size small. Tap → ShopSheet.
- The dock is `position: sticky; bottom: 0` within the scroll container, NOT fixed — so iOS safe-area-inset is handled by the container.
- ARIA: dock wrapped in `<footer aria-label="Primary actions">`.

### 1.5 Training Pass band — atmosphere-aware (V2)

```
ACTIVE (PRO):                                 INACTIVE:
┌──────────────────────────────────┐         ┌──────────────────────────────────┐
│ ◉  Training Pass · 26d           │         │  Unlock Coach + Premium          │
│    Sessions: 8/12 · Renews 6/3   │         │  $1.99 / 30 days                 │
│    [warm-wood texture overlay]   │         │  ▸ Daily Coach analyses          │
└──────────────────────────────────┘         │  ▸ 12 Arena sessions             │
                                              │  ▸ Wax-seal HUD                  │
                                              └──────────────────────────────────┘
```

- Active state: `<WoodBanner size="medium">` with warm-wood texture variant + wax-seal `◉` glyph + sessions progress bar (CSS, no Lottie).
- Inactive state: `<TreasureTile size="large">` with chest art + 3-perks bullet list + price chip.
- Tap (both states) → `<ProSheet>` opens in-place (heavy port Phase 3).
- **Atmosphere shift** (lock 4 — Training C): when PRO is active, the **entire** `[data-hub-v2]` namespace recolors:
  - Default cool-stone palette: `--hub-bg: var(--stone-900)`, `--hub-accent: var(--stone-500)`
  - Warm-wood active palette: `--hub-bg: var(--wood-900)`, `--hub-accent: var(--wood-500)`
  - Transition: 500ms ease-spring (`--duration-ceremony`) on `background-color` + `color`.
  - Trigger: PRO active state at `<HubScaffoldV2>` mount; on chip tap that purchases PRO, transition fires after the receipt confirms (see §6.4).

#### 1.5.1 Contrast gate (WCAG AA — added per red-team P0-4)

The atmosphere shift MUST NOT degrade accessibility for PRO subscribers
(paid users receiving worse contrast inverts the value signal). Phase 7
implementation owner is responsible for filling this table from the
final palette tokens BEFORE the V2 composition merges. The merge is
blocked until every row passes WCAG AA.

| Pair | Cool-stone palette | Warm-wood palette | AA threshold | Cool-stone ratio | Warm-wood ratio |
|---|---|---|---|---|---|
| Body text on hub BG | `--text-primary` on `--stone-900` | `--text-primary` on `--wood-900` | ≥ 4.5:1 | TBD | TBD |
| Muted text on hub BG | `--text-muted` on `--stone-900` | `--text-muted` on `--wood-900` | ≥ 4.5:1 | TBD | TBD |
| HUD chip label on chip BG | `--text-primary` on `--gem-pill-bg` | `--text-primary` on `--gem-pill-bg` (warm tint) | ≥ 4.5:1 | TBD | TBD |
| Mastery tile label on tile BG | `--text-primary` on tile bg | `--text-primary` on tile bg (warm tint) | ≥ 4.5:1 | TBD | TBD |
| PLAY button label on PrincipalButton | `--text-primary` on principalbutton | same | ≥ 4.5:1 | TBD | TBD |
| Wax-seal accent on hub BG (active only) | n/a | `--hub-accent` on `--wood-900` | ≥ 3:1 (UI/large) | n/a | TBD |

**Failure path**: if any row fails AA, the failing token MUST be retoned
(darken BG or lighten foreground) until compliant — atmosphere shift
ships compliant or it doesn't ship at all.

**Verification tooling**: use `apps/web/scripts/check-contrast.ts` (or
inline `relative-luminance` math) at PR time; document ratios in the PR
description for review.

---

## 2. Copy

All strings extend `HUD_COPY` and add new objects. Single-source-of-truth: `apps/web/src/lib/content/editorial.ts`. Document output language is English (per `_bmad/bmm/config.yaml`).

### 2.1 `HUB_V2_SPLASH_COPY` (new)

```ts
export const HUB_V2_SPLASH_COPY = {
  title: "Welcome, friend",
  tagline: "Small plays. Big mental habits.",
  dismissHint: "Tap anywhere to begin",
  ariaLabel: "Welcome screen",
  ariaTitleId: "splash-title",
} as const;
```

### 2.2 `HUB_V2_MASTERY_COPY` (new) — extends `REWARD_COPY` with V2 states

For each piece (rook, bishop, knight, pawn, queen, king):

```ts
{
  label: "Rook",                     // tile primary text
  subLocked: "Master to unlock",     // when no stars yet but exercises exist
  subInProgress: (current, total) => `${current}/${total}`,  // "2/3"
  subMastered: "★★★",                // mastered tier
  subComingSoon: "Coming soon",      // Q/K specifically
  ariaLabel: (state) =>
    state === "mastered" ? "Rook mastered, three stars"
    : state === "in-progress" ? `Rook in progress, ${current} of ${total} stars`
    : state === "locked-buildable" ? "Rook — start practicing to earn stars"
    : "Rook — coming soon"
}
```

Also adds a **section header** above the grid:

```ts
streakLabel: (days) => days === 0 ? "" : days === 1 ? "1-day streak" : `${days}-day streak`,
masteryDashboardAriaLabel: "Piece masteries",
```

### 2.3 `HUB_V2_TRAINING_COPY` (new) — replaces `<PremiumSlot>` strings in V2

```ts
export const HUB_V2_TRAINING_COPY = {
  active: {
    kicker: "Training Pass",
    daysFormat: (d: number) => `${d}d`,
    sessionsFormat: (used: number, total: number) => `Sessions: ${used}/${total}`,
    renewsFormat: (mmdd: string) => `Renews ${mmdd}`,
    ariaLabel: (d: number, used: number, total: number) =>
      `Training Pass active, ${d} days remaining, ${used} of ${total} sessions used`,
  },
  inactive: {
    title: "Unlock Coach + Premium",
    priceLabel: "$1.99 / 30 days",
    perks: [
      "Daily Coach analyses",
      "12 Arena sessions",
      "Wax-seal HUD",
    ],
    cta: "See plan",
    ariaLabel: "Training Pass — $1.99 for 30 days, see plan",
  },
} as const;
```

### 2.4 `HUB_V2_DOCK_COPY` (new)

```ts
export const HUB_V2_DOCK_COPY = {
  playLabel: "PLAY ARENA",
  playAriaLabel: "Open Arena to play full chess",
  practiceLinkLabel: "Practice pieces",
  practiceLinkAriaLabel: "Practice individual chess pieces",
  trophiesLinkLabel: "See all trophies",
  trophiesLinkAriaLabel: "Open the trophies collection",
  shieldsRibbonFormat: (n: number) => n === 1 ? "Shield ×1" : `Shield ×${n}`,
  shieldsRibbonAriaLabel: (n: number) =>
    n === 1 ? "1 retry shield available" : `${n} retry shields available`,
  footerAriaLabel: "Primary actions",
} as const;
```

### 2.5 Atmosphere transition microcopy (toast on PRO purchase, post-Phase 3)

Out-of-scope for the V2 mount path. Listed here for forward visibility only:

```ts
proAtmosphereToast: "Welcome to PRO. Your hub feels warmer now.",
```

---

## 3. Asset manifest

### 3.1 Reused (zero new bytes)

| Asset | Path | Used for |
|---|---|---|
| White piece sprites (6 pieces × 3 formats) | `/art/pieces/w-{piece}.{avif,webp,png}` | Mastery tile foreground |
| `principalbutton.webp` | `/art/scene-rooted/principalbutton.webp` | Dock PLAY ceremony |
| `treasure-chest-large.webp` | `/art/scene-rooted/` | Training inactive state |
| `wood-banner-medium.webp` | `/art/scene-rooted/` | Training active state |
| `gem-pill-bg.webp` | `/art/scene-rooted/` | HUD chips |

**Tone filters** (CSS, no new asset):
- `--mastery-state-mastered: drop-shadow(0 0 8px rgba(243, 191, 92, 0.4)) saturate(1.1);`
- `--mastery-state-in-progress: saturate(0.8);`
- `--mastery-state-locked: saturate(0.4) opacity(0.3);`
- `--mastery-state-coming-soon: saturate(0.2) opacity(0.3);`

### 3.2 New assets (budget gates)

| Asset | Format | Size cap | Purpose |
|---|---|---|---|
| `wood-banner-medium-warm.webp` | WebP, 32-bit | ≤ 22 KB | Atmosphere-shift active state for `<WoodBanner>` |
| `wax-seal-pro.svg` | SVG | ≤ 2 KB | Inline glyph on PRO chip + active training band |
| `splash-knight-hero.webp` | WebP, 24-bit | ≤ 6 KB | Onboarding splash hero |

**Budget breakdown**:
- Current scene-rooted vocabulary: 148 KB (per DESIGN_SYSTEM §16.3)
- New additions: 22 + 2 + 6 = **30 KB**
- Total V2 payload: **178 KB** ✅ (matches +20% cap exactly)
- AVIF/WebP pipeline mandatory for new raster assets; SVG for vector glyphs.
- No Lottie. No video. No gif.

### 3.3 Reduced-motion fallback

- Splash hero: render `<img>` static (no pulse animation); auto-dismiss at 1.5s instead of 3.5s.
- Dock PLAY: replace idle-pulse with a static border-glow at 60% saturation.
- Atmosphere shift: instantaneous swap (no 500ms transition).

---

## 4. Motion timing

All motion uses existing tokens (DESIGN_SYSTEM §11.3) — no new motion tokens.

| Motion | Token | Duration | Easing |
|---|---|---|---|
| Splash entrance (single hero pulse — scale 0.92 → 1.0) | (custom) | 1200ms | `--ease-spring` |
| Splash dismiss-hint fade-in (after entrance) | `--duration-ceremony` | 500ms (delayed +600ms) | `ease-in` |
| Splash exit (fade out on tap) | `--duration-enter` × 2 | 600ms | `ease-out` |
| Mastery tile press feedback | `--duration-snap` | 120ms | linear (existing scene-rooted §16.4) |
| Mastery tile state change (mastered glow appears) | `--duration-ceremony` | 500ms | `--ease-spring` |
| Atmosphere shift (cool-stone ↔ warm-wood) | `--duration-ceremony` | 500ms | `--ease-spring` |
| Dock PLAY idle-pulse | (inline 2s loop) | 2000ms | `ease-in-out` |
| Sheet open (BadgeSheet, ProSheet, ShopSheet) | `--duration-enter` | 300ms | `ease-out` (existing pattern) |
| HUD chip tap | `--duration-snap` | 120ms | linear |

**Motion principle**: ceremony reserved for ARRIVAL events (splash, mastered milestone, PRO atmosphere shift). Snap reserved for INTERACTION (taps). Enter for COMPOSITION (sheets, route transitions).

---

## 5. Telemetry

All events fire through the existing `track(event, payload)` helper. Naming convention: `hub_v2_*` for V2-only events, generic for those that merge with V1.

| Event | Payload | When fires |
|---|---|---|
| `hub_v2_view` | `{ proActive: boolean }` | `<HubScaffoldV2>` mount |
| `hub_v2_mastery_tap` | `{ piece, state, starsEarned }` | TreasureTile tap when state ∈ {mastered, in-progress, locked-buildable} |
| `hub_v2_mastery_locked_tap` | `{ piece }` | Q/K tile tap (state = coming-soon) — separate event so we can measure curiosity |
| `hub_v2_pro_chip_tap` | `{ proActive }` | PRO chip tap (active or inactive) |
| `hub_v2_coach_chip_tap` | — | Coach chip tap |
| `hub_v2_play_dock_tap` | `{ proActive, masteryProgress }` | Dock PLAY tap; masteryProgress = total stars / 18 |
| `hub_v2_practice_link_tap` | — | "Practice pieces" link tap |
| `hub_v2_trophies_link_tap` | — | "See all trophies" link tap |
| `hub_v2_shields_ribbon_tap` | `{ count }` | Shield ribbon tap |
| `hub_v2_training_band_tap` | `{ proActive }` | Training band tap (active or inactive) |
| `splash_view` | — | Splash mount (always preceded by `hub_v2_view`) |
| `splash_dismiss` | `{ method: "auto" \| "tap", elapsedMs }` | Splash unmount |
| `hub_atmosphere_shift` | `{ from: "cool-stone" \| "warm-wood", to, trigger: "mount" \| "purchase" }` | Atmosphere transition completes |
| `hub_v2_legacy_redirect` | `{ from: string }` | Fired when `?hub=v2` is set but flag is OFF (telemetry parity sentinel during ramp) |

**Privacy**: zero PII. No wallet addresses in payload. `masteryProgress` is computed client-side; not persisted server-side beyond the existing analytics pipeline.

**Parity gate** (Phase 8 promote criteria — discovery §8): V2 retention metrics ≥ V1 baseline for 7 consecutive days before flipping `?hub=v2` default to ON.

---

## 6. Heavy ports plan

Three sheets currently round-trip through `?legacy=1`. They must port into `<HubScaffoldV2>` BEFORE V2 ships, not after — they are dependencies of Z (mastery → BadgeSheet, PRO → ProSheet, shields → ShopSheet).

### 6.1 Port order (atomic commits, one per sheet)

| # | Sheet | Owner of state | New mount point | Tap source | Test contract |
|---|---|---|---|---|---|
| 1 | `<ProSheet>` | `<HubScaffoldV2>` (`useState`) | Inside scaffold body | PRO chip + Training band | Open in-place; no URL change; `onPurchaseSuccess` fires atmosphere shift (see §6.4) |
| 2 | `<BadgeSheet>` | `<HubScaffoldV2>` (`useState`, takes `piece` arg) | Inside scaffold body | Mastery tile tap | Open in-place per piece; no URL change; back button closes only the sheet |
| 3 | `<ShopSheet>` | `<HubScaffoldV2>` (`useState`) | Inside scaffold body | Shield ribbon tap | Open in-place; `onPurchaseSuccess` triggers shields-count refresh (see §6.4) |

### 6.2 Preserved contracts

- All existing testids (`pro-sheet-root`, `badge-sheet-root`, `shop-sheet-root`) preserved — V2 tests reuse the same selectors.
- All existing ARIA contracts preserved — sheets remain `role="dialog"` with focus-trap.
- All existing editorial keys preserved (`PRO_COPY`, `BADGE_COPY`, `SHOP_COPY`).

### 6.3 What gets killed in Phase 9 (cleanup)

- `legacyHubFor(...)` helper in `hub-scaffold-client.tsx`
- `?legacy=1` URL parsing in `app/hub/page.tsx`
- The `useEffect` in `play-hub-root:215` that bounces back from sheets (B2 root cause)
- `<PlayHubRoot>` component (becomes unreachable after V2 promote)
- `next.config.js` `/play-hub → /` rewrite (after one-release deprecation window)

### 6.4 Sheet → Hub callback contract (added per red-team P0-5)

Sheets must signal purchase success to the hub through a typed callback prop,
NOT via DOM events or URL bouncing. This makes the hub's atmosphere shift,
shields refresh, and telemetry deterministic.

```ts
/** Receipt payload emitted by ProSheet on a confirmed PRO purchase.
 *  Hub uses this to (a) trigger atmosphere shift, (b) emit
 *  `hub_atmosphere_shift` telemetry with `trigger: "purchase"`. */
type ProPurchaseReceipt = {
  txHash: `0x${string}`;
  daysGranted: number;
  /** Wallet that paid for the subscription. Used by the hub to verify the
   *  receipt belongs to the active session before atmosphere-shifting. */
  buyer: `0x${string}`;
};

type ProSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Fires AFTER the wagmi receipt confirms — NOT on user-initiated close. */
  onPurchaseSuccess?: (receipt: ProPurchaseReceipt) => void;
};

/** Equivalent contract for ShopSheet. Hub uses this to refresh
 *  `shields` count without a re-render of unrelated subtrees. */
type ShopPurchaseReceipt = {
  txHash: `0x${string}`;
  itemId: bigint;
  quantity: number;
  buyer: `0x${string}`;
};

type ShopSheetProps = {
  open: boolean;
  onClose: () => void;
  onPurchaseSuccess?: (receipt: ShopPurchaseReceipt) => void;
};
```

**Race conditions** (red-team P1-2 / P1-3 mitigation):

1. **Receipt during sheet close animation** — `onPurchaseSuccess` MUST be
   deferred until the sheet's exit transition completes. Implementation:
   queue the atmosphere-shift dispatch via `requestAnimationFrame` after
   `onClose()` resolves, OR fire `onPurchaseSuccess` only on
   `onAnimationEnd` of the exit transition.
2. **Receipt after user-cancel close** — if the user closes the sheet
   before tx confirmation but the tx still confirms, the sheet is
   unmounted and `onPurchaseSuccess` is no longer wired. The hub MUST
   carry an independent wagmi subscription to PRO/Shop contract events
   (keyed on the active wallet) so that confirmations are caught even
   when the sheet is gone.
3. **Cross-wallet receipt** — `receipt.buyer` MUST match the active
   `useAccount().address` before any state mutation. Reject silently if
   not matched (defense against multi-tab session drift).

**No DOM events, no global state mutations from sheets.** The callback
prop is the sole channel.

---

## 7. Flag mechanics

### 7.1 Activation matrix

| URL | Flag default OFF (Phase 7) | Flag default ON (Phase 8 promote) |
|---|---|---|
| `/hub` | `<HubScaffold>` (V1) | `<HubScaffoldV2>` |
| `/hub?hub=v2` | `<HubScaffoldV2>` | `<HubScaffoldV2>` |
| `/hub?hub=v1` | `<HubScaffold>` (V1) | `<HubScaffold>` (V1) — escape hatch |

**Default flip rule**: a single env var or constant at `apps/web/src/lib/feature-flags.ts`:

```ts
/** Next.js 14 App Router server-component searchParams shape. Each key may be
 *  a single value, an array (when the URL repeats the key), or undefined. */
type SearchParamsLike = { [key: string]: string | string[] | undefined };

export const HUB_V2_DEFAULT = false; // flip to true in Phase 8

export function resolveHubVariant(searchParams: SearchParamsLike): "v1" | "v2" {
  const raw = searchParams.hub;
  const explicit = Array.isArray(raw) ? raw[0] : raw;
  if (explicit === "v2") return "v2";
  if (explicit === "v1") return "v1";
  return HUB_V2_DEFAULT ? "v2" : "v1";
}
```

> **Why not `URLSearchParams`?** Next.js 14 App Router server components receive
> `searchParams` as a plain object, not a `URLSearchParams` instance. Using
> `URLSearchParams` would compile-fail at the page boundary. (Red-team P0-6,
> 2026-05-09.)

### 7.2 `[data-hub-v2]` namespace

Body-level data attribute set by `<HubScaffoldV2>` on mount (cleared on unmount). All V2-specific CSS lives under this scope:

```css
[data-hub-v2] { --hub-bg: var(--stone-900); --hub-accent: var(--stone-500); }
[data-hub-v2][data-pro-active] { --hub-bg: var(--wood-900); --hub-accent: var(--wood-500); }
[data-hub-v2] .hub-mastery-grid { ... }
```

This isolates V2 palette + layout from V1 styling. No global CSS tokens drift.

### 7.3 Server-side resolution

`app/hub/page.tsx` reads `searchParams` and renders V1 or V2 directly — no client flicker. Both `<HubScaffold>` and `<HubScaffoldV2>` are server-bootable (the `client` suffix wrappers handle wallet hooks).

### 7.4 Promote criteria (Phase 8 gate)

All four must pass for 7 consecutive days before flipping `HUB_V2_DEFAULT = true`:

1. **Telemetry parity**: `hub_v2_play_dock_tap` rate ≥ `hub_play_tap` rate (V1 baseline) — i.e., PLAY discovery is at least as good.
2. **Splash dismiss**: ≥ 95% of `splash_view` events have a matching `splash_dismiss` within 10s (i.e., splash isn't trapping users).
3. **Mastery engagement**: `hub_v2_mastery_tap` > 0 across all 4 buildable pieces (R/B/K/P) — confirms 6-tile dashboard isn't ignored.
4. **Zero P0 a11y / crash reports** in `<PrimitiveBoundary>` telemetry across V2.

### 7.5 Rollback playbook (max 3 commits)

1. `git revert` the Phase 8 promote commit (flag flip)
2. If V2 still rendering for some users, push `app/hub/page.tsx` change forcing V1 unconditionally
3. Telemetry: post-mortem, identify breakage; restart promote criteria countdown

---

## 8. DESIGN_SYSTEM.md update

Z-revised inverts a baseline assumption — that PLAY must dominate the canvas. Rather than rewrite §16.4, we add a focused amendment as **§16.7**:

### Proposed addition to DESIGN_SYSTEM.md

```markdown
### 16.7 Anchor flexibility for `<PrincipalButton>` (Hub Redesign 2026-05-09)

`<PrincipalButton>` merits ceremony — carved-wood asset, size-large variant,
idle-pulse motion — wherever it appears. **It is NOT canvas-bound.** Three
canonical anchor positions:

| Anchor | When to use | Example |
|---|---|---|
| **Canvas-centered** | Single-task screen where the primary action IS the screen | `/arena` mid-game (Mate detected) |
| **Dock-anchored** | Higher-frequency surface fills the canvas; PLAY remains accessible without competing | `/hub` V2 mastery dashboard |
| **Modal-pinned** | Sheet/modal where the action concludes the workflow | `<VictoryClaimSheet>` → "Save Victory" |

In all three positions:
- Asset stays `principalbutton.webp` (`size="large"`)
- Idle-pulse animation preserved (2s ease-in-out, scale 1.0 → 1.02 → 1.0)
- Touch target ≥ 56px (16px above the 44px minimum) per ceremony status
- Single primary CTA per surface remains the rule

**Anti-pattern**: do NOT scale `<PrincipalButton>` down to `size="medium"` or
`"small"` when it's docked. If the dock is too cramped for ceremony, redesign
the dock — don't shrink the button.
```

This addition is part of the Phase 1 deliverable but is committed alongside the V2 implementation work in Phase 7 (so DESIGN_SYSTEM stays consistent with the rendered reality).

---

## 9. TDD plan

All new tests fail-first per the SDD → TDD → EDD cycle (CLAUDE.md). Tests live in `apps/web/src/components/hub/__tests__/` (existing folder).

### 9.1 Phase 3 — Heavy ports (3 commits, 3 test specs)

| File | Asserts |
|---|---|
| `pro-sheet-port.test.tsx` | (1) PRO chip tap mounts `<ProSheet>` in-place, no router push; (2) sheet close does NOT change URL; (3) close after purchase fires `hub_atmosphere_shift` event with `trigger: "purchase"` |
| `badge-sheet-port.test.tsx` | (1) Mastery tile tap (rook) mounts `<BadgeSheet piece="rook">` in-place; (2) sheet close preserves scroll position of mastery grid; (3) tile re-renders with updated state on sheet receipt |
| `shop-sheet-port.test.tsx` | (1) Shield ribbon tap mounts `<ShopSheet>` in-place; (2) shields count chip refreshes after sheet close (purchase) |

### 9.2 Phase 4 — Splash primitive (1 commit, 1 test spec)

| File | Asserts |
|---|---|
| `hub-splash.test.tsx` | (1) Splash mounts only when localStorage flag is null AND `?hub=v2` active; (2) auto-dismisses at 3.5s; (3) tap-anywhere dismisses immediately + sets localStorage flag; (4) `prefers-reduced-motion` skips entrance animation + auto-dismisses at 1.5s; (5) NEVER mounts on second visit; (6) ARIA: `role="dialog"`, `aria-labelledby` matches `splash-title` id |

### 9.3 Phase 5 — Mastery dashboard (1 commit, 2 test specs)

| File | Asserts |
|---|---|
| `mastery-dashboard.test.tsx` | (1) Renders 6 tiles in 2×3 grid in canonical order (R B N P Q K); (2) Q/K tiles render with `data-state="coming-soon"`; (3) tile tap fires `hub_v2_mastery_tap` for buildable pieces; (4) tile tap fires `hub_v2_mastery_locked_tap` for Q/K; (5) ARIA: each tile has `aria-label` per `HUB_V2_MASTERY_COPY[piece].ariaLabel(state)` |
| `mastery-tile-states.test.tsx` | (1) State `mastered` renders 3 stars + golden glow class; (2) State `in-progress` renders partial stars + sub `2/3`; (3) State `locked-buildable` renders no stars + dim filter; (4) State `coming-soon` renders "Coming soon" sub + wax-seal class |

### 9.4 Phase 6 — Training Pass band (1 commit, 1 test spec)

| File | Asserts |
|---|---|
| `training-pass-band.test.tsx` | (1) Active state renders kicker + days + sessions progress; (2) Inactive state renders title + price + 3 perks; (3) Tap (both states) fires `hub_v2_training_band_tap`; (4) Atmosphere shift fires when active prop transitions false → true (mocked timer) |

### 9.5 Phase 7 — V2 composition (1 commit, 2 test specs)

| File | Asserts |
|---|---|
| `hub-scaffold-v2.test.tsx` | (1) Renders splash → HUD → mastery dashboard → dock in document order; (2) `[data-hub-v2]` attribute set on mount; (3) `[data-pro-active]` attribute set when PRO active; (4) Atmosphere shift CSS variables resolve correctly via `getComputedStyle`; (5) Dock PLAY tap fires `hub_v2_play_dock_tap` with masteryProgress payload |
| `hub-flag-resolution.test.tsx` | (1) `?hub=v2` overrides default-off → renders V2; (2) `?hub=v1` overrides default-on → renders V1; (3) No query + default-off → V1; (4) No query + default-on → V2; (5) Server-side resolution: V1 vs V2 chosen at render, no client flicker |

### 9.6 Phase 8 — Promote (no new tests; telemetry watch only)

Existing tests continue to pass. Telemetry parity gate is a manual review per §7.4.

### 9.7 Phase 9 — Cleanup (1 commit, removes tests)

- Delete `play-hub-root.test.tsx` (component removed)
- Delete `hub-scaffold.test.tsx` (V1 removed)
- Update `hub-flag-resolution.test.tsx` to drop the `?hub=v1` escape-hatch case (post-deprecation)

### 9.8 Total test budget

- New specs: **9** (3 ports + 1 splash + 2 mastery + 1 training + 2 composition)
- Tests deleted at Phase 9: **2** (V1 + PlayHubRoot)
- Net suite delta: **+7 specs**, ~**40-50 new test cases**
- Suite must remain green at every phase boundary (existing 1292/1292 baseline holds during ramp)

---

## 10. Phase exit criteria checklist

Each phase completes when ALL boxes are checked.

### Phase 1 — Design lock (this doc)
- [x] §1 layouts box-by-box for 5 zones
- [x] §2 copy strings for splash, mastery, training, dock
- [x] §3 asset manifest with budget under 178 KB
- [x] §4 motion timing using existing tokens
- [x] §5 telemetry events with payloads
- [x] §6 heavy-ports plan with port order
- [x] §7 flag mechanics with promote criteria + rollback
- [x] §8 DESIGN_SYSTEM §16.7 amendment draft
- [x] §9 TDD plan with fail-first specs per phase

### Phase 2 — Red-team (next)
- [x] Adversarial review of layouts (orphan states, race conditions, focus trap edge cases) — 2026-05-09
- [x] A11y regression audit (screen reader pass on splash → dashboard → sheet) — partial; P0-3 splash WCAG flagged
- [ ] Performance budget verification (Lighthouse mobile, LCP < 2.5s with V2) — deferred to Phase 7
- [x] Copy edge cases (long PRO days, 0/0 sessions, 0 stars, 0 streak) — captured as P1/P2
- [x] All P0 findings addressed; P1 findings logged for follow-up — see §10.1

### Phase 7 — V2 composition (added gate per P0-4)
- [ ] §1.5.1 contrast table fully populated; every row meets WCAG AA before merge

### Phases 3–9
Defined in discovery spec §8; gated by Phase 2 sign-off + Phase 1 patches landed.

---

## 11. Open items / risks (carry into red-team)

1. **Splash dismiss localStorage key collision** — if a future feature reuses `chesscito:hub-v2:*` namespace, the splash flag could be inadvertently cleared. Mitigation: prefix with full path `chesscito:hub-v2:splash:seen` (already done above) + document in DESIGN_SYSTEM.
2. **Atmosphere shift on mount vs purchase** — if PRO is already active when V2 first renders, do we play the 500ms ceremony or arrive in warm-wood instantly? Recommend: instant on mount (no ceremony) to avoid every-session animation; reserve ceremony for the actual purchase event. Confirm in red-team.
3. **Q/K mastery tap dead-end** — `hub_v2_mastery_locked_tap` fires but no destination exists yet. Options: (a) toast "Coming soon" + telemetry; (b) tile is non-tappable + telemetry on long-press. Recommend (a) — preserves discoverability signal.
4. **MiniPay WebView quirks** — splash uses `localStorage`. MiniPay WebView has reset behaviors (per memory `project_test_infra.md`). Smoke test: verify localStorage persists across MiniPay session restart.
5. **Idle-pulse animation battery cost** — 2s loop on dock PLAY runs continuously. Mitigation: `prefers-reduced-motion` already kills it; consider also killing on `document.visibilityState !== "visible"`.
6. **Asset budget contingency** — if `wood-banner-medium-warm.webp` exceeds 22 KB after final art delivery, options: (a) reduce dimensions; (b) drop SVG wax-seal (save 2 KB); (c) re-tint existing `wood-banner-medium.webp` via CSS filter (saves all 22 KB but compromises visual quality). Recommend: enforce 22 KB ceiling at ImageMagick step.
7. **Flag default-off duration** — discovery §8 says "promote when telemetry parity ≥ V1 baseline for 7 days." But what if parity never lands (V2 underperforms)? Need a kill-criteria: if V2 is materially worse for 14 days, revert + retro. Confirm in red-team.

---

## 12. Total scope estimate (phases 3–9, refined)

| Phase | Commits | Owner | Risk |
|---|---|---|---|
| 3 — Heavy ports | 3 | Wolfcito | Medium (race conditions on close) |
| 4 — Splash primitive | 2 | Wolfcito | Low |
| 5 — Mastery dashboard | 3 | Wolfcito | Medium (CSS tone filter cross-browser) |
| 6 — Training Pass band | 2 | Wolfcito | Low |
| 7 — V2 composition + flag | 4 | Wolfcito | Medium (atmosphere shift CSS) |
| 8 — Promote (flag flip) | 1 | Wolfcito | Low (revertible) |
| 9 — Cleanup | 3 | Wolfcito | Low |

**Total: ~18 commits across 6 phases.** (Below the discovery §12 estimate of 28-30 — the ports being 3 sheets instead of 6+ surfaces and reusing scene-rooted primitives compresses scope.)

---

## 13. Sign-off ledger

| Step | Status | Date | Owner |
|---|---|---|---|
| Discovery (Phase 0) | ✅ Complete | 2026-05-09 | Wolfcito + Claude |
| Design lock (Phase 1) — initial draft | ✅ Complete | 2026-05-09 | Sally |
| Red-team (Phase 2) | ✅ Complete | 2026-05-09 | Winston (6 P0 + 13 P1 + 17 P2 findings) |
| Phase 1 P0 patches | ✅ Complete | 2026-05-09 | Sally (P0-1/2/3) + Winston (P0-4/5/6) |
| Wolfcito sign-off on patched spec | ⏳ Pending | TBD | Wolfcito |
| Implementation (Phases 3–9) | ⏳ Blocked on sign-off | TBD | Wolfcito |

---

**End of Phase 1 design-lock spec.** Next action: Wolfcito reviews the patched spec + the red-team report (`2026-05-09-hub-redesign-phase-1-redteam.md`), gives sign-off, then Phase 3 (heavy ports) begins. P1 findings carry into Phase 3 work tickets; P2 findings ride alongside as known risks.
