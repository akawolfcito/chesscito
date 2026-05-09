# Vocabulary Audit — /exercises ecosystem

Audit date: 2026-05-09  
Scope: Interactive buttons, chips, pills, and status indicators in `/exercises` surfaces  
Visual register: Adventure atmosphere (diegetic scene-rooted vocabulary)

---

## Surfaces requiring migration

### S1. BadgeCard claim button (P0)
**File**: `src/components/exercises/badge-sheet.tsx:134-145`
**Current**: `<Button variant="game-solid">` 44×44 min-height, text "Claim Badge", spinner during load
**Target**: `<PrincipalButton>` size="medium" with trophy icon
**Rationale**: Claim is a ceremonial CTA in Adventure UI. When the badge is claimable, the user taps to claim an achievement. PrincipalButton (gold-carved wood) matches the diegetic register and reward semantics better than game-solid gradient. The spinner already dims the icon (spec 16.4 #4), so composition is seamless.
**Notes**: Currently uses `game-solid` variant. Migration requires swapping to `<PrincipalButton>`, passing `loading={isThisBusy}`, and wrapping the trophy icon. Tests expect `aria-label` on the component.

### S2. BadgeCard "Owned" pill (P1)
**File**: `src/components/exercises/badge-sheet.tsx:129-132`
**Current**: Inline flexbox with `text-emerald-700` color + check icon; no background, text-only
**Target**: `<GemBadge>` (presentational; no interaction needed)
**Rationale**: This is a status indicator showing the badge has been claimed. GemBadge (gem-shaped pill) reads as a diegetic stat marker in the Adventure register, replacing the plain text color. Gem makes the "owned" state feel earned, not informational.
**Notes**: No press interaction. Current implementation is a `<span>` with inline styling. GemBadge is purely visual, so no functional change needed.

### S3. BadgeCard locked state pill (P2)
**File**: `src/components/exercises/badge-sheet.tsx:147-158`
**Current**: Inline flex `<span>` with `background: "rgba(120, 65, 5, 0.85)"` + lock icon + "Locked" text
**Target**: `<GemBadge>` with dark brown tone variant (or no migration if kept as-is per low priority)
**Rationale**: Locked state is visual-only feedback. GemBadge unifies all metric pills under one diegetic control. If GemBadge lacks a dark-mode variant, this surface can stay as-is (P2 — infrequent path, unlikely to be audited in follow-up sprints).
**Notes**: Low visibility; deferred if GemBadge variants don't support dark brown styling.

### S4. BadgeSheet navigation button (P1)
**File**: `src/components/exercises/badge-sheet.tsx:322-335`
**Current**: Full-width rounded button with inline style `background: "rgba(245, 158, 11, 0.22)"` + trophy icon + "View Trophies" label
**Target**: `<PrincipalButton>` size="large" OR custom WoodBanner-styled container (depends on semantics)
**Rationale**: This button navigates to the Trophies sheet (not a modal or destructive action). Current styling is a frosted glass card, not a primary CTA. If this is a primary action, use PrincipalButton size="large". If it's navigational chrome, consider a styled text link with WoodBanner accent.
**Notes**: Semantically ambiguous. Recommend clarifying with product before migrating — is this a primary "claim" equivalent or navigational flavor-text?

### S5. ShopSheet buy primary button (P0)
**File**: `src/components/exercises/shop-sheet.tsx:203-216`
**Current**: `<Button variant="game-solid">` with conditional text (e.g. "Buy with USDC"); enables/disables based on `item.configured` and `item.enabled`
**Target**: `<TreasureTile>` size="small" OR composition wrapper with PrincipalButton inside
**Rationale**: This is a purchase CTA for shop items (coin packs, shields, badges). TreasureTile (chest with iconStack + valueChip) is the canonical diegetic surface for commerce in the scene-rooted vocabulary. Each catalog card is already a visual frame; nesting a TreasureTile emphasizes the commercial interaction.
**Notes**: Complex — shop items vary (shields, badges). Recommend wrapping the catalog item card with a TreasureTile micro-composition. If that's overkill, consider PrincipalButton size="medium" as a step-up from game-solid.

### S6. ShopSheet secondary "Buy with CELO" button (P1)
**File**: `src/components/exercises/shop-sheet.tsx:218-227`
**Current**: `<Button variant="game-ghost">` with conditional styling; secondary payment route
**Target**: `<GemButton>` with numeric badge (e.g. "5 CELO") OR demote to text link
**Rationale**: Secondary payment option reads as a metric toggle. GemButton (pressable metric pill) is less prominent than PrincipalButton but still diegetic. Alternatively, if this is purely informational, drop it to a text link.
**Notes**: Infrequent path (only Founder Badge on non-MiniPay flows). Current variant is game-ghost (low-contrast secondary). P1 priority; deferred if GemButton migration hits capacity limits.

### S7. MissionDetailSheet stats row (P1)
**File**: `src/components/exercises/mission-detail-sheet.tsx:130-164`
**Current**: Two side-by-side stat cards with border and white/15 background; text labels + icons (star, time); no interactivity
**Target**: `<GemBadge>` × 2 (composited score + time pair) OR upgrade to WoodBanner if larger frame expected
**Rationale**: Stats are presentational metric displays. GemBadge unifies metric styling across the game UI. If stats need stronger visual separation, WoodBanner can frame them.
**Notes**: Stat cards are frozen (read-only). Low interactivity = low complexity. GemBadge composition is cleanest.

### S8. MissionDetailSheet journey rail frame (P2)
**File**: `src/components/exercises/mission-detail-sheet.tsx:175-187`
**Current**: Rounded card with border `border-[rgba(255,255,255,0.45)] bg-white/15` wrapping a JourneyRail
**Target**: `<WoodBanner>` size="medium" as a frame header + keep JourneyRail content below
**Rationale**: Journey rail is a narrative progression display. WoodBanner (presentational title ribbon) adds diegetic framing without changing the content. Title reads "Your journey" — perfect WoodBanner semantic.
**Notes**: P2 — pure presentational. JourneyRail component itself doesn't need migration, just the outer frame.

### S9. BadgeSheet trigger button (dock button) (P0)
**File**: `src/components/exercises/badge-sheet.tsx:238-255`
**Current**: Raw `<button>` with custom image (`badge-menu.png`) and optional pinging notification dot (48×48 min)
**Target**: Keep as-is (dock button exception) OR wrap in `<StonePedestal>` if desk-based redesign
**Rationale**: Dock buttons are outside the audit scope (spec 16.6 future work). They're already image-based custom controls. No migration needed for M3.5.
**Notes**: Confirmed no-op per spec. Dock buttons are carved as exceptions.

### S10. ShopSheet trigger button (dock button) (P0)
**File**: `src/components/exercises/shop-sheet.tsx:57-70`
**Current**: Raw `<button>` with custom `shop-menu.png` image (48×48 min)
**Target**: Keep as-is (dock button exception)
**Rationale**: Same as S9 — dock buttons are out-of-scope for M3.5.
**Notes**: Confirmed no-op per spec.

### S11. PiecePickerSheet piece buttons (P0)
**File**: `src/components/exercises/piece-picker-sheet.tsx:72-125`
**Current**: Grid of 6 piece toggle buttons (88×88 min); cyan ring on active; white/15 background on inactive; disabled state grayed out
**Target**: No good fit — these are selection controls, not CTAs. Stay as custom button grid.
**Rationale**: StonePedestal is for discrete tap targets (play, interact, claim). Piece picker is a selection widget requiring radio-button semantics and a 3-column grid. Diegetic primitives don't support multi-select layouts.
**Notes**: Correctly implemented as custom buttons. No migration recommended.

### S12. MissionBriefing play button (P0)
**File**: `src/components/exercises/mission-briefing.tsx:61-70`
**Current**: `<Button variant="game-primary">` full-width, "Play" label inside CandyGlassShell
**Target**: `<PrincipalButton>` size="large"
**Rationale**: "Play" is a primary ceremonial action (entering a mission). PrincipalButton (gold-carved wood) is the canonical diegetic primary CTA in the Adventure register. CandyGlassShell frames the mission-briefing modal with candy design; swapping the button to PrincipalButton bridges the candy-modal frame to the scene-rooted world.
**Notes**: This is the entry point to every mission. Migration is high-impact (every session). Ensure PrincipalButton size="large" fits the `w-full` layout inside CandyGlassShell (spec: 280×80 for large).

### S13. ActionPin non-claim variants (P0)
**File**: `src/components/redesign/action-pin.tsx:60-90` (styles) + `60-89` (icon mapping)
**Current**: Per-action gradients: submitScore (brand blue), useShield (reward orange), retry (muted), connectWallet (brand blue), switchNetwork (reward orange)
**Target**: `<PrincipalButton>` size="large" for submitScore, useShield, and claimBadge; keep retry/connectWallet/switchNetwork as ActionPin (no diegetic fit)
**Rationale**: submitScore and useShield are ceremonial CTAs (claim/use rewards). claimBadge is already wired to PrincipalButton (spec 16.5). Retry, connectWallet, and switchNetwork are utility actions (error recovery, wallet setup) — they don't fit the Adventure scene metaphor.
**Notes**: Audit only covers non-claim variants per scope. Claim path is already migrated (line 185–210 composes PrincipalButton). Recommend keeping retry/connectWallet/switchNetwork as status-colored ActionPin.

### S14. ContextualActionSlot wrapper (P1)
**File**: `src/components/exercises/contextual-action-slot.tsx:36-91`
**Current**: Conditional size="pin" or size="full" rendering of ActionPin; entrance animations (fade-in zoom for pin, slide-from-bottom for full)
**Target**: No migration — this is an orchestrator. ActionPin atoms stay the same.
**Rationale**: ContextualActionSlot is a composition wrapper, not a surface. It owns entrance animations and compact-mode switching logic. The atomic ActionPin (inside) is the migration target.
**Notes**: No-op for audit. Covered under S13.

---

## Summary

**Total surfaces audited**: 14  
**High priority (P0)**: 6 surfaces (claim button, shop buy, MissionBriefing play, ActionPin non-claim, dock buttons)  
**Medium priority (P1)**: 4 surfaces (owned pill, nav button, CELO pay, stats)  
**Low priority (P2)**: 2 surfaces (locked pill, journey frame)  
**No-op (already correct or out-of-scope)**: 3 surfaces (piece picker, dock buttons×2, ContextualActionSlot orchestrator)

**Blockers**: None. All target primitives (`PrincipalButton`, `TreasureTile`, `GemBadge`, `GemButton`, `WoodBanner`) are shipped and stable (spec §16.5 completed migrations).

**Testing impact**: Expect ~8–10 visual regression checks for button shape/gradient swaps. No functional behavior change (all targets preserve onClick/disabled/loading semantics).

