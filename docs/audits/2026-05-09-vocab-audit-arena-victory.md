# Vocabulary Audit — /arena + /victory ecosystem

**Date**: 2026-05-09
**Scope**: `/arena`, `/victory`, mini-arena interactive surfaces
**Baseline**: M3.5 (commit `c35cd75`) + 5 diegetic primitives shipped

## Findings

### S1. Claim Victory CTA (P0)
**File**: `src/components/arena/victory-celebration.tsx:100–114`
**Current**: `variant="game-solid"` Button with mint-badge treatment (amber gradient + inset gold shadow).
**Target**: `<PrincipalButton size="large">`
**Rationale**: Mint-fee primary CTA on victory screen — most ceremonial action in the entire flow. Deserves carved-wood treatment over generic gradient. Migrate first; downstream claim surfaces inherit the language.
**Notes**: Currently uses flex layout with multi-line span (icon + value-hint subtext). PrincipalButton may need an `asChild` pattern or a wrapper for the value-hint subtext.

### S2. Play Again Button (Victory Celebration) (P1)
**File**: `src/components/arena/victory-celebration.tsx:117–119`
**Current**: `variant="game-ghost"` Button with refresh icon.
**Target**: `<PrincipalButton size="medium">` (secondary variant if available)
**Rationale**: Repeated post-victory action; less ceremonial than claim but still primary. Game-ghost reads too muted for a victory-state CTA.
**Notes**: If PrincipalButton lacks a secondary variant, keep current; secondary demotions belong in ghost tier.

### S3. Play Again (Victory Claim Success) (P1)
**File**: `src/components/arena/victory-claim-success.tsx:73–75`
**Current**: `variant="game-primary"` Button.
**Target**: `<PrincipalButton size="medium">`
**Rationale**: Same role as S2 but on success screen (post-mint). Consistency across victory end-states.

### S4. Try Again (Victory Claim Error) (P1)
**File**: `src/components/arena/victory-claim-error.tsx:75–77`
**Current**: `variant="game-primary"` Button.
**Target**: `<PrincipalButton size="medium">`
**Rationale**: Primary recovery action on error state — gravitas of retry deserves carved wood.

### S5. Claimed Badge pill (Victory Claim Success) (P2)
**File**: `src/components/arena/victory-claim-success.tsx:123–132`
**Current**: Inline `<span>` with brown bg + gold text, hardcoded styles.
**Target**: `<GemBadge>` or new `<VictoryBadge>` semantic layer atop GemBadge.
**Rationale**: Badge signals ownership/achievement. GemBadge is for gem-shaped indicators; this reads more like a seal/ribbon. May warrant dedicated surface if Victory NFTs grow into their own visual layer.
**Notes**: Currently a cosmetic label inside the stats card. Low priority.

### S6. Share Button (Victory Celebration) (P2)
**File**: `src/components/arena/victory-celebration.tsx:124–128`
**Current**: `variant="game-ghost" size="game-sm"` Button.
**Target**: Keep as ghost OR swap to `<ActionPin>` already migrated path.
**Rationale**: Secondary, optional action. Ghost is semantically correct (share is non-progression). Only upgrade if action-pin gives better tactile hierarchy.

### S7. Resign Button (Arena during play) (NO CHANGE)
**File**: `src/components/arena/arena-action-bar.tsx:50–72`
**Current**: Custom `.arena-action-pill` with CandyBanner icon. Confirm-state uses border + backdrop-blur.
**Rationale**: Mid-game state surface — outside victory/celebration flow. Confirm pattern (3s countdown) is excellent and should be documented as exemplar for destructive actions.

### S8. Start Match CTA (Arena entry panel) (P0)
**File**: `src/components/arena/arena-entry-panel.tsx:293–302`
**Current**: `variant="game-primary"` Button with CandyBanner play icon.
**Target**: `<PrincipalButton size="large">`
**Rationale**: Entry gate to the arena; the first ceremonial CTA after picking difficulty/color. Carved wood signals "entering the arena" ritual. Tied with S1 as **highest-priority** migration in the cluster.
**Notes**: Currently inline icon + text. Verify PrincipalButton's icon placement.

### S9. Soft-gate Learn CTA (Arena entry panel) (P1)
**File**: `src/components/arena/arena-entry-panel.tsx:169–177`
**Current**: `variant="game-primary"` Button inside soft-gate banner.
**Target**: `<PrincipalButton size="small">` (or medium if space allows)
**Rationale**: Routing to lessons (/exercises) — ceremonial but secondary to Start Match. Wood reinforces "learning path" as a valued progression.
**Notes**: Lives in a glass-panel banner; ensure sizing doesn't break layout.

### S10. Difficulty Pill (Arena during play) (P2)
**File**: `src/app/arena/page.tsx:1077–1089`
**Current**: Custom button with `border-amber-300/45` + `bg-amber-400/15`, amber text.
**Target**: `<StonePedestal size="small">` if it fits the "tactile difficulty swap" intent — or leave as bespoke pill (no diegetic equivalent).
**Rationale**: Mid-match secondary escape hatch. If round tap target doesn't match the pill geometry, leave. Low priority.

### S11. Back to Hub Link (Victory page + modals) (P1)
**File**: `src/app/victory/[id]/page.tsx:168–174` + multiple modals
**Current**: Hardcoded `<Link>` with brown/gold inline styles (`rgb(120, 65, 5)` bg, `rgb(255, 240, 180)` text).
**Target**: `<PrincipalButton size="large">` or new `<VictoryPageCTA>` wrapper that captures the brown-bg + gold-text pattern.
**Rationale**: Victory page's "accept challenge" CTA is the *only* CTA on that page — deserves ceremonial treatment. Hardcoded Link styling is fragile. Wrap in primitive or hoist to editorial constant.
**Notes**: Full-page primary action; bump priority if /victory becomes high-traffic.

### S12. Back to Hub (Modal secondary actions) (NO CHANGE)
**File**: Victory celebration / claim / error modals (multiple files)
**Current**: Hardcoded `<button>` or text-link style.
**Rationale**: Back actions are secondary; no diegetic surface needed. Current treatment is fine.

## Summary

| Priority | Count | Surfaces |
|---|---:|---|
| P0 | 2 | S1 (Claim), S8 (Start Match) |
| P1 | 5 | S2–S4 (play again / retry), S9 (Learn CTA), S11 (Victory page accept) |
| P2 | 3 | S5 (claimed badge), S6 (share), S10 (difficulty pill) |
| NO CHANGE | 2 | S7 (Resign), S12 (Back to Hub) |

**Migration estimate**: ~7 surfaces (S1, S2–S4, S8–S9, S11). All map cleanly to existing primitives.
