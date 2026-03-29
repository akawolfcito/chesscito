# Phase D — Reward Spectacle Design Spec

**Date:** 2026-03-29
**Status:** Approved
**Parent spec:** `docs/superpowers/specs/2026-03-28-premium-visual-layer-design.md` (Section 7)
**Scope:** Play Hub celebration upgrades only. Arena unchanged.

## Objective

Elevate Play Hub reward moments to feel proportional to the premium world built in Phases A-C (atmosphere, surface richness, secondary screen cohesion). Celebration amplifies an already-premium world — it does not compensate for flatness.

---

## 1. Contextual Glow Backdrop

Two CSS-only semantic classes in `globals.css`, following the same architecture as panel tiers and treatment classes.

### `.reward-glow-progress` — exercise success

```css
radial-gradient(circle, rgba(20,184,166,0.18) 0%, rgba(20,184,166,0.06) 50%, transparent 70%)
```

Teal = progress. Used for normal exercise completion.

### `.reward-glow-achievement` — badge earned

```css
radial-gradient(circle, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.06) 50%, transparent 70%)
```

Amber = achievement. Used for badge milestone moments.

### Glow layering rules

1. Glow is implemented as a pseudo-element (`::before`), positioned behind all content.
2. Glow must never reduce text contrast or CTA legibility.
3. Glow must not affect hit targets (`pointer-events: none`).
4. Glow remains subordinate to the panel surface — it is decorative support, not the primary source of hierarchy.
5. The glow host surface must establish a local positioning context (`position: relative`) before the glow pseudo-element can be used.
6. Replaces the current `--playhub-reward-glow` image asset with CSS-only radial gradients. Lighter, more coherent with the system.

---

## 2. Staggered Star Reveal — Gentle Fade

### Animation parameters

- Delay between stars: **200ms**
- Transition per star: `opacity 0→1` + `scale 0.8→1`, **250ms ease-out**
- Total for 3 stars: ~850ms
- Motion identity: refined, satisfying, readable, emotionally warm

### Star reveal rules

1. Only **earned** stars animate with the staggered Gentle Fade.
2. Unearned stars appear in subdued static form (`opacity: 0.3`, no animation) after the reveal sequence completes.
3. The staggered star reveal begins only after the overlay surface is visible (post-mount, not during entry animation).
4. `prefers-reduced-motion`: stagger disabled — all stars appear simultaneously with no scale transition. Static glow backdrop remains visible.

### CSS keyframe

```css
@keyframes star-reveal {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
```

Applied with `animation-delay` per star index (200ms × index).

---

## 3. Badge Earned Differentiation

Badge earned is a milestone. It must feel clearly more important than normal exercise success, but still below Arena on the celebration hierarchy.

### Treatment

| Property | Exercise Success | Badge Earned |
|----------|-----------------|--------------|
| Glow | `.reward-glow-progress` (teal) | `.reward-glow-achievement` (amber) |
| Surface | Existing result overlay (no upgrade) | **`panel-showcase`** |
| Pulse | None | 1× glow pulse (non-looping) |
| Stars | Gentle Fade stagger | Gentle Fade stagger |

### Glow pulse

- Keyframe: `scale 1→1.04→1` on the glow pseudo-element
- Duration: 600ms, ease-in-out
- Iterations: **1** (non-looping)
- `prefers-reduced-motion`: pulse disabled. Static glow remains.

```css
@keyframes glow-pulse-once {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.04); }
}
```

### `BadgeEarnedPrompt` surface

- **Definite decision:** `BadgeEarnedPrompt` uses `panel-showcase`.
- This is not optional or conditional.

---

## 4. Celebration Hierarchy (Final)

| Context | Intensity | Glow | Surface | Stars | Extras |
|---------|-----------|------|---------|-------|--------|
| Exercise success | Low-medium | `.reward-glow-progress` (teal) | Existing result overlay (no upgrade) | Gentle Fade stagger | — |
| Badge earned | Medium | `.reward-glow-achievement` (amber) | `panel-showcase` | Gentle Fade stagger | 1× glow pulse |
| Arena victory | High | Emerald halos (unchanged) | Unchanged | N/A | Sparkles lottie |
| Arena NFT mint | Highest | Amber halos (unchanged) | Unchanged | N/A | Share UI |

Arena celebrations are not modified in Phase D.

---

## 5. Files Changed

| File | Changes |
|------|---------|
| `globals.css` | `.reward-glow-progress`, `.reward-glow-achievement`, `@keyframes star-reveal`, `@keyframes glow-pulse-once`, `prefers-reduced-motion` rules |
| `result-overlay.tsx` | Apply glow classes by context, implement staggered star reveal with `animation-delay`, `BadgeEarnedPrompt` adopts `panel-showcase` surface |

---

## 6. Boundaries

1. No fullscreen spectacle.
2. No CSS particles or floating elements.
3. No looping animations on reward elements.
4. Play Hub celebration intensity must always remain below Arena.
5. Glow cannot compensate for weak hierarchy, spacing, or material contrast.
6. If Phase D reduces clarity or MiniPay WebView performance, revert and re-tune.
7. `prefers-reduced-motion` disables stagger and pulse; does NOT remove static glow backdrop.

---

## 7. Accessibility

- All keyframe animations respect `prefers-reduced-motion: reduce`.
- Star states (earned/unearned) must be readable from icon + color alone, without animation.
- Glow is purely decorative — removal must not change information hierarchy.
