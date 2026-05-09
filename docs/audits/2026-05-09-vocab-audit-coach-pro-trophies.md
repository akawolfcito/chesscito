# Vocabulary Audit — coach + pro + trophies

**Date**: 2026-05-09
**Scope**: `/coach`, `/pro`, `/trophies`, ProSheet, ProActiveBadge, achievements grid
**Baseline**: M3.5 (commit `c35cd75`) + 5 diegetic primitives shipped

## Findings

### S1. ProSheet main CTA (P0)
**File**: `apps/web/src/components/pro/pro-sheet.tsx`
**Current**: `variant="game-primary"` / `game-ghost` Button for premium purchase.
**Target**: `<PrincipalButton size="large">`
**Rationale**: Premium purchase funnel CTA — top conversion surface in the PRO flow. Carved-wood treatment elevates the ceremonial weight of the upgrade decision and aligns with the rest of the diegetic vocabulary players see across the app.
**Notes**: Verify ARIA label preserved (likely "Subscribe to PRO" or similar).

### S2. CoachPanel history banner (P1)
**File**: `apps/web/src/components/coach/coach-panel.tsx`
**Current**: Custom banner / chip with cream background + brown text.
**Target**: `<WoodBanner>` (presentational, asTitle when leading)
**Rationale**: Feature-discovery banner ("review past games") that benefits from wood-grain treatment. Activates `<WoodBanner>`, currently with 0 consumers. Banner is non-interactive header content — exact match for WoodBanner's role.

### S3. CoachFallback secondary CTA (P1)
**File**: `apps/web/src/components/coach/coach-fallback.tsx`
**Current**: Generic Button with upsell copy.
**Target**: `<PrincipalButton variant="secondary">` or `size="medium"`
**Rationale**: Upsell CTA from quick-review free path → paid coach. Ceremonial enough to deserve carved wood, but secondary to a primary path so a smaller size is appropriate.

### S4. ProActiveBadge pill (P1)
**File**: `apps/web/src/components/pro/pro-active-badge.tsx`
**Current**: Solid amber-500 / emerald-500 pill with "ACTIVE" / "EXPIRING" text.
**Target**: `<GemBadge>` (gem-shaped indicator for premium entitlement)
**Rationale**: PRO entitlement = premium signal. GemBadge's gem-shape is the canonical "premium" glyph. Activates the primitive (currently 0 consumers) and gives the entitlement a unique visual mark distinct from generic pills.
**Notes**: Verify GemBadge supports both ACTIVE (emerald) and EXPIRING (amber) tone variants — may need a tone prop addition.

### S5. AchievementsGrid earned cards (P1)
**File**: `apps/web/src/components/trophies/achievements-grid.tsx`
**Current**: Card-style tiles with photographic icons + earned/locked states.
**Target**: `<TreasureTile variant="achievement">` (or extend TreasureTile with earned-state ribbon)
**Rationale**: Achievements = trophy collectibles. TreasureTile is built for exactly this metaphor. Earned achievements could carry a "EARNED" ribbon analogous to "BEST".
**Notes**: TreasureTile currently has BEST/NEW/SALE ribbons; add EARNED variant. Locked state may need a different visual (deferred).

### S6. ProChip (top status) (NO CHANGE — already diegetic)
**File**: `apps/web/src/components/ui/global-status-bar.tsx`
**Current**: Gold gradient pill with star glyph (post-`619dbe8` simplification).
**Rationale**: After the `619dbe8` cleanup the chip reads as a candy-style pill — gradient + glyph is acceptable as a floating premium indicator. Diegesis is already harmonized with the broader candy palette.

### S7. TrophyList error card (P2 — NO CHANGE)
**File**: `apps/web/src/components/trophies/*` (error fallback)
**Current**: Rose-900 styled error card.
**Rationale**: Error signals legitimately override diegesis (red is a universal warning color). Keep rose-900.

### S8. ProActiveCTA container (P2)
**File**: `apps/web/src/components/pro/pro-active-cta.tsx` (or similar)
**Current**: Frosted-glass container.
**Rationale**: Confirmation surface; frosted glass is acceptable for low-attention confirmation patterns. Low priority; revisit if it becomes a high-traffic surface.

### S9–S11. Out of scope (intentional non-diegetic)
- **Error-retry buttons**: warning surfaces, override diegesis
- **Perks checkmark icons**: minimal visual weight, semantic icons OK
- **Inline links**: text affordances, web-style is correct

## Summary

| Priority | Count | Surfaces |
|---|---:|---|
| P0 | 1 | S1 (ProSheet CTA) |
| P1 | 4 | S2 (Coach banner), S3 (Coach fallback), S4 (PRO badge), S5 (Achievements) |
| P2 | 2 | S7 (error), S8 (PRO confirmation) — both NO CHANGE recommended |
| NO CHANGE | 1 | S6 (ProChip already diegetic) |

**Migration estimate**: ~5 surfaces (~140 LOC across 7 files), single-sprint scope.

**Activates dormant primitives**:
- `<WoodBanner>` — first home (S2)
- `<GemBadge>` — first home (S4)
