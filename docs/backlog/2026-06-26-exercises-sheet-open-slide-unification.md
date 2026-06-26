# Backlog — Exercises sheet residual slide-on-open

**Logged:** 2026-06-26 · **Priority:** P3 (cosmetic, non-blocking)

## Context

Commit `9ab308dd fix(sheets): fade-in aux sheets to kill MiniPay slide jank`
unified aux bottom sheets (badges/leaders/trophies/shop/profile + exercises)
to fade in/out instead of `slide-in-from-bottom`, fixing the MiniPay WebView
bug where sheets stalled mid-slide and never filled the screen.

After the fix, every aux sheet enters/exits with fade **except** the
**EXERCISES path drawer**, which still appears to slide up on open (though it
now fills the screen correctly and closes with fade). The original defect is
resolved; this is the remaining cosmetic inconsistency.

## Hypothesis (unverified)

The residual motion is most likely **not** the sheet transform. The fade
`!important` override reaches the element (close fades, proving the rule
applies), so `animation-name: aux-sheet-fade-in` is active on open too.

The upward motion is probably the **auto-scroll-to-active-node** in
`exercise-drawer.tsx:99-108` (`scrollIntoView({ behavior: 'smooth' })`, 250ms
after open). The path canvas (`aspect-ratio: 1 / totalUnits`) is taller than
the viewport, starts scrolled to top, then smooth-scrolls to center the active
node. The other aux sheets have no tall scrollable canvas, so they don't show
this. If so, the motion is a desirable wayfinding cue, not a bug.

## Next steps (if unification is pursued)

1. Inspect in the MiniPay WebView (remote DevTools) whether the motion is the
   sheet `transform` or the canvas scroll.
2. If it's the auto-scroll: either jump instantly (`behavior: 'auto'`) or
   render the canvas already scrolled to the active node (no animated scroll).
   Weigh against losing the "where am I on the trail" affordance.
3. If it's still a transform: trace which element animates and extend the
   fade override.

## Decision

Founder call 2026-06-26: ship as-is, log here, do not block. Residual motion is
acceptable and possibly desirable. Revisit only during a polish pass.
