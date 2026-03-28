# Chesscito Premium Visual Layer — Design Spec

**Date:** 2026-03-28
**Status:** Approved
**Scope:** Background system, material tiers, CTA prominence, piece/icon treatments, FX rules, reward presentation, secondary screen cohesion

## Objective

Define the coordinated visual direction layer that transforms Chesscito from a stable prototype with polish into a deliberate, premium, emotionally strong game product. Target: Clash Royale level of visual presence — extracted as principles, not literal imitation.

---

## 1. Visual Target & Product Identity

### Principles (extracted from Clash Royale)

- **Depth** — the user feels *inside* a world, not looking at an interface
- **Presence** — every surface has weight, materiality, intention
- **Tactile premium** — panels feel constructed, not floating
- **Emotional payoff** — victories are celebrated; failure states feel clear, restrained, and dignified

### Chesscito's own identity (boundaries)

- Elegant, not noisy
- Magical, not medieval
- Readable, not decorative
- Mobile-first (390px, MiniPay WebView)
- Premium game-learning product

### Three pillars in implementation order

1. **Depth & Atmosphere** — background system + atmospheric overlays
2. **Surface Richness** — tiered material system
3. **Reward Spectacle** — rules defined now, major implementation deferred

---

## 2. Background System

**Model:** Context-driven backgrounds (base layer) + layered atmospheric overlays (depth layers).

### Base layer — one background per major context

| Context | Background asset | Status |
|---------|-----------------|--------|
| Play Hub | `bg-chesscitov3` | Exists |
| Arena | `bg-chesscitov3` (shared) | Exists |
| Leaderboard sheet | `leaderboard-hall-chesscito` | Exists |
| Shop sheet | `shop-magic-chesscito` | Exists |
| Badge sheet | `bg-badges-chesscito` | Exists |
| Splash/intro | `bg-splash-chesscito` | Exists |

No new assets needed for the base layer. Arena may use a distinct atmospheric preset if the mood needs to differ, but shares the base asset with Play Hub.

### Atmospheric overlay system — 3 CSS layers over the base

| Layer | Purpose | Implementation | Performance |
|-------|---------|----------------|-------------|
| **Vignette** | Darkens edges, draws eye to center | CSS `radial-gradient`, `pointer-events: none` | Zero cost |
| **Light falloff** | Top-to-bottom gradient simulating directional light | CSS `linear-gradient` | Zero cost |
| **Ambient haze** | Subtle depth fog near bottom | CSS `linear-gradient` to `rgba(6,14,28,0.3)` | Zero cost |

### CSS architecture

One reusable class `.atmosphere` applied to background containers. Layers implemented via `::before` (vignette) and `::after` (light falloff + haze).

### Rules

1. Atmospheric overlays must never reduce board clarity, text contrast, or CTA legibility.
2. No particles in this phase. Depth comes purely from CSS gradient overlays.
3. No state-reactive backgrounds in this phase. The background defines place, not state.
4. Max 2 atmospheric overlays per major surface.

---

## 3. Tiered Material System

3 panel tiers as reusable CSS classes. Surface richness comes from material structure — light falloff, border definition, carved depth, hierarchy — not from decorative texture overlays.

### `panel-base` — secondary containers, support surfaces

- Background: subtle top-to-bottom gradient (`rgba(12,20,35,0.50)` to `rgba(6,14,28,0.40)`)
- Border: `1px solid var(--shell-border)`
- Border-radius: `var(--shell-radius)`
- Box-shadow: `var(--treat-carved-lo)` only
- Use cases: stats rows, exercise items, leaderboard rows, secondary cards

### `panel-elevated` — primary interactive modules

- Background: stronger gradient (`rgba(12,20,35,0.65)` to `rgba(6,14,28,0.55)`)
- Border: `1px solid rgba(255,255,255,0.08)` (brighter than shell-border)
- Border-radius: `var(--shell-radius)`
- Box-shadow: `var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-depth-outer)`
- Light rim: `inset 0 1px 0 rgba(255,255,255,0.06)` (top edge highlight)
- Use cases: GameplayPanel, mission briefing card, badge cards (claimable), shop featured item

### `panel-showcase` — rewards, celebratory surfaces, high-emphasis modals

- Background: richer gradient (`rgba(14,22,38,0.80)` to `rgba(6,14,28,0.70)`)
- Border: `1px solid rgba(255,255,255,0.10)` (most visible)
- Border-radius: `var(--shell-radius)`
- Box-shadow: `var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-depth-outer)`
- Light rim: `inset 0 1px 0 rgba(255,255,255,0.08)` (stronger top edge)
- Contextual glow: optional and sparse, not default. Applied only when the surface is the single dominant showcase element in the viewport.
- Use cases: result overlay card, victory celebration card, badge earned prompt
- **Boundary:** `panel-showcase` is reserved for modal, reward, or high-emphasis moments — never for routine browsing surfaces

### Rules

1. No panel in the app should have ad-hoc styling outside this tier system. If a surface exists, it uses one of the 3 tiers.
2. Glow must never become the primary source of hierarchy. Hierarchy comes from gradient weight, border definition, and carved depth.
3. Only one showcase surface should dominate a viewport at a time.
4. Reserved class alignment: `frame-structural` maps to `panel-base`, `frame-showcase` maps to `panel-showcase`.

---

## 4. CTA Prominence Rules

### 3-tier CTA system

| Tier | Visual treatment | Use case |
|------|-----------------|----------|
| **Primary** | Gradient fill + glow shadow + `h-[52px]` + strongest label treatment | Action slot CTAs (submitScore, claimBadge, connectWallet) |
| **Secondary** | Bordered, transparent bg + subtle fill on press | Retry, "Play Again", sheet confirm actions |
| **Ghost** | Text-only, no border, no fill, subtle opacity | "Back to Hub", "Later", dismiss actions |

### Approved semantic action color map

| Function | Color | Examples |
|----------|-------|----------|
| Progress action | Cyan | Submit score, connect wallet |
| Resource action | Amber | Use shield, shop purchase, switch network |
| Achievement action | Purple | Claim badge |
| Success confirmation | Emerald | Victory confirm |

Do not introduce new CTA colors outside this approved map.

### Rules

1. One primary CTA per viewport at a time. No two gradient-fill buttons visible simultaneously.
2. Primary CTAs use the strongest label treatment in the system. Uppercase is allowed only where it preserves readability and matches product voice.
3. Secondary CTAs never use gradient fills — they must be visually subordinate.
4. Ghost CTAs: opacity <= 0.7, no glow, no border. Must not compete for attention.
5. A ghost CTA cannot sit directly adjacent to a primary CTA if both invite immediate action.
6. In sheets (leaderboard, badges, shop), CTAs follow the same tier rules — no sheet invents its own button style outside this system.

---

## 5. Piece & Icon Treatment Rules

**Boundary:** This spec does not replace piece art or icon art. It systematizes the CSS treatment layer on existing assets.

### Piece treatments (hero selector rail)

- `piece-hero`: warm golden tint + carved depth. Keep current treatment.
- `piece-inactive`: desaturated, low carved depth. Keep current treatment.
- `piece-pressed`: activate as interaction feedback — scale(0.92) + deeper carved shadow on tap. 120ms transition.
- Board pieces (`playhub-board-piece-img`): cyan drop-shadow treatment. Keep current.
- Arena pieces: white=warm / black=purple-tint. Keep current. Piece tinting must preserve instant white/black recognition at first glance.

### Icon treatments (dock, sheets, UI)

- `dock-treat-base`: keep current neutral tint.
- `dock-treat-active`: activate for current-route dock item. Should feel slightly brighter, warmer, and more resolved than `dock-treat-base`. Exact filter values tuned during implementation review.
- `dock-treat-pressed`: activate as press feedback — scale(0.92) + brightness dip. 120ms transition.
- Sheet trigger icons: use `dock-treat-base` consistently. No ad-hoc filter chains.
- Lucide icons (Star, Timer, Shield, etc.): no filter treatment. They follow text color and opacity rules only. Never apply image filters to vector icons.

### Timing consistency rule

Pressed feedback timing (120ms, scale 0.92) should be consistent across pieces, dock icons, and buttons unless a strong reason exists for deviation.

---

## 6. FX Rules — Allowed & Forbidden

### Allowed FX

| Effect | Where | Constraint |
|--------|-------|-----------|
| CSS gradient overlays | Atmospheric system, panel backgrounds | Max 2 atmospheric overlays per major surface |
| Inset shadows (carved) | Panel tiers, piece/icon frames | Only via `--treat-carved-*` tokens |
| Outer shadows (depth) | `panel-elevated`, `panel-showcase` | Only via `--treat-depth-outer` token |
| Glow shadows | `panel-showcase` only, CTA primary tier | Contextual color, optional not default, max 1 showcase glow per viewport. Glow cannot compensate for weak hierarchy, spacing, or material contrast. |
| Scale transitions | Press feedback (pieces, dock, buttons) | Max 0.92 scale, 120ms duration |
| Opacity transitions | State changes (active/inactive) | Max 200ms duration |
| Lottie animations | Existing: sparkle-burst (success), error-alert | Only in overlay/modal context, never inline |
| CSS keyframe animations | Target pulse, reward burst, typewriter | Must respect `prefers-reduced-motion` |

### Forbidden FX

| Effect | Why |
|--------|-----|
| CSS particles / floating elements | Performance risk in MiniPay WebView |
| `backdrop-filter: blur()` on moving elements | GPU cost, WebView jank risk |
| Parallax scroll effects | No scroll contexts in 390px mobile layout |
| Continuous looping glow/pulse on non-interactive elements | Visual noise, battery drain |
| `box-shadow` spread > 20px | Render cost, visual muddiness |
| Filter chains > 3 functions | Performance degradation |
| Transform animations > 400ms | Feels sluggish on mobile |
| Auto-playing Lottie in non-overlay contexts | Battery drain, distraction from gameplay |

### Performance boundary for MiniPay WebView

- Effects must avoid layout-triggering animation paths. Prefer compositor-friendly properties only: `opacity` and `transform`.
- All atmospheric overlays must be `pointer-events: none` and `position: absolute` (compositor layer).
- Never animate `width`, `height`, `top`, `left`, `margin`, or `padding`.

### Lottie rule

Lottie must never be required to understand success, failure, or progression. Remove Lottie and the state must still be readable from text + icon + color alone.

### `prefers-reduced-motion` rule

All keyframe animations and scale transitions must be disabled when `prefers-reduced-motion: reduce` is active. Glow shadows and gradient overlays are exempt (they are not motion).

---

## 7. Reward / Badge / Trophy Presentation Language

**Principle:** Celebration amplifies an already-premium world. It does not compensate for flatness.

### Celebration intensity hierarchy

| Context | Intensity | Spec direction |
|---------|-----------|----------------|
| Play Hub exercise success | Low-medium | Define rules, defer major changes |
| Play Hub badge earned | Medium | Define rules, defer major changes |
| Arena victory | High | Already premium — maintain |
| Arena NFT minted | Highest | Already premium — maintain |
| Arena defeat | Low | Already correct — dignified, restrained |

### Reward presentation rules

1. Success overlays use `panel-showcase` tier for their card surface.
2. Reward images (badge, score, trophy) get a glow backdrop — contextual color (teal=progress, amber=achievement, emerald=victory), not white.
3. Stars reveal should be staggered — future implementation detail, not a blocker.
4. Failure states: no glow, no sparkles, no celebratory FX. Rose-tinted text, `panel-elevated` surface. Defeat feels acknowledged, not punished or noisy.
5. Lottie is supplementary — remove it and the state must still be readable.
6. Arena celebration intensity must always exceed Play Hub celebration intensity.
7. Do not mix multiple emotional color codes in a single celebration moment unless there is a clear product reason.

### Badge presentation rules

- Claimed: `badge-treat-owned` (warm golden). Badge card uses `panel-elevated` or `panel-showcase` if featured.
- Claimable: `badge-treat-claimable` (semi-warm). Badge card uses `panel-elevated`.
- Locked: `badge-treat-locked` (grayscale). Badge card uses `panel-base`.
- Badge state and panel tier must not contradict each other. Locked must never feel more heroic than claimable or earned.

---

## 8. Secondary Screen Cohesion

**Scope:** Token alignment and panel-tier adoption. Not full visual re-architecture.

### What changes now

| Element | Current | After |
|---------|---------|-------|
| Leaderboard rows | `border-white/[0.08] bg-white/[0.04]` ad-hoc | `panel-base` |
| Badge cards | Inline gradient + border per state | `panel-base` / `panel-elevated` by state |
| Shop featured item | Inline gold gradient + border | `panel-elevated` |
| Shop regular items | `border-white/[0.05] bg-white/[0.02]` | `panel-base` |
| Sheet headers | Inconsistent padding/borders | `--shell-border`, aligned padding |
| Sheet CTAs | Per-sheet button styles | CTA tier system (Section 4) |

### What stays the same

- Sheet-specific background images — each sheet keeps its scene identity
- Overall sheet layouts (bottom sheet pattern, header/content/footer)
- Sheet open/close animations

### Rules

1. Every surface inside a sheet must use one of the 3 panel tiers. No ad-hoc inline styling for containers.
2. Sheet borders and dividers use `--shell-border` and `--shell-divider` tokens.
3. Sheet border-radius uses `--shell-radius` for cards and rows.
4. Sheet CTAs follow the CTA tier system.
5. Sheet headers adopt consistent spacing aligned with the `mx-2` column logic.
6. Secondary sheets may preserve scene identity, but they must not introduce a competing material language.

---

## 9. Implementation Sequence

### Phase A — Depth & Atmosphere

1. Define `.atmosphere` overlay system in `globals.css`
2. Apply to Play Hub background container
3. Apply to Arena with appropriate atmospheric preset
4. Verify overlays don't reduce board clarity, text contrast, or CTA legibility
5. **Gate: mobile visual review under MiniPay WebView conditions**

### Phase B — Surface Richness

1. Define `panel-base`, `panel-elevated`, `panel-showcase` in `globals.css`
2. Adopt `panel-elevated` on GameplayPanel
3. Adopt `panel-showcase` on ResultOverlay card
4. Activate reserved treatment classes (`piece-pressed`, `dock-treat-active`, `dock-treat-pressed`)
5. Apply `panel-base` to Play Hub secondary containers only; sheet-wide adoption belongs to Phase C
6. **Gate: mobile visual review under MiniPay WebView conditions**

### Phase C — Secondary Screen Cohesion

1. Leaderboard rows to `panel-base`
2. Badge cards to `panel-base` / `panel-elevated` by state
3. Shop items to `panel-base` / `panel-elevated`
4. Sheet headers and CTAs to token + tier alignment
5. Verify all sheets feel family-consistent
6. **Gate: mobile visual review under MiniPay WebView conditions**

### Phase D — Reward Spectacle (deferred implementation)

- Rules defined in this spec (Section 7)
- Arena celebration: maintain as-is
- Play Hub celebration: future enhancement pass after A+B+C ship
- Implement only after the world and material system feel premium

**Each phase is independently shippable, visually verifiable, and gated by MiniPay review.**

### Visual rollback rule

If a phase increases richness but reduces clarity, hierarchy, or MiniPay performance, revert to the simpler treatment and re-tune before proceeding.
