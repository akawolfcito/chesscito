# Spec — Play Kingdom Hub unification

**Date:** 2026-07-07
**Status:** revised (P0s resolved from red-team v1)
**Cluster:** MiniPay listing feedback → "full→play simplification" (thread 3)
**Naming decision:** "Play Kingdom" (unifies with existing `kingdom/` code namespace + `KingdomAnchor` art).

## Goal
Rebuild the PLAY hub so it shares the LEARN/LITE hub's visual system and vocabulary,
matching reference Image 1. Reuse existing primitives; do not invent a parallel look.
Rename the user-facing "Arena" narrative → **Play Kingdom** (route `/arena` stays internal).

## Source system
`hub-lite-scaffold.tsx` is the closest reference to Image 1. PLAY mirrors its zones.

## Component mapping (PLAY ← reuse)
| Zone | Reuse from | PLAY content |
|------|-----------|--------------|
| Header HUD | LITE `hub-lite-hud` grammar (`candy-tray-pill hub-hud-pill`) | trophy · Language · (Connect for guest) · `HubProBadge` — as today/Image 1 |
| Mascot | **`KingdomAnchor variant="playhub"`** (already in PLAY) | portal + wizard avatar + gold ring. **P1-1 resolved:** KingdomAnchor is canonical — it already swaps the PRO avatar via `useThemeAsset`+`useIsProActive` (`kingdom-anchor.tsx:84-91,161-172`). Do NOT copy LITE's manual `avatar-pro`/`avatar-lite-hub` pictures. |
| Switch | `AppModeSwitch activeMode="play"` (already shared) | TRAINING \| PLAY |
| Panel | new `KingdomCard`, modeled on `ChallengeCard` candy-panel styles | "Play Kingdom" + PRO chip + 2-line body + footer row (see below) |
| Primary CTA | `hub-lite-start-focus` slot → `PrimaryPlayCta` (blue dominant) | **Play Chess** → `/arena?fresh=1` (already wired in `play-hub-client.tsx`). **P1-2 resolved:** NO gold ring on PLAY (the LITE `ring-start-focus` asset is authored for the green Start Focus button; misfits the blue `PrimaryPlayCta`). |
| Tools section | `hub-lite-training-path` layout + a new square tile style | **CHESS TOOLS**: Tactics · Coach (PRO) · Shop |

### Panel (`KingdomCard`) — ref Image 2
- **Crest icon:** reuse `/art/redesign/banners/btn-battle` (crossed swords, png+webp+avif confirmed). NO new asset.
- Title: `Play Kingdom`
- Body (2 lines, identical in all states): "Play matches, sharpen tactics, and improve with Coach."
- Footer row (3 inline items w/ icons, mirror `challenge-card-stats`): **Quick Match · Coach Review · Rewards** — these ARE the benefits/details surfaced to everyone (P0-2).
  - Quick Match → static info (reads as a feature, not a CTA — a noun-phrase, no tap).
  - Coach Review → static info; carries a subtle PRO marker (Coach is PRO-gated).
  - Rewards → static info (victories/trophies).

#### Panel states (P0-2 resolved)
The panel is the SAME in both states (arena is free-to-all — never a paywall). Only the chip differs:
| State | Top-right chip | Body + 3 footer benefits |
|-------|----------------|--------------------------|
| PRO active | green **"PRO active"** (non-interactive, matches `challenge-card-active-chip`) | identical |
| Non-PRO | **"PRO" discovery pill** — tappable, fires `onProTap` → opens PRO sheet (same discovery pattern as `HubProBadge` inactive; `pro-recognition-pattern`) | identical |

No separate "Get PRO" button. Non-PRO users see the full value (title + body + 3 benefits) with the
"PRO" chip as the only discovery affordance. `pro.active` drives the branch; loading → non-PRO default,
panel height fixed (no flash).

### CHESS TOOLS section (P0-3 resolved — no new nav contract)
The 3 tiles KEEP their current behavior; only their visual/layout changes to the square grid:
- **Tactics** → keep `<PlayTacticsTile />` self-contained (owns its own sheet + `PLAY_TACTICS_COPY` +
  done-badge). It already accepts `className`; restyle via a new square class. NO `onTacticsTap` needed.
- **Coach** → existing `onCoachTap` prop (PRO badge). No change to wiring.
- **Shop** → existing `onShopTap` prop. No change to wiring.
- Section header: "CHESS TOOLS" with the ⟡ divider ornament (mirror LITE `hub-lite-training-path-label`).
- **P1-3 resolved:** do NOT reuse `.reward-tile` (piece-specific + 4 dead states). Add a new
  `.kingdom-tool-tile` square class in **`apps/web/src/styles/hub.css`** (PLAY-surface sheet, per CLAUDE.md
  P4 CSS split), NOT `globals.css`.

## Naming rename table (P0-1 resolved — bounded + grep-verified)
| Key | File:line | Current | Action |
|-----|-----------|---------|--------|
| `PLAY_HUB_COPY.arenaLabel` | editorial.ts:3273 | "PLAY CHESS" | **keep** (CTA label) |
| `PLAY_HUB_COPY.arenaAriaLabel` | editorial.ts:3274 | "Enter Arena: full chess vs AI" | → "Play Chess: full chess vs AI" |
| `PLAY_HUB_COPY.victoriesAriaLabel` | editorial.ts:3268 | "Minted Arena victories: {count}" | → "Minted victories: {count}" |
| NEW `PLAY_HUB_COPY.*` | — | — | add: `kingdomPanelTitle`, `kingdomPanelBody`, `kingdomProActiveChip`, `kingdomProDiscoverChip`, `quickMatchLabel`, `coachReviewLabel`, `rewardsLabel`, `chessToolsLabel` |
| `PLAY_TACTICS_COPY` "Arena warm-up"/arias | editorial.ts:3279-3285 | "Arena warm-up" | → "Play Kingdom warm-up" (vocabulary unification; low-risk, PLAY-only) |
| **`SECONDARY_CTA_COPY.arena.*`** | editorial.ts:3163-3164 | "Enter Arena" | **DO NOT TOUCH** — consumed by FULL hub chevron (`hub-scaffold.tsx:407-418`), out of scope |
| **`enterArena`** | editorial.ts:1346 | "Enter Arena" | **DO NOT TOUCH** — arena-page/other consumer, out of scope |

All PLAY_HUB_COPY / PLAY_TACTICS_COPY changes land in **editorial.ts + messages/en.ts + messages/es.ts**
simultaneously ([[feedback_i18n_key_parity]]); es.ts already has a PLAY_HUB block (`:1780`) — extend it.
No em/en-dashes (anti-ai-prose). Switch label stays "PLAY".

## Acceptance criteria (per-state, testable)
- [ ] PRO active: panel shows green "PRO active" chip (non-interactive); avatar renders PRO variant.
- [ ] Non-PRO: panel shows tappable "PRO" chip → firing it calls `onProTap`; body + 3 benefits still render.
- [ ] Guest (not connected): Connect chip visible in HUD; Play Chess CTA still routes to `/arena?fresh=1`.
- [ ] CHESS TOOLS renders 3 square tiles; Tactics keeps its done-badge + self-opens its sheet; Coach fires
      `onCoachTap`; Shop fires `onShopTap`.
- [ ] Panel height is constant across loading/PRO/non-PRO (no flash/resize).
- [ ] No blanket "Arena" rename: `SECONDARY_CTA_COPY.arena` + `enterArena` unchanged (grep asserts).
- [ ] Typecheck clean; `play-hub-scaffold` unit test updated; VR baselines (PRO/non-PRO/guest) refreshed same PR.

## Phase 2 (separate commit/PR after Phase 1 lands)
1. Add Account entry (LITE `hub-account-circle` grammar + `useAccount`/PRO derivation + route to
   `/exercises?sheet=account`) to the `/arena?fresh=1` surface (`arena-select-scaffold.tsx` header).
2. Remove PIECES button from WARM UP modal (Image 3).
   - **Verify first:** `soft-gate-sheet.tsx` already renders only the Enter button (`onLearn` is dead).
     Image 3's two-button layout likely lives in `arena-entry-panel.tsx` — confirm the live component
     before editing; the work may already be partly done.

## Out of scope
- No route rename (`/arena` stays). No new art assets (crest reuses `btn-battle`). No FULL-hub changes.
  `SECONDARY_CTA_COPY.arena` / `enterArena` untouched. Desktop not a priority (mobile-first 390px).

## Verification
- Typecheck clean; unit tests updated; VR refreshed; drive the PLAY hub in a real 390px viewport before commit.
