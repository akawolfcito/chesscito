# Candy Panel Propagation Candidates

**Date:** 2026-05-22
**Origin:** Post-redesign of `MissionBriefing` modal (`commit 267ad7ce`)
**Status:** Documentation only — no implementation yet.

## Context

The `MissionBriefing` modal at `apps/web/src/components/exercises/mission-briefing.tsx` was redesigned to use a cream-wood candy panel with a baked-in grass border, a hero avatar with gold ring, bold dynamic objective, lighter secondary hint, compact PLAY CTA, crown adorno divider, and a secondary escape link.

Assets shipped with the redesign live in `apps/web/public/art/screen-mission/`:
- `panel-mision-icon.png` — full panel background (cream wood + grass border)
- `avatar-icon.png` — wolf avatar with gold ring baked in
- `adorno-icon.png` — crown divider strip
- `close-icon.png` — red disc with white X (already in use across all sheet headers)

This document maps the screens that follow a similar "hero ceremony" shape — modals/overlays where the player meets a character, reads a bold result/intent message, taps a single primary CTA, and may take a secondary escape — and would benefit from the same visual treatment.

## Visual capture — existing VR baselines

The repo already ships VR baseline PNGs at `apps/web/e2e-results/snapshots/`
(local-only, no CI gate). Open each PNG directly to see the **current** state
of every candidate. Use these as the "before" reference when designing the
candy-panel redesign.

| Candidate | Current baseline (opens in any image viewer) | Status |
|---|---|---|
| MissionBriefing (reference, already redesigned) | — | post-redesign capture pending |
| PieceCompletePrompt | `apps/web/e2e-results/snapshots/candy-shell-piece-complete.png` | ✅ baseline exists |
| BadgeEarnedPrompt (sibling of PieceComplete) | `apps/web/e2e-results/snapshots/candy-shell-badge-earned.png` | ✅ baseline exists |
| Mission detail sheet (visual reference for piece-aware iconSlot) | `apps/web/e2e-results/snapshots/candy-shell-mission-detail.png` | ✅ baseline exists |
| WelcomeOverlay (first-visit onboarding) | — | ❌ needs capture |
| ResultOverlay (success variants) | `apps/web/e2e-results/snapshots/share-modal-badge.png` (related) | ⚠️ partial — direct ResultOverlay capture missing |
| VictoryCelebration (full arena win) | `apps/web/e2e-results/snapshots/victory-page.png` (related share page) | ⚠️ no in-game modal capture |
| VictoryClaim — error | `apps/web/e2e-results/snapshots/error-boundary-victory.png` | ✅ baseline exists |
| VictoryClaim — success / claiming | — | ❌ needs capture |
| MiniArenaResultCeremony — loss | `apps/web/e2e-results/snapshots/arena-loss-modal.png` | ✅ baseline exists |
| MiniArenaResultCeremony — won | `apps/web/e2e-results/snapshots/arena-loss-or-state.png` | ⚠️ verify variant |
| LabyrinthCompleteOverlay | — | ❌ needs capture |

**Other useful baselines on disk** (for context — sheets that already got the `iconSlot` treatment in commit `a5a0f399`, so these are pre-`iconSlot` references):

- `sheet-badges.png` — BadgeSheet pre-iconSlot
- `sheet-shop.png` — ShopSheet pre-iconSlot
- `sheet-trophies.png` — TrophiesSheet pre-iconSlot
- `sheet-leaderboard.png` — LeaderboardSheet pre-iconSlot
- `pro-sheet.png` — PRO sheet pre-iconSlot
- `play-hub.png`, `landing.png`, `arena.png`, `about.png`, `trophies.png` — page-level baselines
- `arena-selector-with-dock.png`, `share-modal-invite.png`, `why.png` — misc surfaces

### Capturing the missing baselines

For the surfaces marked ❌, run from `apps/web/`:

```bash
pnpm test:e2e:visual
```

The Playwright config picks up `e2e/visual-regression.spec.ts` and
`e2e/candy-shell-previews.spec.ts` which orchestrate the captures. New surfaces
need a fresh spec or a new case inside `candy-shell-previews.spec.ts`. Per
MEMORY.md, the existing fixture pattern lives under `apps/web/src/app/dev/`
(currently: `tx-progress`, `persist-overlay`, `coach-history`); add `/dev/welcome`,
`/dev/piece-complete`, `/dev/result-overlay`, `/dev/labyrinth-complete`,
`/dev/victory-celebration` fixtures so each modal can be captured without
needing actual gameplay/wallet/contract state.

> **Note for the next session:** the post-redesign MissionBriefing baseline
> doesn't exist yet — capture it next so the visual contract is locked
> before any propagation begins.

## Candidates

### Tier 1 — Hero ceremonies (highest visual return)

#### 1. `PieceCompletePrompt`
- **File:** `apps/web/src/components/exercises/result-overlay.tsx:536` (lives inside `result-overlay.tsx`, exported separately).
- **Trigger:** Player completes the final exercise of a piece and earns the badge eligibility. Rendered from `exercises-screen.tsx:1837` after `setShowPieceComplete(true)`.
- **Current shell:** wraps `CandyGlassShell` inside a `fixed inset-0 candy-modal-scrim` portal.
- **Content:** title (PIECE_COMPLETE_COPY.title) + dynamic subtitle (next-piece, keep-practicing, or final) + 3-4 CTAs (`Next piece`, `Practice again`, `Arena`, optional `Try labyrinth`, optional `Submit score`).
- **Redesign mapping:**
  - Panel: same `panel-mision-icon.png`
  - Avatar: piece icon (`PIECE_IMAGES[pieceType]`) inside the same gold-ring asset, OR new piece-with-crown variant
  - Title: text "Piece Complete!" (no asset)
  - Objective: subtitle (PIECE_COMPLETE_COPY)
  - Primary CTA: `Next piece` (or `Practice again` if final)
  - Crown adorno divider
  - Secondary: `or play Arena vs AI`
- **Caveats:** 3+ CTAs — would need stacking or demoting some to text-links below the crown adorno. The existing flow is "primary + meta links" which is the cleanest fit.
- **Why first:** Direct mirror of MissionBriefing (briefing = entry, complete = exit). Same narrative arc, same visual contract.

#### 2. `WelcomeOverlay`
- **File:** `apps/web/src/components/welcome/welcome-overlay.tsx`
- **Trigger:** First-visit fresh wallet on `/play-hub`. Gated by `chesscito:welcome-dismissed` localStorage flag + `useOnboardingSignal` (PRO/badge/shield/founder reads).
- **Current shell:** 3-card carousel inside `CandyCard`s, with `CandyIcon` glyphs (trophy, coach, crown).
- **Content:** 3 slides → each: glyph + title + body. Persistent `[Skip]` link.
- **Redesign mapping:**
  - Panel: same `panel-mision-icon.png` (per slide)
  - Avatar: per-slide → could reuse existing `CandyIcon` (resize) OR commission 3 new raster icons (trophy, coach, crown) matching the candy aesthetic
  - Title: slide title (text)
  - Body: slide body (text)
  - Primary CTA: `Next →` (or `Start playing` on slide 3)
  - Crown adorno
  - Secondary: `Skip` link
- **Caveats:** carousel state (current slide index) needs to live above the panel; transitions between slides should not re-mount the panel asset to avoid background-image flicker.
- **Why high:** the first modal every new player sees. Maximum onboarding impact.

#### 3. `ResultOverlay` (success variants only)
- **File:** `apps/web/src/components/exercises/result-overlay.tsx:1`
- **Trigger:** Post-exercise success (badge earned, score saved, shop purchase confirmed). Variants: `badge`, `score`, `shop`, `error`.
- **Current shell:** `CandyGlassShell` with `Lottie` confetti + variant-specific imagery.
- **Content:** variant-specific title + subtitle + share row + `Continue` CTA.
- **Redesign mapping:** success variants (`badge`, `score`, `shop`) → candy panel + variant avatar + bold title + share + CTA + crown + secondary `Back`. Error variant stays separate (different visual treatment — rose/amber accent, not celebratory).
- **Caveats:** confetti Lottie should layer ABOVE the panel asset (z-index dance).
- **Why high:** highest-frequency ceremony in the game — every successful exercise hits this.

#### 4. `VictoryCelebration`
- **File:** `apps/web/src/components/arena/victory-celebration.tsx`
- **Trigger:** Checkmate vs AI in `/arena`. Drives the optional `MintVictoryNFT` flow.
- **Current shell:** Custom layout with `CandyBanner`, `ContextualHeader`, `PaperStatCard`, Lottie sparkles + trophy.
- **Content:** title (`Checkmate!`) + stats (moves, time, difficulty) + share + 2 primary CTAs (`Play again`, `Mint your Victory`) + secondary `Back to Hub`.
- **Redesign mapping:**
  - Panel: same `panel-mision-icon.png`
  - Avatar: trophy/king icon raster
  - Title: `Checkmate!` (text)
  - Hero stats: PaperStatCard intact (sits inside panel)
  - Primary CTA: `Mint your Victory` (or `Play again` if mint not available)
  - Crown adorno
  - Secondary: `Back to Hub`
- **Caveats:** richest content of all candidates (stats card + dual CTAs). May require a taller panel variant or content reduction.
- **Why high:** ceremonial peak of the arena flow. Drives NFT minting conversion.

#### 5. `LabyrinthCompleteOverlay`
- **File:** `apps/web/src/components/exercises/labyrinth-complete-overlay.tsx`
- **Trigger:** Player reaches target in an L2 labyrinth. Computed via `labyrinthStars()`.
- **Current shell:** `CandyGlassShell`.
- **Content:** celebratory headline + stars + moves vs optimal + 2 CTAs (`Retry`, `Back to Exercises`).
- **Redesign mapping:** small modal version — panel + star burst avatar + headline + moves comparison + primary `Retry` + crown + secondary `Back`.
- **Caveats:** content is dense; the stars row + moves narrative may need to compress to fit the panel proportions.

### Tier 2 — Transactional ceremonies (mint flow states)

These three share state: they sequence the Victory NFT mint flow. Worth treating as a set so the look stays continuous as the user moves Claiming → Success / Error.

#### 6. `VictoryClaimSuccess`
- **File:** `apps/web/src/components/arena/victory-claim-success.tsx`
- **Trigger:** EIP-712 signed + on-chain confirmed mint.
- **Content:** "Victory minted!" + tx hash chip + `View on Celoscan` link + share row + `Back` CTA.
- **Redesign mapping:** panel + trophy-with-NFT-glow avatar + bold "Victory minted!" + tx hash + `View receipt` link + `Back to Hub`.

#### 7. `VictoryClaiming`
- **File:** `apps/web/src/components/arena/victory-claiming.tsx`
- **Trigger:** Active mint tx (signing or waiting for receipt).
- **Content:** progress steps + estimated time.
- **Redesign mapping:** panel + spinning trophy avatar + `Minting your Victory…` + step pill (sign / wait) — no primary CTA (disabled until success/error transitions in).

#### 8. `VictoryClaimError`
- **File:** `apps/web/src/components/arena/victory-claim-error.tsx`
- **Trigger:** Mint tx revert, signature rejected, or insufficient funds.
- **Content:** error reason + `Retry` CTA + `Cancel` secondary.
- **Redesign mapping:** panel + warning avatar (NOT celebratory) + bold error title + cause + `Retry` CTA + crown + secondary `Cancel`. Note: keep the rose/amber error palette accents, not the cream-celebratory feel.

#### 9. `MiniArenaResultCeremony`
- **File:** `apps/web/src/components/mini-arena/mini-arena-result-ceremony.tsx`
- **Trigger:** Mini-arena (e.g. K+R vs K endgame) reaches terminal state.
- **Content:** title (`Checkmate!` / `Try Again`) + moveCount vs par + stars + `Share` / `Retry` / `Close` CTAs.
- **Redesign mapping:** panel + piece (rook PNG already used) + bold title + stats + `Retry` + crown + share / close. Same mold as `VictoryCelebration` but for mini-arena.

### Tier 3 — Skip

These have valid reasons NOT to adopt the candy panel:

- **`ShareModal`** (`components/share/share-modal.tsx`) — utility (copy URL, download card). The candy-ceremony shell would over-elevate a copy-paste action.
- **`CoachPaywall`** (`components/coach/coach-paywall.tsx`) — lives inside a `Sheet` with a `ContextualHeader close-control` (already got its `iconSlot` in commit `a5a0f399`). Not a modal-over-game.
- **`PurchaseConfirmSheet`** — same reason (sheet, not modal hero).
- **Existing AUX sheets** (Daily, Shop, Trophies, Leaderboard, Badge, etc.) — they're full-height sheets with headers, not hero modals. The `iconSlot` change in commit `a5a0f399` already anchored them visually.

## Suggested execution order

1. **`PieceCompletePrompt`** — direct mirror of MissionBriefing; lowest design risk; high narrative coherence.
2. **`ResultOverlay`** — highest frequency, biggest aggregate impact.
3. **`WelcomeOverlay`** — first impression for new players; needs 3 new slide avatars or reused glyphs.
4. **`VictoryCelebration` + claim states** — treat the 4 mint flow screens (`VictoryCelebration`, `VictoryClaiming`, `VictoryClaimSuccess`, `VictoryClaimError`) as a single propagation step so the look is continuous.
5. **`MiniArenaResultCeremony`** — small surface, low risk, finishes the set.
6. **`LabyrinthCompleteOverlay`** — last; dense content may push us to design a "compact" panel variant.

## Asset gaps to flag before propagation

The current `screen-mission` asset set assumes a **wolf avatar**. The candidates above need different avatars depending on context:

- **PieceCompletePrompt** — piece icon (rook/bishop/knight/pawn/queen/king). Can reuse existing `PIECE_IMAGES` rasters inside the existing gold ring? Or commission a "piece-with-medal" variant.
- **WelcomeOverlay** — 3 slide avatars (trophy / coach / crown candy raster).
- **ResultOverlay** — variant icons (badge ribbon / star burst / treasure chest).
- **VictoryCelebration / mint states** — trophy raster + spinning trophy + warning shield.
- **MiniArenaResultCeremony** — same piece icon as PieceComplete probably.
- **LabyrinthCompleteOverlay** — labyrinth/maze raster (already exists at `/art/new-icons-chesscito/laberinto.png`).

If we choose to keep the **same wolf** across all hero modals (treating it as the game's narrator), no new assets needed and the propagation becomes pure layout work. Worth a design call before any implementation.

## Effort estimate

- Per modal: ~1.5–2 hours each (layout port + CSS tuning + test updates).
- Total Tier 1: ~8 hours.
- Total Tier 2: ~6 hours (4 screens sharing the mint flow set).
- Total Tier 3 (LabyrinthComplete only): ~2 hours.
- **Grand total: ~16 hours of focused work** across all candidates.

## Cross-references

- Reference implementation: `apps/web/src/components/exercises/mission-briefing.tsx` (commit `267ad7ce`)
- iconSlot primitive: `apps/web/src/components/ui/contextual-header.tsx` (commit `29b5390b`)
- Asset close button shared globally: `apps/web/src/app/globals.css:556` `.candy-close-asset-button`
- Tile-icon helper for sheet headers (parallel pattern): `apps/web/src/components/ui/tile-icon-slot.tsx`
