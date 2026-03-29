# Phase D — Reward Spectacle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate Play Hub reward moments with contextual CSS glow backdrops and staggered star reveals, differentiating badge earned from exercise success while keeping Arena unchanged.

**Architecture:** CSS-only glow system (`.reward-glow-progress`, `.reward-glow-achievement`) added to `globals.css`. Staggered star reveal via `@keyframes star-reveal` with per-star `animation-delay`. `BadgeEarnedPrompt` already uses `panel-showcase`; add achievement glow + single pulse. All animations respect `prefers-reduced-motion`.

**Tech Stack:** CSS keyframes, Tailwind utility classes, React inline style for `animation-delay`

**Spec:** `docs/superpowers/specs/2026-03-29-phase-d-reward-spectacle-design.md`

---

### Task 1: Define reward glow CSS classes

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: Add `.reward-glow-progress` and `.reward-glow-achievement` classes**

Add after the existing `.reward-burst` block (around line 258):

```css
/* ═══════════════════════════════════════════════════
   Reward Glow Backdrops — Phase D
   ═══════════════════════════════════════════════════ */

.reward-glow-progress,
.reward-glow-achievement {
  position: relative;
}

.reward-glow-progress::before,
.reward-glow-achievement::before {
  content: "";
  position: absolute;
  inset: -32px;
  border-radius: 9999px;
  pointer-events: none;
  z-index: 0;
}

.reward-glow-progress::before {
  background: radial-gradient(
    circle,
    rgba(20, 184, 166, 0.18) 0%,
    rgba(20, 184, 166, 0.06) 50%,
    transparent 70%
  );
}

.reward-glow-achievement::before {
  background: radial-gradient(
    circle,
    rgba(245, 158, 11, 0.18) 0%,
    rgba(245, 158, 11, 0.06) 50%,
    transparent 70%
  );
}
```

- [ ] **Step 2: Add `@keyframes glow-pulse-once`**

Add immediately after the glow classes:

```css
@keyframes glow-pulse-once {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}

.reward-glow-achievement.reward-glow-pulse::before {
  animation: glow-pulse-once 600ms ease-in-out 1;
}
```

- [ ] **Step 3: Add `@keyframes star-reveal`**

Add immediately after:

```css
@keyframes star-reveal {
  from {
    opacity: 0;
    transform: scale(0.8);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}
```

- [ ] **Step 4: Add `prefers-reduced-motion` rules for Phase D animations**

Add inside the existing `@media (prefers-reduced-motion: reduce)` block at the end of the file (before the closing `}`):

```css
  .reward-glow-achievement.reward-glow-pulse::before {
    animation: none !important;
  }
  .star-reveal-animated {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
```

- [ ] **Step 5: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/app/globals.css
git commit -m "style: add reward glow backdrops and star-reveal keyframes (Phase D)"
```

---

### Task 2: Apply contextual glow to SuccessImage

**Files:**
- Modify: `apps/web/src/components/play-hub/result-overlay.tsx:64-77`

- [ ] **Step 1: Update `SuccessImage` to accept a `glowClass` prop and replace the image-based glow**

Replace the entire `SuccessImage` function:

```tsx
function SuccessImage({ variant, pieceType, glowClass }: { variant: SuccessVariant; pieceType?: PieceKey; glowClass?: string }) {
  const src = variant === "badge" ? getBadgeImg(pieceType) : VARIANT_IMG[variant];
  return (
    <div className={`relative flex items-center justify-center ${glowClass ?? "reward-glow-progress"}`}>
      <picture className="reward-burst relative z-10">
        <source srcSet={src.replace(".png", ".avif")} type="image/avif" />
        <source srcSet={src.replace(".png", ".webp")} type="image/webp" />
        <img src={src} alt="" className="h-32 w-32 object-contain drop-shadow-lg" />
      </picture>
    </div>
  );
}
```

This removes the old `--playhub-reward-glow` image div and uses the CSS glow pseudo-element instead.

- [ ] **Step 2: Pass `glowClass` in `ResultOverlay`**

In the `ResultOverlay` component, update the `SuccessImage` call (line ~188):

Replace:
```tsx
          <SuccessImage variant={variant} pieceType={pieceType} />
```

With:
```tsx
          <SuccessImage variant={variant} pieceType={pieceType} glowClass="reward-glow-progress" />
```

- [ ] **Step 3: Pass `glowClass` in `BadgeEarnedPrompt`**

In the `BadgeEarnedPrompt` component, update the `SuccessImage` call (line ~306):

Replace:
```tsx
        <SuccessImage variant="badge" pieceType={pieceType} />
```

With:
```tsx
        <SuccessImage variant="badge" pieceType={pieceType} glowClass="reward-glow-achievement reward-glow-pulse" />
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Run visual snapshots and review**

Run: `cd apps/web && pnpm test:e2e:visual`
Expected: 7/7 passing. Review `e2e-results/snapshots/play-hub.png` to confirm no visual regressions.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/play-hub/result-overlay.tsx
git commit -m "style: apply contextual glow backdrops to reward overlays (Phase D)"
```

---

### Task 3: Implement staggered star reveal

**Files:**
- Modify: `apps/web/src/components/play-hub/result-overlay.tsx:82-100`

- [ ] **Step 1: Replace `StarsRow` with staggered animation**

Replace the entire `StarsRow` function:

```tsx
function StarsRow({ totalStars, staggered = false }: { totalStars: number; staggered?: boolean }) {
  const filled = Math.min(EXERCISES_PER_PIECE, Math.ceil(totalStars / 3));
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: EXERCISES_PER_PIECE }, (_, i) => {
        const isEarned = i < filled;
        return (
          <span
            key={i}
            className={
              isEarned
                ? staggered
                  ? "star-reveal-animated text-amber-400"
                  : "text-amber-400"
                : "text-amber-400/30"
            }
            style={
              isEarned && staggered
                ? {
                    opacity: 0,
                    animation: `star-reveal 250ms ease-out ${200 * i}ms forwards`,
                  }
                : undefined
            }
            aria-hidden="true"
          >
            ★
          </span>
        );
      })}
      <span className="ml-1 text-xs text-cyan-100/70">
        {totalStars}/{MAX_STARS}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Enable stagger in `ResultOverlay`**

In the `ResultOverlay` component, update the `StarsRow` call (around line ~203):

Replace:
```tsx
          <StarsRow totalStars={totalStars} />
```

With:
```tsx
          <StarsRow totalStars={totalStars} staggered />
```

- [ ] **Step 3: Enable stagger in `BadgeEarnedPrompt`**

In `BadgeEarnedPrompt`, update the `StarsRow` call (around line ~308):

Replace:
```tsx
        <StarsRow totalStars={totalStars} />
```

With:
```tsx
        <StarsRow totalStars={totalStars} staggered />
```

- [ ] **Step 4: Verify build**

Run: `cd apps/web && npx next build 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/play-hub/result-overlay.tsx
git commit -m "feat: staggered Gentle Fade star reveal in reward overlays (Phase D)"
```

---

### Task 4: Visual verification and final commit

**Files:**
- None new — verification only

- [ ] **Step 1: Run all e2e tests**

Run: `cd apps/web && npx playwright test --reporter=list`
Expected: All tests pass (ux-review + visual-snapshot specs).

- [ ] **Step 2: Run visual snapshots and review screenshots**

Run: `cd apps/web && pnpm test:e2e:visual`

Review all 7 screenshots in `e2e-results/snapshots/`:
- `play-hub.png` — no regressions
- `sheet-badges.png` — no regressions
- Other pages — no regressions

- [ ] **Step 3: Manual browser check of reward overlays**

Open `http://localhost:3000` in browser, complete an exercise to trigger the result overlay. Verify:
1. Teal glow backdrop appears behind the reward image
2. Stars animate in one by one with Gentle Fade (200ms stagger, 250ms ease-out)
3. Unfilled stars appear static at 30% opacity
4. Overall feel: refined, warm, not noisy

- [ ] **Step 4: Push**

```bash
git push
```
