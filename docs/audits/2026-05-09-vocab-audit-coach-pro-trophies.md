# Vocabulary Audit — coach + pro + trophies

## S1. CoachPanel history-feature banner (P1)
**File**: `src/components/coach/coach-panel.tsx:66–86`
**Current**: Amber/tan inline div (rounded-2xl, border-amber-300/60, bg-amber-50/80). Dismissible via localStorage gate.
**Target**: `<WoodBanner>` size="medium"
**Rationale**: Feature callout for PRO+ history tracking. Wood-grain banner semantically signals "special feature unlocked" and reads better than amber-only treatment. Dismiss button becomes banner's native affordance.
**Notes**: Fires only once per user; preserve localStorage gate. Consider "Building your history…" text as subline.

## S2. CoachFallback quick-review secondary CTA (P1)
**File**: `src/components/coach/coach-fallback.tsx:69–80`
**Current**: game-ghost Button (tan border, no fill). Upsell to full analysis.
**Target**: `<PrincipalButton>` variant="secondary" size="medium"
**Rationale**: Secondary CTA below primary Play Again action. Carved wood button reads "upgrade this tier" better than ghost outline. Already wrapped in Button component; migration is CSS/styling only.
**Notes**: Keep hover state consistent with variant. No icon needed (existing text is sufficient).

## S3. ProActiveBadge pill (ACTIVE/EXPIRING) (P1)
**File**: `src/components/pro/pro-active-badge.tsx:32–50`
**Current**: Rounded pill with conditional bg-emerald-500 (active) / bg-amber-500 (expiring) + text-white.
**Target**: `<GemBadge>` (premium shape indicator)
**Rationale**: Premium entitlement indicator. Gem shape signals rarity & membership tier. Emerald/amber variants map cleanly to gem states (translucent gem vs. glowing gem).
**Notes**: `<GemBadge>` takes icon + value; map "ACTIVE"/"EXPIRING" as value, gem glyph as icon. Day-left suffix stays as separate span.

## S4. ProSheet primary CTA button (P0)
**File**: `src/components/pro/pro-sheet.tsx:329–339`
**Current**: Button CVA (game-primary / game-ghost, size="game"). Resolves to "Buy PRO" / "Renew" / "Connect Wallet" etc. via resolveCta().
**Target**: `<PrincipalButton>` size="large"
**Rationale**: Gold-carved CTA for purchase/renewal funnel. Highest-priority surface in PRO discovery. Carving signals "valuable action, requires intent." Migrating to diegetic button elevates conversion clarity.
**Notes**: Variant switching (game-primary/game-ghost) → PrincipalButton's variant system. Test disabled states (Processing, Verifying). Keep loading spinner if present.

## S5. ProSheet error-retry button (P1)
**File**: `src/components/pro/pro-sheet.tsx:305–315`
**Current**: Custom rose-900 button (inline-flex, bg-rose-900, text-rose-50, px-3, py-1.5). Retry verify-pro after tx confirmation fails.
**Target**: No good fit (error recovery is semantic exception)
**Rationale**: Error UI is legitimately outside diegetic scope — rose-900 button signals "destructive/recovery" which carving can't convey. Leave as-is. Consider adding text label "Retry" inline to clarify action.
**Notes**: This is intentional non-diegetic treatment. Do not force into wood/gem vocabulary.

## S6. ProSheet perks list checkmark (P2)
**File**: `src/components/pro/pro-sheet.tsx:258–268`
**Current**: Checkmark glyph (✓) + text list. Active perks enumeration.
**Target**: No fit (informational glyph, not interactive)
**Rationale**: Passive content, not a button or interactive control. Checkmark is semantic content marker. Diegetic primitives are for CTAs/indicators only.
**Notes**: Keep as-is.

## S7. ProChip (floating premium indicator) (P1)
**File**: `src/components/pro/pro-chip.tsx:54–96`
**Current**: Gradient pill (gold→amber inactive, purple→violet active) with star (★) / gem (✦) glyphs. Floats top-right of play-hub main.
**Target**: Already diegetic (gradient-based premium signal)
**Rationale**: Floating chip intentionally uses gradient to convey "premium tier" without diegetic carving. Gradients are acceptable for non-interactive status indicators. The glyphs (star/gem) already signal rarity.
**Notes**: No migration needed. This is a good precedent for "premium surfaces can use gradient + glyph."

## S8. AchievementsGrid earned-state card (P1)
**File**: `src/components/trophies/achievements-grid.tsx:32–82`
**Current**: Conditional box-shadow + border (earned: amber/gold border+glow; locked: white/subtle border). 88px tall cards in 2×N grid.
**Target**: `<TreasureTile>` variant="achievement" size="small"
**Rationale**: Earned achievements are trophy-like collectibles. Treasure Tile's wood frame + glow naturally conveys "unlocked reward." Locked state can be a locked-variant tile or keep as-is (subtle).
**Notes**: Consider ribbon="EARNED" for completed achievements. Iconography (trophy/lock) stays. Grid wrapping may need adjustment if TreasureTile has padding.

## S9. TrophyList error card (P2)
**File**: `src/components/trophies/trophy-list.tsx:41–64`
**Current**: Rose-tinted error box (rose-100 bg, rose-100 border, rose-900 text). Generic error state with retry button.
**Target**: `<WoodBanner>` variant="error" OR leave as-is (error signals can break diegesis)
**Rationale**: Error states are valid exceptions to diegetic consistency. Rose treatment is semantically appropriate (error = warm danger). Low priority because errors are rare UX paths.
**Notes**: If migrating, WoodBanner's dark wood tone + text might clash with error semantics. Recommend keeping rose-900 styling as-is for clarity.

## S10. ProActiveCTA container (P2)
**File**: `src/components/pro/pro-active-cta.tsx:48–66`
**Current**: White/55 frosted container (rounded-xl, bg-white/55, px-3, py-3). Wraps "Got it" / "Play in Arena" CTA + subline.
**Target**: Consider `<TreasureTile>` variant="info" OR keep as-is (lightweight callout)
**Rationale**: Low visual weight, informational context. Carving wood around this might oversell importance. Frosted glass is appropriate for post-purchase confirmation. Low priority migration.
**Notes**: Skip unless design language calls for treasure boxes in confirmation flows.

## S11. TrophiesBody rookie CTA (Victory invitation) (P0 — Already Compliant ✓)
**File**: `src/components/trophies/trophies-body.tsx:205–232`
**Current**: Already uses `<PrincipalButton>` wrapping Link to /arena. "Play in Arena" invitation.
**Target**: N/A (already diegetic)
**Rationale**: This is the model for rookie flows. Carving clearly signals "important action, requires intent."
**Notes**: No migration needed. Audit confirms consistency.

---

## Migration Priority Roadmap

| Priority | Surface | File | Estimated LOC | Notes |
|---|---|---|---|---|
| P0 | ProSheet main CTA | pro-sheet.tsx:329–339 | 15 | Highest-value conversion funnel. Variant switching required. |
| P1 | CoachPanel banner | coach-panel.tsx:66–86 | 25 | Feature discovery callout. WoodBanner size + dismiss affordance. |
| P1 | CoachFallback secondary CTA | coach-fallback.tsx:69–80 | 12 | Upsell flow. Simple Button→PrincipalButton migration. |
| P1 | ProActiveBadge pill | pro-active-badge.tsx:32–50 | 20 | Premium entitlement indicator. GemBadge icon+value. |
| P1 | AchievementsGrid earned cards | achievements-grid.tsx:32–82 | 35 | Trophy collectible. TreasureTile variant + grid layout. |
| P2 | TrophyList error card | trophy-list.tsx:41–64 | 18 | Rare error path. Consider keeping rose-900 for clarity. |
| P2 | ProActiveCTA container | pro-active-cta.tsx:48–66 | 15 | Lightweight callout. Low priority; frosted glass acceptable. |

---

## Out of Scope (Intentional Non-Diegetic)

- **ProSheet error-retry button** (P1): Error recovery must signal caution. Rose-900 is semantically correct.
- **ProSheet perks checkmark list** (P2): Informational content, not interactive control.
- **ProChip gradient** (P1): Floating premium chip intentionally uses gradient to avoid visual weight on play-hub main.
- **Inline links** (Pro extend, share buttons): Diegetic primitives don't fit text hyperlinks. Keep as underlined text.

---

**Report Date**: 2026-05-09  
**Auditor**: Claude Code (minimal budget, Haiku 4.5)  
**Scope**: coach-panel, coach-history, coach-fallback, coach-loading, coach-welcome, coach-paywall (header only), pro-sheet, pro-active-badge, pro-active-cta, pro-chip, trophies/page, achievements-grid, trophy-card, trophy-list, trophies-body.

