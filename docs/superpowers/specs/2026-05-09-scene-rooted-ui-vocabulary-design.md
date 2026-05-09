# Spec — Scene-Rooted UI Vocabulary

**Date**: 2026-05-09
**Status**: draft
**Author**: Claude (Opus 4.7) + Sally (UX) consultation
**Supersedes**: M3.5 `<CandyButton>` direction (closed by M3 closeout audit, same date)

## Problem

Chesscito's chrome (CTAs, badges, banners) lives as **abstract widgets** layered on top of a richly painted forest scene. Round pills, horizontal banners, and grid tiles use `candy-frame-amber|gold` as a neutral container — they communicate "this is a button" but not "this is a thing in the world."

The project has a complete environmental asset library (10 stones, plants, trees, mushroom, frog, portal, principal button, wood banners, treasure chests, gem pill base) that the codebase **does not consume**. As a result, the play-hub reads as "clean but generic" rather than "Chesscito's bosque you can touch."

The CandyCard primitive (M2) standardized residential content blocks. But the 4 active CTAs (`mini-arena-bridge-slot`, `daily-tactic-card`, `coach-paywall`, `action-pin tone="claim"`) are pressable — incompatible with CandyCard's presentational-only contract (DESIGN_SYSTEM §15). M3 audit (2026-05-09) confirmed there is no clean migration path for these CTAs into CandyCard.

This spec defines the **diegetic UI vocabulary** — a sibling family of primitives where each control is a **physical object in the scene** (stone, wood, treasure, gem, primary action button) — and unblocks M3.5 implementation.

## Goal

Define a 5-primitive scene-rooted UI vocabulary (`<StonePedestal>`, `<TreasureTile>`, `<PrincipalButton>`, `<WoodBanner>`, `<GemPill>`) with stable contracts, asset slots, and migration mapping for the 4 CTA surfaces, so that subsequent sessions can implement and migrate without ambiguity.

## Non-goals

- Implementation of the primitives (separate session, TDD).
- Migration of the 4 CTA surfaces (separate sessions, post-implementation).
- "Mint your Moment" feature (separate spec, future).
- Paywall visual refresh beyond defining `<TreasureTile>` contract (separate spec, future).
- Leaderboard / Trophies / Coach surface redesigns to scene-rooted vocabulary (future, after vocabulary lands).
- Asset finalization — current assets are working drafts, swappable without breaking primitives.

## Asset Versioning Policy

Per user decision (2026-05-09): assets in `design/new-assets-chesscito/` are **current iteration, NOT final**. Each primitive references its asset via a CSS variable (e.g., `--stone-pedestal-bg-{n}`, `--treasure-chest-bg-{size}`). Swapping the asset = updating the CSS var; no primitive contract change required.

Tests assert on data attributes (`data-component`, `data-variant`) and slot composition, NOT on asset filenames. This policy unblocks implementation without final-art readiness. Each migrated surface will document in DESIGN_SYSTEM §16 a "current asset / final asset pending" line so the visual debt is visible during polish sweeps.

## Asset inventory (2026-05-09)

| Asset file | Maps to | Status |
|---|---|---|
| `piedra1.png` … `piedra10.png` | `<StonePedestal stone={1..10}>` | ✅ Available |
| `wood-banner-blank-short.png` | `<WoodBanner size="short">` | ✅ Available |
| `wood-banner-blank-medium.png` | `<WoodBanner size="medium">` | ✅ Available |
| `wood-banner-blank-large.png` | `<WoodBanner size="large">` | ✅ Available |
| `treasure-chest-small.png` | `<TreasureTile size="small">` | ✅ Available |
| `treasure-chest-large.png` | `<TreasureTile size="large">` | ✅ Available |
| `gem-pill-base.png` | `<GemPill>` | ✅ Available |
| `principalbutton.png` | `<PrincipalButton>` | ✅ Available (existing pre-2026-05-09) |

All assets are 1× resolution PNG. Per Asset Versioning Policy, finalized art (resolution variants, WebP, color tonings) may be swapped post-implementation.

## CSS variable convention

All primitive backgrounds reference CSS vars defined in `apps/web/src/app/globals.css`. Naming: `--{primitive-kebab}-bg-{variant}`.

```css
/* globals.css — to be added in implementation session */
:root {
  --stone-pedestal-bg-1: url('/art/scene-rooted/piedra1.png');
  --stone-pedestal-bg-2: url('/art/scene-rooted/piedra2.png');
  /* … 3-10 */
  --treasure-chest-bg-small: url('/art/scene-rooted/treasure-chest-small.png');
  --treasure-chest-bg-large: url('/art/scene-rooted/treasure-chest-large.png');
  --principal-button-bg: url('/art/scene-rooted/principalbutton.png');
  --wood-banner-bg-short: url('/art/scene-rooted/wood-banner-blank-short.png');
  --wood-banner-bg-medium: url('/art/scene-rooted/wood-banner-blank-medium.png');
  --wood-banner-bg-large: url('/art/scene-rooted/wood-banner-blank-large.png');
  --gem-pill-bg: url('/art/scene-rooted/gem-pill-base.png');
}
```

Assets must be copied from `design/new-assets-chesscito/` to `apps/web/public/art/scene-rooted/` during the implementation session (build pipeline does not transitively serve `design/`).

## Asset performance budget

| Primitive | Asset | Per-instance budget |
|---|---|---|
| `<StonePedestal>` | piedra*.png | ≤ 12 KB/asset; lazy-render off-screen instances |
| `<TreasureTile>` | treasure-chest-*.png | ≤ 24 KB/asset |
| `<PrincipalButton>` | principalbutton.png | ≤ 16 KB |
| `<WoodBanner>` | wood-banner-blank-*.png | ≤ 16 KB/asset |
| `<GemPill>` | gem-pill-base.png | ≤ 8 KB |

Implementation session must verify asset sizes pre-deploy. If any asset exceeds budget, request WebP fallback or smaller resolution from asset pipeline.

## Contracts (SDD)

### `<StonePedestal>` — Round tap target, icon on stone

```ts
export type StonePedestalSize = "small" | "medium" | "large"; // 40 | 48 | 64 px
export type StonePedestalStone = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type StonePedestalProps = {
  /** Composable icon rendered centered on the stone. Typically <CandyIcon>. */
  icon: ReactNode;
  /** Which piedra asset to use (1–10). Defaults to 2. */
  stone?: StonePedestalStone;
  size?: StonePedestalSize; // default "medium"
  /** Absolute-positioned slot, top-right corner. E.g., streak counter. */
  badge?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  "aria-label": string; // required at type level
};
```

### `<TreasureTile>` — Chest with value composition

```ts
export type TreasureTileSize = "small" | "large";
export type TreasureTileRibbon = "BEST" | "NEW" | "SALE";

export type TreasureTileProps = {
  size: TreasureTileSize;
  /** Visual representation of value. E.g., 5 coin icons stacked. */
  iconStack: ReactNode;
  /** Small confirmation label, typically price ("$0.05"). */
  valueChip?: ReactNode;
  /** Optional ribbon sticker. Enum prevents arbitrary copy. */
  ribbon?: TreasureTileRibbon;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  "aria-label": string;
};
```

### `<PrincipalButton>` — Primary action button (uses `principalbutton.png`)

```ts
export type PrincipalButtonSize = "medium" | "large";

export type PrincipalButtonProps = {
  children: ReactNode; // verb: "Play", "Save my Moment", "Continue"
  size?: PrincipalButtonSize; // default "medium"
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  /** Optional leading icon, e.g., a play arrow. */
  leadingIcon?: ReactNode;
  "aria-label"?: string; // optional; falls back to children if textual
};
```

### `<WoodBanner>` — Presentational title/state ribbon

```ts
export type WoodBannerSize = "short" | "medium" | "large";

export type WoodBannerProps = {
  size: WoodBannerSize;
  children: ReactNode; // text content, single-line preferred
  /** Optional accessory in corner (small icon/chip). */
  accessory?: ReactNode;
  /** When true, renders as <h2>; otherwise <div role="presentation">. Default false. */
  asTitle?: boolean;
};
```

### `<GemPill>` — Metric pill (split into 2 sibling variants)

Per red-team P1: split dual-mode into 2 explicit primitives (`GemBadge` for presentational, `GemButton` for pressable). Eliminates ambiguity at usage site.

```ts
export type GemBadgeProps = {
  /** Composable icon, typically a gem or coin. */
  icon: ReactNode;
  value: ReactNode; // number or short text
};

export type GemButtonProps = {
  icon: ReactNode;
  value: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label": string;
};
```

## Behavior

1. **Press feedback**: `<StonePedestal>`, `<TreasureTile>`, `<PrincipalButton>`, and `<GemButton>` exhibit a `scale(0.96)` + brief `box-shadow` lift on `:active`. CandyCard's press-animation neutralization does NOT apply — these primitives ARE pressable by design.
2. **Stone variation**: When multiple `<StonePedestal>` instances render in the same surface, surface code chooses distinct `stone` values to avoid repetition. Primitive does NOT auto-rotate.
3. **Treasure ribbon**: When `ribbon` enum value is provided, sticker renders absolutely on top-right at `-8px / -8px` offset. Each enum member maps to a fixed sticker visual (out of scope: arbitrary `ReactNode` ribbons).
4. **Wood banner sizing**: The 3 size variants map to the 3 asset files. Text content auto-truncates with ellipsis if exceeding banner content area; exceeding by >25% triggers a dev-time `console.warn` (not in production).
5. **Loading + disabled interaction**: When `loading=true`, primitive shows centered spinner; underlying icon/stack dims to 30% opacity; click is suppressed. When BOTH `loading=true` AND `disabled=true`, `loading` takes precedence visually (spinner shown). Click still suppressed by either flag.
6. **Disabled state**: All pressable primitives render `<button disabled>` with 50% opacity and `cursor: not-allowed`. The DOM element stays a `<button>` (NOT polymorphic to `<div>`); this is an a11y requirement so screen readers announce a disabled control rather than non-interactive content.
7. **`prefers-reduced-motion`**: Primitives respect the OS-level setting. When reduced, `scale` is removed but a `border-color` flash (200ms) is added so users still perceive tap registration. Visual feedback NEVER fully disappears.
8. **a11y**:
   - `<StonePedestal>`, `<TreasureTile>`, `<GemButton>` require `aria-label` (compile-time check via type).
   - `<PrincipalButton>` may infer label from children if textual; otherwise requires `aria-label`.
   - `<WoodBanner asTitle>` uses `<h2>`; otherwise `<div role="presentation">`.
9. **Asset placeholder fallback**: When the CSS var resolves to a missing asset (e.g., dev environment without assets copied yet, or future asset rotation), primitive renders a CSS placeholder (gradient amber/gold + box-shadow). The class `is-placeholder` is applied to the root element to surface this state in audits and visual regression diffs.
10. **Iconography decoupling**: Primitives accept any `ReactNode` for icon slots. They do NOT inspect `icon.type` or check for `<CandyIcon>` specifically. Any composable visual element is permitted.

## Edge cases

- **`<StonePedestal>` with very long badge content** — badge max-width = 32px; content like "999+" should be the upper bound by convention.
- **`<TreasureTile loading>` with no `iconStack` defined** — spinner only, no error.
- **`<TreasureTile disabled>` after purchase complete** — primitive's `disabled` is for *unavailable* actions (rate-limited, prerequisites unmet). The post-purchase "claimed" visual (chest closed + lock overlay) is OUT of this primitive — surface composes that state.
- **`<PrincipalButton>` with very long text** — overflow ellipsis at 80% of asset width.
- **Multiple `<GemButton>` in a row** — focus order follows DOM; tab navigation works.
- **`<WoodBanner>` text exceeds asset width by >25%** — `console.warn` in dev; truncates with ellipsis. Surface owner should choose a larger size or shorter copy.
- **Asset still loading on first paint** — primitive renders the CSS placeholder until the asset URL resolves; no flash-of-broken-image.
- **MiniPay WebView constraints** — assets must be PNG with transparency (no GIF, no animated WebP). Confirmed compatible with current asset set.

## Migration mapping

| Surface | Primitive | Notes |
|---|---|---|
| `mini-arena-bridge-slot.tsx` (compact) | `<StonePedestal size="medium" stone={4}>` with trophy icon | Replaces round 48×48 candy-frame-amber pill |
| `mini-arena-bridge-slot.tsx` (non-compact) | DELETE — dead code, no live consumer | Confirmed unused via grep + e2e audit |
| `daily-tactic-card.tsx` (compact) | `<StonePedestal size="medium" stone={2}>` with coach icon + streak `badge` | Replaces round candy-frame-amber pill + absolute streak |
| `daily-tactic-card.tsx` (non-compact) | DELETE — dead code | Confirmed unused via grep |
| `coach-paywall.tsx` 5-pack | `<TreasureTile size="small">` with iconStack=5 coins, valueChip="$0.05" | Replaces candy-frame-amber button |
| `coach-paywall.tsx` 20-pack | `<TreasureTile size="large">` with iconStack=20 coins, ribbon="BEST", valueChip="$0.10" | Replaces candy-frame-gold button |
| `action-pin.tsx` (`tone="claim"`) | `<PrincipalButton size="large">` via composition (action-pin internally renders PrincipalButton when tone="claim") | Preserves all action-pin call sites |

Migration order (by ascending blast radius):
1. `daily-tactic-card.tsx` (compact) — has unit tests, low traffic.
2. `mini-arena-bridge-slot.tsx` (compact) — gated by 12-stars-rook, low traffic.
3. `action-pin.tsx` (composition) — touches multiple call sites but is a wrapper change.
4. `coach-paywall.tsx` — revenue-critical, last. Pre-migration: smoke test on Sepolia.

## Acceptance criteria

- [ ] `<StonePedestal>` renders selected piedra asset + composable icon overlay (icon centered).
- [ ] `<StonePedestal>` exposes `badge` slot rendered absolute top-right.
- [ ] `<StonePedestal>` press animation visible (scale 0.96) and respects `prefers-reduced-motion` (border-color flash fallback).
- [ ] `<StonePedestal>` disabled state preserves `<button>` semantics.
- [ ] `<StonePedestal>` `aria-label` required at TypeScript type level (omitting prop = compile error).
- [ ] `<TreasureTile>` renders chest small/large asset.
- [ ] `<TreasureTile>` `iconStack` slot renders inside chest content area.
- [ ] `<TreasureTile>` `ribbon` enum renders the correct sticker visual; arbitrary `ReactNode` ribbons rejected at type level.
- [ ] `<TreasureTile>` `loading` shows spinner overlay; `disabled` muted; both → loading visual takes precedence.
- [ ] `<PrincipalButton>` renders principalbutton.png + text overlay.
- [ ] `<PrincipalButton>` press animation visible; respects reduced-motion.
- [ ] `<WoodBanner>` renders correct asset per size; truncates content at >100% asset width with `console.warn` at >125%.
- [ ] `<GemBadge>` and `<GemButton>` are separate exports (split per red-team P1).
- [ ] All pressable primitives have `data-component` and `data-variant` attributes for testability.
- [ ] Asset-missing fallback CSS placeholder renders with `is-placeholder` class on root.
- [ ] Each primitive has at least 1 unit test verifying: render, slot composition, press-animation class, disabled state, aria-label requirement.
- [ ] Each primitive has a manual screenshot baseline saved in `apps/web/e2e/screenshots/scene-rooted/` for visual reference.
- [ ] DESIGN_SYSTEM.md §16 (new section) documents all 5 primitives with usage examples.
- [ ] Asset performance budgets verified pre-deploy.
- [ ] No regressions in 1160/1160 unit tests; new tests are additive.

## Out of scope / future

- "Mint your Moment" feature — daily-tactic share/mint flow extending VictoryNFT pattern. Will reuse `<PrincipalButton>` for the "Save my Moment" CTA when shipped.
- Paywall copy/value-emphasis revisions beyond `<TreasureTile>` migration.
- Leaderboard redesign to scene-rooted style.
- Trophies / Achievements page redesign.
- Stone variation auto-rotation (deferred until repetition is observed in production).
- Sound design — press SFX hooks; integrate with existing `lib/haptics.ts`.
- App-wide audit for non-diegetic chrome (other `<button>` elements). Per red-team P1, this audit is recommended as a follow-up but not blocking for v1.

## Open questions

- Should `<StonePedestal>` accept `tone="amber" | "gold"` to tint the stone (warm vs cool)? Default answer: **NO** for v1 — icon underneath communicates tone. Revisit if surfaces feel ambiguous post-migration.
- Should `<PrincipalButton>` get a 2nd color variant (e.g., gray/secondary)? Default answer: **generate variant assets** if needed, NOT CSS hue-rotate (cross-browser fragile). Defer to migration session.
- Resolution choice for "completed daily-tactic" state — kept out of v1 per red-team P1. Future: separate `<StonePedestal variant="trophy">` that connects to "Mint your Moment". Tracked but not blocking.
