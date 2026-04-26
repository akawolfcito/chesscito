# Secondary Screen Cohesion — Design Spec

**Date:** 2026-03-28
**Status:** Draft
**Scope:** Victory flow (4 phases), Coach screens (5 components), CTA hierarchy system
**Driver:** UI Guardrail audit — 7 screens with violations across guardrails #2, #3, #4, #6, #7, #8, #10, #11, #12

---

## Problem

Secondary screens accumulate CTAs without hierarchy. Each phase adds buttons instead of guiding the player toward one clear action. The result: decision paralysis, modal traps, and retention-breaking flows where Share or Coach overshadow Play Again.

## Design Principle

**Retention loop first.** Every post-game screen resolves to Play Again as the primary CTA. Share, Coach, and navigation are secondary. Only an explicitly justified milestone moment can elevate Share above Play Again.

---

## CTA Hierarchy System

Every screen follows this stack order (top = most prominent):

| Tier | Role | Visual Treatment | Example |
|------|------|-----------------|---------|
| **Primary** | The ONE action the screen wants the player to take | `variant="game-primary"` full-width, largest | Play Again, Claim Victory |
| **Secondary** | Valuable but not the main path | `variant="game-solid"` or `variant="game-ghost"` full-width, smaller text | Share, Ask Coach |
| **Tertiary** | Navigation / escape | `variant="game-text"` compact, no background | Back to Hub |

**Rules:**
- Max 1 Primary per screen.
- Max 2 Secondaries per screen.
- Tertiaries are always text-only links, never buttons with backgrounds.
- Prefer no more than 4 total interactive elements per screen (excluding inline social icons). This is a guideline — screens with justified complexity (e.g., social share rows) may exceed it, but each extra element should earn its place.

---

## Screen-by-Screen Changes

### 1. victory-celebration.tsx (Pre-Claim)

**Current state:** 3 equally-sized CTAs — Play Again, Claim Victory, Ask Coach.
**Violations:** #2 (multiple primaries), #8 (fragmented), #10 (ambiguous next step).

**Fix:**

| Tier | CTA | Notes |
|------|-----|-------|
| Primary | **Claim Victory** | Enlarged. Price subtext stays but gets `text-xs text-emerald-200/60` (clearer). This is the monetization moment — player just won, capture the emotion. |
| Secondary | Play Again | `variant="game-ghost"`. Always visible, never competes with Claim. |
| Tertiary | Back to Hub | `variant="game-text"` |

**Ask Coach:** Omitted from this screen by default. Coach belongs in the post-claim or post-loss flow, not pre-claim — showing it here splits attention at the moment of highest conversion intent. If a future iteration needs Coach here (e.g., as a learning nudge for players who decline Claim), it can be re-added as a tertiary text link, but never at the same visual weight as Claim or Play Again.

**Stats integration:** Move the 3 stat cards (difficulty, moves, time) ABOVE the trophy, as a compact inline row (`flex gap-2`). This creates a unified reward zone: stats → trophy → claim. One panel, not three sections.

---

### 2. victory-claiming.tsx (Transaction In-Progress)

**Current state:** Disabled button, no escape, no progress, 2 lines of generic text.
**Violations:** #2 (no CTA), #3 (CTAs vanish), #4 (info hidden), #6 (progress not felt), #12 (modal trap).

**Fix:**

**Progress indicator:** Replace generic text with a 3-step visual:

```
○ Signing → ● Confirming → ○ Done
```

- Use 3 small dots/circles with labels below, connected by a line.
- Active step pulses (`animate-pulse`). Completed steps get `text-emerald-400`. Pending steps stay `text-cyan-100/30`.
- The parent (`arena/page.tsx`) already tracks mint phase — pass the current step as a prop.

**Escape hatch:** Always render a "Back to Hub" tertiary link at the bottom so the player is never trapped in the modal.

**Technical check required before implementation:** Verify whether the current wallet/mint flow guarantees transaction recoverability if the player navigates away mid-claim. Specifically: does the parent component (`arena/page.tsx`) retain the pending tx hash and resume polling on re-mount? If yes, the escape copy can say `"You can leave — your NFT will arrive when confirmed."` If not, the escape copy should be neutral: `"Back to Hub"` with no promise about background completion. Do not ship a UX promise the code cannot keep.

**Time context:** Add a single line below the progress indicator: `"This usually takes a few seconds"` from editorial.ts.

| Tier | CTA | Notes |
|------|-----|-------|
| Primary | (none — progress indicator is the dominant element) | The screen's dominant state is "waiting" |
| Tertiary | Back to Hub | Always visible. `variant="game-text"`. Copy depends on recoverability check above. |

---

### 3. victory-claim-success.tsx (Post-Claim)

**Current state:** 6 CTAs — Share Card (gradient), social row (3 icons), View Trophies, Ask Coach, Play Again, Back to Hub. Share dominates.
**Violations:** #2 (multiple primaries), #7 (reward undersold), #8 (fragmented), #9 (giant buttons), #11 (share > retention).

**Fix:**

**Reward confirmation:** Add a visible confirmation badge below the title:

```
✦ Victory NFT Claimed
```

Styled as `text-sm font-semibold text-amber-400/80` with a subtle `border border-amber-400/15 rounded-full px-3 py-1` pill. This answers "what did I get?" before anything else.

**CTA stack (retention first):**

| Tier | CTA | Notes |
|------|-----|-------|
| Primary | **Play Again** | `variant="game-primary"`. Retention loop. Copy: `"Play Again"`. |
| Secondary (utility) | Share | Single compact row: social icons (X, WhatsApp, Copy) inline, NO full-width "Share Card" button. Icons use `h-9 w-9` frosted circles. Feels like a utility strip — functional, not promotional. |
| Secondary (engagement) | Ask Coach | `variant="game-ghost"`. Below share row. Visually quieter than share row — ghost button reads as "optional next" while share icons read as "quick utility". |
| Tertiary | Back to Hub | `variant="game-text"` |

**Share vs. Coach visual weight:** Share is a row of small icons (utility-level, low cognitive load). Ask Coach is a single ghost button with text (engagement-level, slightly more prominent as a concept but visually lighter). The net effect: Share is quicker to act on but doesn't demand attention; Coach is available but doesn't compete with Share or Play Again. They occupy different visual lanes — icon strip vs. text button — so they don't read as "two equally loud secondaries".

**Removed:** "View Trophies" button. Trophy vitrine is a future feature — linking to it now is a dead end. Remove until the feature exists.

**Removed:** Full-width gradient "Share Card" button. The social icon row replaces it — same functionality, less visual weight.

---

### 4. victory-claim-error.tsx (Error State)

**Current state:** Mostly clean. Minor issue with recovery clarity.
**Violations:** #6 (recovery path opaque).

**Fix:**

Add a one-line error context below the error message:

```
"Your game result is saved. You can try claiming again anytime."
```

From editorial.ts as `VICTORY_CLAIM_COPY.errorRecoveryHint`. This reassures the player that progress is not lost.

No CTA changes needed — hierarchy is already correct (Try Again > Play Again > Back to Hub).

---

### 5. coach-panel.tsx (Full Analysis)

**Current state:** Play Again and Back to Hub equally styled. No retention nudge.
**Violations:** #2 (dual primaries), #8 (fragmented sections), #10 (ambiguous next step), #11 (learning isolated from re-engagement).

**Fix:**

| Tier | CTA | Notes |
|------|-----|-------|
| Primary | **Play Again** | `variant="game-primary"`. Copy change: `"Play Again"` (keep simple — no "try with what you learned" fluff). |
| Tertiary | Back to Hub | `variant="game-text"` |

**Section consolidation:** The current 5-section layout (Summary, Key Moments, What You Did Well, Takeaways, CTAs) reads like a checklist. Consolidate:

- **Keep:** Summary (quoted box) — this is the hook.
- **Keep:** Key Moments (max 3, not 5) — actionable feedback.
- **Merge:** "What You Did Well" + "Takeaways" into a single "Takeaways" section with positive items marked with `✓` and improvement items marked with `→`. Reduces visual fragmentation.
- **Result:** 3 sections instead of 5. Reads as one unified review, not a report.

---

### 6. coach-fallback.tsx (Quick Review)

**Current state:** "Get Full Analysis" and "Play Again" both styled as primary. Paywall CTA competes with engagement.
**Violations:** #2 (dual primaries), #9 (overstyled paywall), #10 (unclear next step), #11 (paywall before retention).

**Fix:**

| Tier | CTA | Notes |
|------|-----|-------|
| Primary | **Play Again** | `variant="game-primary"`. Retention first — f2p players should feel encouraged, not paywalled. |
| Secondary | Get Full Analysis | `variant="game-ghost"` with emerald tint. Subtle upsell, not a wall. Copy: `"Unlock Full Analysis"`. |
| Tertiary | Back to Hub | `variant="game-text"` |

**Paywall tone:** The current "Get Full Analysis" with nested flex and price is overstyled. Simplify to a single-line ghost button: `"Unlock Full Analysis · $0.05"`. No nested layout, no giant button.

---

### 7. coach-loading.tsx (Analysis Pending)

**Current state:** Cancel is conditional (can vanish). No progress. 60s timeout feels abandoned.
**Violations:** #3 (CTA vanishes), #6 (no progress), #12 (broken pattern).

**Fix:**

**Always show cancel:** Remove the `{onCancel &&` conditional. Cancel button is always rendered. If no `onCancel` prop is provided, default to navigating back to the previous screen.

**Progress indicator:** Add an animated dot sequence or a simple percentage based on elapsed time vs. expected duration:

```
Analyzing your game...
[● ● ● ○ ○] ~10 seconds remaining
```

- Use 5 dots that fill over time (CSS animation, no JS timer needed).
- Below the dots: `"You can leave — your result will be ready when you return."` from editorial.ts.

| Tier | CTA | Notes |
|------|-----|-------|
| Primary | (none — loading state is dominant) | Progress animation is the focal point |
| Tertiary | Cancel | Always visible. `variant="game-text"`. |

---

### 8. coach-paywall.tsx (Credit Purchase)

**Current state:** 2 purchase options with identical styling. Value abstract ("credits"). "Or quick review" undercuts paywall.
**Violations:** #2 (dual options without hierarchy), #7 (value unclear), #10 (escape undercuts conversion).

**Fix:**

**Visual hierarchy between packs:**
- 5-credit pack: `border border-white/[0.08] bg-white/[0.03]` (current, muted)
- 20-credit pack: `border border-emerald-400/20 bg-emerald-500/[0.06] ring-1 ring-emerald-400/10` (highlighted, recommended). "BEST VALUE" badge stays.

**Value clarity:** Add a subtitle under each pack:
- 5 credits: `"5 game analyses"`
- 20 credits: `"20 game analyses"`

This converts abstract "credits" into concrete value.

**"Or quick review" link:** Keep it but demote to smallest possible text: `text-[0.65rem] text-cyan-100/30`. It's an escape hatch for f2p, but it should not compete with the purchase intent that brought the player here.

---

## Editorial Constants (New/Modified)

Add to `editorial.ts`:

```typescript
// victory-claiming.tsx
VICTORY_CLAIM_COPY.progressSteps: ['Signing', 'Confirming', 'Done']
VICTORY_CLAIM_COPY.progressTimeHint: 'This usually takes a few seconds'

// victory-claim-success.tsx
VICTORY_CLAIM_COPY.claimedBadge: 'Victory NFT Claimed'

// victory-claim-error.tsx
VICTORY_CLAIM_COPY.errorRecoveryHint: 'Your game result is saved. You can try claiming again anytime.'

// coach-loading.tsx
COACH_COPY.loadingCanLeave: 'You can leave — your result will be ready when you return.'

// coach-paywall.tsx
COACH_COPY.creditPackSubtitle: (n: number) => `${n} game analyses`
```

---

## CSS Changes

Prefer using existing Button variants (`game-primary`, `game-ghost`, `game-text`, `game-solid`) and existing design tokens. New CSS classes are acceptable if they reduce duplication or improve readability — e.g., a shared `.progress-dot` class is fine if the progress indicator pattern repeats across victory-claiming and coach-loading.

The progress indicator (victory-claiming, coach-loading) uses inline Tailwind or a shared class:
- Active dot: `h-2 w-2 rounded-full bg-emerald-400 animate-pulse`
- Pending dot: `h-2 w-2 rounded-full bg-cyan-100/20`
- Completed dot: `h-2 w-2 rounded-full bg-emerald-400`

---

## Suggested Implementation Order

Sequenced by impact and dependency:

| Phase | Screen | Why first |
|-------|--------|-----------|
| **1** | victory-claiming.tsx | Worst UX violation (modal trap). Unblocks the recoverability technical check. |
| **2** | victory-celebration.tsx | Highest conversion impact — CTA hierarchy at the monetization moment. |
| **3** | victory-claim-success.tsx | Completes the victory flow end-to-end once phases 1-2 are solid. |
| **4** | victory-claim-error.tsx | Smallest change (one copy line). Quick win after the victory flow is done. |
| **5** | coach-fallback.tsx + coach-panel.tsx | Same CTA hierarchy fix, can be done together. |
| **6** | coach-loading.tsx | Progress indicator + always-show-cancel. Independent of other coach screens. |
| **7** | coach-paywall.tsx | Lowest urgency — paywall polish, not a broken flow. |
| **8** | editorial.ts | New copy constants. Can be done incrementally alongside each phase, or batched at the start. |

Phases 1-4 (victory flow) should ship as a unit. Phases 5-7 (coach screens) can follow independently.

---

## Out of Scope

- Trophy Vitrine / Hall of Fame (future feature — "View Trophies" removed until it exists)
- Arena background consistency (separate spec: `2026-03-22-arena-visual-consistency`)
- Coach History screen (passes all 12 guardrails — no changes needed)
- Victory Share Page `/victory/[id]` (passes all 12 guardrails — no changes needed)
- Loss/Draw End-State (passes all 12 guardrails — no changes needed)
- Ask Coach Button component (passes all guardrails — no changes needed)

---

## Validation Criteria

Each fixed screen must pass all 12 guardrails:

1. One dominant state — no mixed contexts
2. One primary CTA — visually unambiguous
3. Secondary CTAs always accessible — no conditional rendering that hides escape paths
4. Key info visible — no hidden states or missing feedback
5. Design system — uses Button variants, not one-off styles
6. Progress felt — waiting states show visual progress
7. Reward and clarity first — what happened is clear before asking for action
8. Unified panel — stats, rewards, actions read as one block
9. Appropriate button sizing — primaries are prominent, secondaries are not giant
10. Clear next step — one obvious path forward
11. Retention loop first — Play Again above Share, Coach, and navigation
12. Proven UX structure — no modal traps, familiar patterns
