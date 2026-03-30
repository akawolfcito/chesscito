# Phase E2 — Asset Presentation Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate existing asset presentation through CSS treatment — piece rail hero showcase, dock icon unification, and reward surface ceremony — without new assets or motion.

**Architecture:** CSS-only presentation pass building on E1. Hero showcase adds ring + pedestal pseudo-elements to active rail tab. Dock icons get a unified filter pipeline replacing the current neutral tint. Reward surfaces get a reusable showcase class. Background is evaluated conditionally after the other three are implemented.

**Tech Stack:** CSS custom properties, pseudo-elements, globals.css

**Spec:** `docs/superpowers/specs/2026-03-29-phase-e2-asset-presentation-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/src/app/globals.css` | Modify | Hero showcase pseudo-elements, dock icon filter pipeline, reward showcase class |
| `apps/web/src/components/play-hub/result-overlay.tsx` | Modify | Apply reward-icon-showcase to hero reward images |

---

### Task 1: Piece Rail Hero Showcase — Ring + Pedestal

**Files:**
- Modify: `apps/web/src/app/globals.css:1041-1051` (hero-rail-tab.is-active rules)
- Modify: `apps/web/src/app/globals.css:1114-1117` (.piece-hero rule)

- [ ] **Step 1: Add ring frame pseudo-element to active tab**

In `globals.css`, add `::before` rule AFTER the `.hero-rail-tab.is-active` block (after line 1046). The `.hero-rail-tab` already has `position: relative`, so the pseudo-element positions correctly.

```css
/* ── Champion ring frame (Phase E2) ── */
.hero-rail-tab.is-active::before {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: 32px;
  border: 1.5px solid rgba(180, 160, 110, 0.22);
  box-shadow: 0 0 24px rgba(200, 170, 100, 0.10), inset 0 0 24px rgba(200, 170, 100, 0.05);
  pointer-events: none;
  z-index: 0;
}
```

- [ ] **Step 2: Add pedestal glow pseudo-element to active tab**

Add `::after` rule immediately after the `::before` rule:

```css
/* ── Champion pedestal glow (Phase E2) ── */
.hero-rail-tab.is-active::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 10%;
  right: 10%;
  height: 35%;
  background: radial-gradient(ellipse at 50% 85%, rgba(200, 170, 100, 0.25) 0%, transparent 70%);
  pointer-events: none;
  z-index: 0;
  border-radius: 0 0 28px 28px;
}
```

- [ ] **Step 3: Ensure active :active state resets pseudo-element context**

The existing `.hero-rail-tab.is-active:active` rule (line 1048) uses `transform: scale(0.97)` which will naturally scale the pseudo-elements too. No change needed — just verify it works.

- [ ] **Step 4: Reinforce piece-hero float shadow**

In `.piece-hero` (line 1114), update the drop-shadow:

```css
/* Before */
.piece-hero {
  filter: var(--treat-warm-tint) drop-shadow(0 2px 6px rgba(0, 0, 0, 0.5));
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow);
}

/* After */
.piece-hero {
  filter: var(--treat-warm-tint) drop-shadow(0 3px 8px rgba(0, 0, 0, 0.6));
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-warm-glow);
}
```

- [ ] **Step 5: Visual verification — QA checklist**

Run: `cd apps/web && pnpm dev`

Open `http://localhost:3000/play-hub` in 390px viewport.

QA checklist:
1. Active piece tab shows a subtle golden ring around it
2. Active piece tab shows a warm glow at the base (pedestal)
3. The piece image appears to float with a deeper shadow
4. **No clipping** — ring does not get cut off by rail container overflow
5. **No collision with label** — pedestal does not overlap the piece name label ("ROOK", etc.)
6. **No crowding** — ring does not visually collide with neighboring inactive tabs
7. Active tab still reads clearly below board authority at first glance
8. Press feedback (scale 0.97) works correctly with pseudo-elements
9. Champion switch transition (250ms) still feels smooth

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style: piece rail hero showcase — ring + pedestal (Phase E2)

Wolfcito 🐾 @akawolfcito"
```

---

### Task 2: Dock Icon Hybrid Unification

**Files:**
- Modify: `apps/web/src/app/globals.css:1141-1156` (dock-treat-base/active/pressed rules)
- Modify: `apps/web/src/app/globals.css:60-61` (treat-neutral-tint token)

- [ ] **Step 1: Create two treatment variants as CSS custom properties**

In the `:root` section of globals.css (around line 60-61), add two new tokens AFTER the existing `--treat-neutral-tint` tokens:

```css
    --treat-neutral-tint: brightness(0.75) saturate(0.7);
    --treat-neutral-tint-active: brightness(1.0) saturate(0.85);
    /* Dock icon unification (Phase E2) — two variants for A/B review */
    --dock-treat-neutral: brightness(0.85) saturate(0.9) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
    --dock-treat-warm: sepia(0.15) brightness(0.85) saturate(1.0) drop-shadow(0 1px 3px rgba(0, 0, 0, 0.4));
```

- [ ] **Step 2: Update dock-treat-base to use the warm variant as starting point**

In `.dock-treat-base` (line 1141), change:

```css
/* Before */
.dock-treat-base {
  filter: var(--treat-neutral-tint);
  box-shadow: var(--treat-carved-lo);
}

/* After */
.dock-treat-base {
  filter: var(--dock-treat-warm);
  box-shadow: var(--treat-carved-lo);
}
```

- [ ] **Step 3: Visual verification — compare both variants**

Open `http://localhost:3000/play-hub` in 390px viewport.

Check the dock icons with `--dock-treat-warm` (current):
1. Do all 4 dock icons feel like one visual family?
2. Does the wolf mage (play-menu) still feel memorable? (Note: play-menu.png is NOT currently used — if the dock doesn't show a wolf mage, skip this check)
3. Does sepia(0.15) muddy any blue/gem-heavy icons?
4. Do the icons look washed out or natural?

If sepia muddies the icons, switch to the neutral variant by changing `.dock-treat-base` to use `var(--dock-treat-neutral)` instead. The goal is consistent perceived weight without color degradation.

- [ ] **Step 4: Update dock-treat-active to match chosen variant**

```css
/* Before */
.dock-treat-active {
  filter: var(--treat-neutral-tint-active);
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-depth-outer);
}

/* After — warm variant */
.dock-treat-active {
  filter: sepia(0.10) brightness(1.0) saturate(1.15) drop-shadow(0 1px 4px rgba(0, 0, 0, 0.5));
  box-shadow: var(--treat-carved-hi), var(--treat-carved-lo), var(--treat-depth-outer);
}
```

If using neutral variant instead, use:
```css
  filter: brightness(1.0) saturate(1.05) drop-shadow(0 1px 4px rgba(0, 0, 0, 0.5));
```

- [ ] **Step 5: Leave dock-treat-pressed unchanged**

The pressed state (`brightness(0.65) saturate(0.6)`) is a feedback state, not an identity treatment. No change needed.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style: dock icon hybrid unification treatment (Phase E2)

Wolfcito 🐾 @akawolfcito"
```

---

### Task 3: Reward Surface Ceremony

**Files:**
- Modify: `apps/web/src/app/globals.css` (add new reward-icon-showcase class)
- Modify: `apps/web/src/components/play-hub/result-overlay.tsx:64-75` (apply showcase to reward hero)

- [ ] **Step 1: Add reward-icon-showcase class in globals.css**

Add after the existing reward glow rules (search for `reward-glow-achievement` to find the location):

```css
/* ── Reward icon showcase treatment (Phase E2) ── */
.reward-icon-showcase {
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
}

.reward-icon-showcase::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 15%;
  right: 15%;
  height: 20%;
  background: radial-gradient(ellipse at 50% 90%, rgba(255, 255, 255, 0.06) 0%, transparent 60%);
  pointer-events: none;
  border-radius: 50%;
}
```

- [ ] **Step 2: Apply showcase to result-overlay hero image**

In `result-overlay.tsx`, find the `SuccessImage` function (around line 64). The `<picture>` element that renders the hero reward image currently has class `reward-burst relative z-10`. Update the parent container to include the showcase:

```tsx
/* Before */
<div className={`relative flex items-center justify-center ${glowClass ?? "reward-glow-progress"}`}>
  <picture className="reward-burst relative z-10">

/* After */
<div className={`relative flex items-center justify-center ${glowClass ?? "reward-glow-progress"}`}>
  <picture className="reward-icon-showcase reward-burst relative z-10">
```

Note: `.reward-icon-showcase` is applied to the `<picture>` element (the asset host), not to the outer glow container. The `::after` pedestal on `<picture>` needs `position: relative` — check if `relative` is already present via the `relative` Tailwind class. It is (`relative z-10`), so the pseudo-element will position correctly.

- [ ] **Step 3: Visual verification**

Open `http://localhost:3000/play-hub`, complete an exercise to trigger a result overlay.

Verify:
1. The reward hero image has a stronger drop shadow (floats more)
2. A subtle light pedestal appears below the image
3. The reward treatment is clearly LESS ceremonious than the piece rail champion (no ring)
4. The treatment works with both teal (progress) and amber (achievement) glow backdrops
5. The existing `drop-shadow-lg` Tailwind class on the `<img>` inside may conflict — if double shadow appears, remove `drop-shadow-lg` from the `<img>` className

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/components/play-hub/result-overlay.tsx
git commit -m "style: reward surface ceremony treatment (Phase E2)

Wolfcito 🐾 @akawolfcito"
```

---

### Task 4: Integration Review + Background Evaluation

**Files:**
- None new unless background treatment is needed

- [ ] **Step 1: Full composition review**

Open `http://localhost:3000/play-hub` in 390px viewport.

Review against spec success criteria:
1. Active piece in rail reads as a champion with ceremony (ring + pedestal + glow)
2. Dock icons feel like one visual family despite different illustration styles
3. Reward assets feel premium when presented as heroes
4. No element competes with the board for visual authority
5. Overall Play Hub identity feels more distinctive and memorable
6. No new assets were required for the E2 baseline

- [ ] **Step 2: Background evaluation**

With Sections 1-3 in place, evaluate the background:
- Does `bg-chesscitov3` still feel like "dark ambient texture" that supports the scene?
- Or does it feel like the weak link now that pieces, dock, and rewards are elevated?

**If background works** → no action needed, skip to Step 4.

**If background needs tuning** → apply in this order, stop when gap closes:

1. Check `background-position` — is the most relevant part of the asset visible under the vignette?
2. Check `background-size` — does it cover optimally at 390px?
3. Only if still needed: add subtle `brightness()` or `saturate()` tuning to the background container

Rule: background refinement is allowed only if it improves scene identity without pulling attention from the board.

- [ ] **Step 3: Run build check**

```bash
cd apps/web && pnpm build
```

Expected: successful build with no errors.

- [ ] **Step 4: Run e2e tests**

```bash
cd apps/web && pnpm exec playwright test e2e/
```

Expected: all tests pass.

- [ ] **Step 5: Update visual snapshots**

```bash
cd apps/web && pnpm exec playwright test e2e/visual-snapshot.spec.ts --update-snapshots
```

- [ ] **Step 6: Commit snapshots if updated**

```bash
git add apps/web/e2e/
git commit -m "test: update visual snapshots for Phase E2

Wolfcito 🐾 @akawolfcito"
```
