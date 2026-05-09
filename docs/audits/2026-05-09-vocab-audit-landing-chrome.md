# Vocabulary Audit — Landing + Secondary Pages + Shared Chrome

**Date**: 2026-05-09  
**Scope**: `/` landing, `/about`, `/support`, `/privacy`, `/terms`, global status bar, persistent dock, contextual header, HUD chips, landing components.  
**Status**: Complete audit. 17 surfaces identified; 3 ready for migration; 12 low priority; 2 explicitly non-diegetic.

---

## Summary

The landing page and secondary legal pages contain **17 interactive surfaces**. After M3.5, diegetic primitive inventory is:
- `<PrincipalButton>` — gold-carved wood CTA (medium/large)
- `<TreasureTile>` — wood-framed tile (unused in scope)
- `<StonePedestal>` — tap target on stone (unused in scope)
- `<WoodBanner>` — wood-grain banner (0 consumers — awaiting deployment)
- `<GemBadge>` / `<GemButton>` — gem indicators (0 consumers — awaiting deployment)

**High-priority candidates**: 
1. Landing hero + plan CTAs (PrincipalButton size="large")
2. Landing/secondary footer links (none — intentionally web-style per landing context)
3. Secondary page navigation (paper-tray; non-diegetic by design)

**Decision**: Only 3 surfaces warrant diegetic treatment; the remainder are **intentionally non-diegetic** (landing is web-responsive, secondary pages follow web patterns, dock is exempt per DESIGN_SYSTEM §8).

---

## Detailed Findings

### Landing Page (`apps/web/src/components/landing/landing-page.tsx`)

#### S1. Hero Primary CTA (P0)
**File**: `landing-page.tsx:93-97`  
**Current**: `<Button variant="game-primary" size="game">`  
**Visual**: Warm brown wood pill (`bg-[rgb(120,65,5)]`), cream text, shadow, Rowdies font  
**Target**: `<PrincipalButton size="large">`  
**Rationale**: Game-native CTA. Hero is the highest-conversion surface on landing. Diegetic treatment signals "this is inside the game world, not the web." The current game-primary button *approximates* diegetic carving but is flat. PrincipalButton adds the texture + depth that sells immersion.  
**Notes**: Desktop layout requires responsive sizing. Verify medium/large sizes work at 1200px desktop viewport. The CTA sits in a Duolingo-style split hero, not inside a modal, so the visual contrast will be stronger than in narrower sheets.  
**Priority**: P0 (every session sees it; conversion driver)

#### S2. Hero Secondary CTA (P1)
**File**: `landing-page.tsx:98-102`  
**Current**: `<Button variant="game-ghost" size="game">`  
**Visual**: Translucent white glass, warm-brown text, Rowdies font  
**Target**: No diegetic fit (tertiary action)  
**Rationale**: "Learn more" scroll-anchor link. Intentionally non-diegetic to create visual hierarchy below primary. Remains as game-ghost.  
**Priority**: P1 (appears once, low touch frequency)

#### S3. Header Nav Primary CTA (P1)
**File**: `landing-page.tsx:56-60`  
**Current**: `<Button variant="game-primary" size="game-sm">`  
**Visual**: Same wood-pill, tight spacing  
**Target**: `<PrincipalButton size="medium">`  
**Rationale**: Top-nav "Play" button mirrors hero primary. Diegetic treatment here reinforces the main CTA design language across the page.  
**Notes**: Wrapped in `<Link>` via `asChild`. Verify asset scaling in constrained header space (fits ~64px content).  
**Priority**: P1 (visible on first screen, but secondary entry point vs hero)

#### S4. Plan Tier Featured CTA (P1)
**File**: `landing-page.tsx:532-553`  
**Current**: `<Button variant="game-primary" size="game-sm">`  
**Visual**: Same wood-pill, inside pricing card  
**Target**: `<PrincipalButton size="medium">`  
**Rationale**: Highlighted tier CTA (currently "Familia"). Diegetic treatment creates visual distinction vs non-featured tiers (which use paper-tray style).  
**Notes**: Iterate over tiers; only featured ones get the button. The non-featured tiers intentionally use `paper-tray` (web-style bare link). This mixed approach is intentional.  
**Priority**: P1 (monetization surface, but low visit frequency for most users)

#### S5. Plan Tier Non-Featured CTA (P0)
**File**: `landing-page.tsx:554-577`  
**Current**: `<Link>` and `<a>` with `paper-tray` class  
**Visual**: No background, warm-brown text, `active:scale-[0.99]`  
**Target**: No diegetic fit (web-style nav)  
**Rationale**: The gratuito (free), educador, aliados tiers intentionally use web-style navigation. They route to mailto: or GitHub, not inside the game. Keeping them non-diegetic prevents false affordance ("click to enter the game").  
**Priority**: P0 (all users see all tiers; intentional non-diegetic = information, not action)

#### S6–S10. Card Eyebrow Pills + Claim Cards + Impact Cards (P2)
**File**: `landing-page.tsx:67-76, 166-196, 614-655`  
**Current**: Inline-flex pills with `rounded-full`, inline badges with `text-[0.65rem]`  
**Visual**: Warm-cream background, gold accent borders, uppercase labels  
**Target**: No diegetic fit (informational, not interactive)  
**Rationale**: These are passive indicators (eyebrow, step numbers, feature badges). They don't trigger actions — they organize content. Diegetic primitives are for *interactive* elements. Keeping these as CSS-only cards maintains the candy-light landing aesthetic without overstuffing the page with carved assets.  
**Priority**: P2 (informational, not interactive)

#### S11. Final CTA Primary (P0)
**File**: `landing-page.tsx:817-820`  
**Current**: `<Button variant="game-primary" size="game">`  
**Visual**: Same wood-pill  
**Target**: `<PrincipalButton size="large">`  
**Rationale**: Final conversion nudge at page bottom. Diegetic treatment mirrors hero for narrative consistency.  
**Notes**: Desktop layout is a `flex-row` with secondary CTA alongside. Verify layout doesn't break with diegetic asset widths.  
**Priority**: P0 (full-page scroll target; second conversion point)

#### S12. Final CTA Secondary (P1)
**File**: `landing-page.tsx:822-831`  
**Current**: `<Button variant="game-ghost" size="game">`  
**Visual**: Same translucent glass  
**Target**: No diegetic fit (mailto: contact)  
**Rationale**: "Talk to the team" email link. Intentionally non-diegetic to signal "leave the game context, go to support."  
**Priority**: P1 (appears once, conditional on env var)

#### S13. Sponsors Email CTA (P2)
**File**: `landing-page.tsx:769-780`  
**Current**: `<a>` with `paper-tray` class  
**Visual**: No background, warm-brown text  
**Target**: No diegetic fit (mailto:)  
**Rationale**: Contact + GitHub link for sponsors. Web-style navigation intentional.  
**Priority**: P2 (only for sponsors; low traffic)

---

### Secondary Pages (about, support, privacy, terms)

#### S14. About Page Navigation Links (P1)
**File**: `/app/about/page.tsx:58-71`  
**Current**: `<Link>` with `paper-tray` class  
**Visual**: Icon + label, warm-brown text, no background  
**Target**: No diegetic fit (web-style nav)  
**Rationale**: Links to other legal/info pages (/support, /privacy, /terms, /). These are *web navigation*, not game actions. The about page itself is served at a public URL for external crawlers and is intentionally non-diegetic.  
**Notes**: Uses lucide-react icons (Compass, LifeBuoy, Shield, FileText) — not candy-sprite based. Intentional to signal "not inside the game."  
**Priority**: P1 (visible but out-of-game context)

#### S15. About Invite/Share Button (P1)
**File**: `/app/about/invite-link.tsx:12-42`  
**Current**: `<button type="button">` with `paper-tray` class  
**Visual**: CandyIcon (share/check) + text, warm-brown, no background  
**Target**: No diegetic fit (web-style action)  
**Rationale**: Share/copy invite link. Uses `navigator.share()` (web API), not a game action. Intentionally minimal to avoid overloading the about page with game theming.  
**Priority**: P1 (low traffic, but accessible from hub)

#### S16. Support Page Contact Channels (P1)
**File**: `/app/support/page.tsx:19-62`  
**Current**: `<a>` and fallback `<div>` with `paper-tray` class  
**Visual**: Icon + label, warm-brown text  
**Target**: No diegetic fit (web-style nav)  
**Rationale**: mailto: and GitHub issue links. Web-style navigation.  
**Priority**: P1 (support entry point; web context)

#### S17. Privacy + Terms Sections (P2)
**File**: `/app/privacy/page.tsx:15-52, /app/terms/page.tsx:15-31`  
**Current**: Plain `<section>` with headings + paragraphs  
**Visual**: CSS-only layout  
**Target**: No diegetic fit (static content)  
**Rationale**: Legal documents. No interactive elements. No CTA buttons.  
**Priority**: P2 (informational only)

---

## Shared Chrome (Persistent Across Routes)

### Global Status Bar (`apps/web/src/components/ui/global-status-bar.tsx`)
**Status**: No diegetic candidates.  
**Rationale**: Z1 primitive for player identity (handle + PRO pill). The PRO pill uses `game-primary` styling (gradient gold → brown, cream text) which is *not* diegetic — it's a status indicator, not a CTA. No PrincipalButton fit.  
**Note**: Commit `619dbe8` already removed avatar + days-suffix; no further cleanup needed.

### Persistent Dock (`apps/web/src/components/exercises/persistent-dock.tsx`)
**Status**: Explicitly non-diegetic by design per DESIGN_SYSTEM §8.  
**Rationale**: The dock is a *persistent navigation layer* (z-60), not gameplay. It uses CandyBanner (`btn-battle`) and plain buttons because it's meant to feel like a separate HUD overlay, not integrated into the game world.  
**Note**: Do NOT migrate to diegetic primitives. The separation is intentional UX.

### Contextual Header (`apps/web/src/components/ui/contextual-header.tsx`)
**Status**: No diegetic candidates.  
**Rationale**: Z2 primitive (title + back + trailing control). Carries discriminated-union props for layout flexibility. The back button and trailing slot both accept generic ReactNode controls; callers decide styling. No CTA rendering inside the header itself.

### HUD Resource Chip (`apps/web/src/components/hud/hud-resource-chip.tsx`)
**Status**: No diegetic candidates.  
**Rationale**: Presentational indicator (trophy count, PRO status, currency). Renders as `<span>` or `<button>` with pulse animation on value change. Not a CTA; no diegetic fit.

### CandyIcon + CandyBanner
**Status**: Already diegetic — sprite-based asset system.  
**Rationale**: These are intentional replacements for raw icon families. No further audit needed.

---

## Action Items

### High Priority (Migration Ready)
1. **S1 (Hero Primary)**: Migrate to `<PrincipalButton size="large">` in landing hero.
2. **S3 (Header Nav Primary)**: Migrate to `<PrincipalButton size="medium">` in nav.
3. **S11 (Final CTA Primary)**: Migrate to `<PrincipalButton size="large">` at page bottom.

### Medium Priority (Ready, Lower Impact)
4. **S4 (Plan Tier Featured)**: Migrate featured plan CTA to `<PrincipalButton size="medium">`.

### Non-Action (Intentionally Non-Diegetic)
- **S2, S5, S12, S13, S14–S17**: Remain as web-style buttons/links.
- **Dock, Status Bar, Contextual Header**: Remain as-is.

### WoodBanner + GemBadge Deployment
**Not yet assigned in scope** — but identified as candidates for future secondary pages / badge showcase when design calls for them.

---

## Notes

- **Landing as web-first**: The landing page (`/`) is a responsive web marketing surface for external users. Mixed diegetic/non-diegetic treatment (diegetic hero CTAs, web-style secondary nav) is intentional — it creates narrative momentum: "this game looks carved and rich" → "but I can also learn about it like a normal web page."
- **Secondary pages are intentionally non-diegetic**: `/about`, `/support`, `/privacy`, `/terms` are served as public web pages, crawlable by search, linked from external sites. Diegetic styling here would confuse context.
- **Dock is sacred per DESIGN_SYSTEM §8**: The persistent dock is exempt from diegetic styling. It's a navigation layer, not a game surface.
- **Paper-tray links are correct**: The `paper-tray` class (warm-brown text, no background, scale-on-tap) is the canonical web-style link treatment across secondary pages. This contrast with diegetic hero CTAs is intentional.

---

## Conclusion

**17 surfaces audited. 3 ready for immediate migration to diegetic primitives (all PrincipalButton). 1 additional candidate (plan tier featured). 12 intentionally non-diegetic. 0 blockers.**

The landing CTA chain (hero → header nav → final CTA) is high-impact and ready to migrate. The secondary pages and shared chrome have zero diegetic needs and are correct as-is.
