# SPEC 1 — Hub Redesign: Destinations & Profile

**Date:** 2026-05-18
**Status:** Brainstorming → Red-team applied → Implementation Planning
**Scope:** Hub layout + Profile modal + Claim Queue + Trophies port + Anchor asset cleanup + V2 retirement
**Out of scope (separate specs):** SPEC 2 — Shop Unification + Cosmetic Variants + cross-device display-name persistence (SIWE). SPEC 3 — Coach Moments NFT.
**Red-team report:** `docs/reviews/2026-05-18-spec-1-hub-redesign-red-team.md` (6 P0 + 12 P1 + 9 P2 — all P0/P1 applied here).

---

## Context & motivation

The current `/hub` exposes only one training arc (Practice Pieces) as a primary destination. Daily Tactic, Mate endgames (mini-arena), and Labyrinths already exist in `/exercises` but are hidden two taps deep behind the "Practice Pieces" funnel. The HUD chips for Trophies and Coach are read-only info — neither leads to an action that creates perceived on-chain value.

The "Account" sheet (today buried inside `/exercises` dock) displays wallet/network/PRO as bare cards, off the candy aesthetic, with no identity, no progression visibility, and no path to claim pending on-chain value (badges ready, scoreboard scores pending).

A second strategic issue: Chesscito's audience is **training-first** — beginners learning chess and adults seeking cognitive exercise (anti-neurodegenerative angle). Today's HUB promotes "PLAY ARENA" as the single dominant CTA, which is inverted: competition is the graduation destination, not the entry.

---

## Goals

1. **Surface all training destinations** as first-class HUB entries (Daily, Mate, Labyrinth) — no longer buried in Practice Pieces.
2. **Reframe the HUB's intent** to "training base" — Hero CTA promotes the next training step, Arena is a calm secondary shortcut.
3. **Eliminate read-only HUD chips** — Trophies and Coach become actionable (claim CTA / coach action).
4. **Replace the bare Account sheet** with a Profile modal that conveys identity, progression, and a unified Claim Queue.
5. **Port the Trophies page** to the candy aesthetic (keep page + sheet as intentional dual surfaces — page for external links, sheet for in-hub navigation; same body).
6. **Fix the anchor asset bug** — HUB renders `portal-centered` via CSS background while `<picture>` for `splash-loading` is hidden by `opacity:0`. Unify to `portal-centered` via the React `<picture>` path (proper AVIF/WEBP), drop the CSS background.
7. **Establish the Claim Queue pattern** — elegant CTAs, never auto, web-graceful, single reusable component, **individual claims only in v1** (no batching).
8. **Retire V2 canary** — `hub-scaffold-v2-client.tsx` has diverged from the training-first direction; unship to halve the implementation surface.

---

## Non-goals (deferred)

- **Move PRO subscription into Shop** → SPEC 2.
- **Cosmetic NFTs** (board/piece skins, avatar variants) → SPEC 2.
- **Coach Moments NFT** (transferable game highlights mintable from Coach analysis) → SPEC 3.
- **PRO puzzle catalog** (Knight's Tour, non-capture, cross-board) → content drop, not part of SPEC 1 (HUB only reserves the slot).
- **Cross-device display-name persistence** (SIWE-signed endpoint, profiles table) → SPEC 2. v1 uses localStorage only.
- **Avatar picker UI** → SPEC 2.
- **"Claim all" batching** (requires multicall primitive) → SPEC future once on-chain primitive exists.
- **Mini-arena streak counter** → SPEC future (current `mini-arena-progress.ts` stores only per-setup best move counts; streak is a new storage shape).
- **Daily Tactic countdown** ("Nh left" live ticker) → polish pass after v1; v1 uses static copy.
- **Settings sheet full content** (theme/haptics/language toggles) → sub-spec; v1 ships a stub only.

---

## Decisions

### D1. Mental model: "training home base"

The HUB asks the player **"what's your next training move?"** and surfaces 1 contextual Hero CTA + 6 ambient tiles (3 LEARN + 3 UNLOCK). Arena is always available via a small calm secondary CTA — never promoted, never gated.

### D2. Audience reframe

- **Primary:** beginners + cognitive-exercise audience (anti-neurodegenerative mission).
- **Secondary:** chess-literate players who want to skip to Arena.
- **Implication:** training metaphors throughout, leaderboard defaults to "Puzzles this week" (inclusive metric), Arena is graduation not entry.

### D3. Layout — Approach A (Stacked Rails)

Three zones:

- **HUD (top):** avatar (→ Profile), Trophies chip (count + claim CTA), PRO chip (active days or upsell), Coach chip (action).
- **Body (3 columns):**
  - LEFT rail `LEARN` — vertical stack: Daily Tactic (red dot badge if pending), Mate Endgame (K+R label), Labyrinth (star count).
  - CENTER — KingdomAnchor (portal-centered.png, decorative, no tap).
  - RIGHT rail `UNLOCK` — vertical stack: PRO content drop tile (names current PRO puzzle), Shop spotlight, Badge progress.
- **Footer:**
  - Hero CTA (amber, contextual — see D4).
  - Secondary CTA (small blue "Enter Arena →", always visible — see D5).
  - Persistent dock (5 slots — see D7).

### D4. Hero CTA — contextual training-first (3 states, was 4)

A single amber primary CTA whose label/destination/sub-copy rotates based on player state, computed by a **new** pure helper `getHeroContextAction(state) → HeroCTA` in `lib/hub/hero-cta.ts` (separate from the existing in-exercise `getContextAction` in `lib/game/context-action.ts` — different domains, must not share union).

| State | Trigger | Label | Sub | Destination |
|---|---|---|---|---|
| **new-player** | 0 exercises completed AND 0 daily history | START WITH PIECES | "learn the rook first" | `/exercises?piece=rook` |
| **daily-pending** | Today's daily not solved (`isCompletedToday()` false) | PLAY TODAY'S TACTIC | "today's tactic awaits" | `/exercises?slot=daily` |
| **default** | All training caught up OR signals still loading | CONTINUE TRAINING | "tap a tile to pick" | scrolls/highlights LEARN rail; no nav |

**Priority:** `new-player > daily-pending > default`. **Loading state:** render `default` (CONTINUE TRAINING) until all 3 signals resolve — never flash `new-player` while data is loading (P1-7 resolution).

**`mate-streak` dropped from v1:** the data source for streak detection does not exist in current `mini-arena-progress.ts` (per-setup best move count only). Mate lives in the LEARN rail where users tap it explicitly. Hero promotion of mate returns in a future SPEC alongside the streak counter feature.

### D5. Secondary CTA — Arena always visible

A small blue text-link-style CTA `Enter Arena →` immediately below the Hero. Always present, never promoted, no badge, no nag. Visually subordinated (50% the height of Hero, calm blue, not gradient candy). Wallet disconnect: tap proceeds to `/arena`; the existing Arena gate handles the wallet flow (no special hub-side logic needed). Single source: `<SecondaryCta surface="arena">`.

### D6. HUD chips — actionable, not info

| Chip | Tap action | Notif-dot logic |
|---|---|---|
| **Avatar** (top-left) | Opens Profile modal (`/hub?sheet=profile`) | Shows total pending claims count |
| **Trophies** | Opens Trophies sheet (`/hub?sheet=trophies`); if pending scoreboard saves exist, label becomes "Save N pts" instead of count | Red dot if any unsaved score |
| **PRO** (active) | Opens PRO sheet (`/hub?sheet=pro`) → days remaining + manage. See D6.1. | None |
| **PRO** (inactive) | Opens PRO sheet → upsell with current monthly drop | None |
| **Coach** | Opens Coach sheet → "Browse history" in v1 (no analyze-ready signal exists yet) | **Dormant in SPEC 1.** SPEC 3 wires the trigger when Coach Moments detects a notable game. |

### D6.1 PRO chip behavior during SPEC 1 → SPEC 2 migration

SPEC 1 keeps `?sheet=pro` opening `<ProSheet>` (current behavior, no change). SPEC 2 will introduce a redirect `?sheet=pro → ?sheet=shop&item=pro` when PRO becomes a Shop item. External deep-links remain stable across the migration.

### D7. Dock taxonomy (5 slots)

| Slot | Destination | Notes |
|---|---|---|
| **Home** | `/hub` | Active state when on hub |
| **Pieces** | `/exercises` | Practice piece arc |
| **Shop** | `/hub?sheet=shop` | Commerce (PRO moves here in SPEC 2) |
| **Board** | `/hub?sheet=leaderboard` (or `/leaderboard`) | Default tab: "Puzzles this week" (D11) |
| **Settings** | `/hub?sheet=settings` (new STUB sheet) | v1 shows version chip + back button + future toggles rendered `disabled` with "Coming soon" tooltip. Full settings = own sub-spec. |

**Removed from dock:** Badges (lives in Profile + HUD trophy chip flow), Trophies (lives in HUD chip + sheet), Account (lives in HUD avatar → Profile), Invite (future SPEC), Free Play (Hero CTA covers it).

**Profile is NOT in the dock** — the HUD avatar is its single entry point. Avoids duplication and signals identity prominence.

### D8. Trophies — port page to candy aesthetic, keep dual surfaces

The earlier proposal to collapse `/trophies` page into a redirect is reversed (red-team P1-1). External bookmarks deserve a real landing surface with back-button, scrim, and header — not a hub overlay opened sideways.

**Final shape:**
- `app/trophies/page.tsx` stays as a standalone page. Visual port to candy aesthetic (use `<TrophiesBody>` inside a candy-styled wrapper matching `sheet-bg-hub` palette so the page no longer reads as off-line graphically).
- `<TrophiesSheet>` continues to exist for in-hub navigation (HUD chip + future surfaces). Shares `<TrophiesBody>` — no duplication.
- HUD trophy chip → opens the sheet (in-hub stays in-hub).
- External bookmark → lands on the page (real header, real back).

Two surfaces, one body. Both candy-aligned after the port. No redirect.

### D9. Profile modal (replaces Account sheet)

Triggered by HUD avatar tap. URL: `/hub?sheet=profile`. Structure:

1. **Banner (blue gradient, top)**
   - Avatar (64px circle, wizard wolf default, editable pen icon for **name-only** in v1 — picker for the avatar image itself is SPEC 2 with separate affordance).
   - Display name (default = truncated wallet `0x0924…eba4`, or Talent Protocol identity if available). Tapping the pen icon opens a small edit dialog with text input + Save/Cancel — no inline-editing (avoids keyboard layout shifts in MiniPay WebView). **Custom name persisted in localStorage only** (`chesscito:display-name:{address}`). Cross-device persistence requires SIWE + profiles table — deferred to SPEC 2.
   - Tier title (computed: `Apprentice → Trainee → Knight → Wizard → Grandmaster`).
   - Wallet truncated (monospace).
   - XP badge (top-right, computed numeric).
2. **Pending Claims section** (band header + claims card) — **individual claims only in v1**
   - One row per pending claim (icon + label + cost estimate + green "Claim" button).
   - **No "Claim all"** in v1 — multicall primitive does not exist in current contracts (badges + scoreboard are single-tx only). Batching returns when multicall ships.
   - Empty state: hidden (the section + band do not render if claims.length === 0).
   - "Refresh" affordance at top of section + auto-refresh on Profile open (dedup invariants — see D10).
3. **General Stats grid** (band header + 3x2 grid, **always rendered** even at 0 values for consistent profile shape)
   - Pieces Mastered (X / 6) — count of exercise arcs completed past threshold
   - Daily Streak (current days) — from `lib/daily/progress.ts`
   - Puzzles Solved (cumulative) — sum across exercises + daily + mate
   - Arena Wins (cumulative) — from victory NFT history
   - Trophies (cumulative) — from scoreboard
   - NFTs Minted (cumulative) — victory NFTs (+ coach NFTs when SPEC 3 ships)
4. **PRO banner** — purple gradient: active days + "Manage" → opens PRO sheet (later: deep-link into Shop per D6.1)
5. **Wallet / Network cards** — collapsed-style subdued rows
6. **Disconnect link** — small, low-emphasis bottom of modal

### D10. Pending Claims queue (the value layer)

**Principles:**
- **Never auto-launch a tx.** Every claim is user-initiated via explicit CTA.
- **No batching in v1.** One row = one tx prompt = one MiniPay confirm. Multicall ships later.
- **Notification dot is the persistent signal.** Lives on avatar (HUD top-left) + Trophies chip (when score pending).
- **Web-graceful.** No wallet → CTA becomes "Connect wallet to claim" chip; never errors.
- **Single source.** `lib/claims/queue.ts` computes; `<PendingClaims>` renders.

**Claim kinds in v1:**
| Kind | Trigger condition | Cost | Action |
|---|---|---|---|
| `badge` | Exercise score crossed badge threshold, no on-chain mint yet | gas only | Calls `badges.claim(badgeId)` |
| `score` | Local exercise score not synced to scoreboard | gas only | Calls `scoreboard.save(scoreData)` |
| `victory-nft` | Arena win in last 24h and not yet minted (stored in localStorage `chesscito:victory-pending:{txHash}`) | $0.005–$0.02 | Routes to existing victory mint flow (no auto, no batching since it's paid) |

**Dedup invariants (P1-4 resolution):**
- **Optimistic remove on success:** the row disappears immediately when the user confirms the tx, before the on-chain refetch completes. If the tx later reverts, the row reappears with an error toast.
- **Refresh affordance:** a small refresh button at the top of the Pending Claims section forces a re-read of badges/scoreboard. Auto-fires once when Profile opens.
- **Chain-says-claimed dominates:** if the contract says badge is already minted but localStorage thinks the score is unsubmitted (multi-device), the row does NOT appear — single source of truth is on-chain state, never local.

**Mid-flight disconnect (P1-6 resolution, scoped to single-tx since no batching):**
When the user's wallet disconnects after submitting a tx but before confirmation:
- The claim row enters an `in-flight` state with copy "In flight — reconnect to verify".
- Row is frozen (no re-tap) until one of: (a) wallet reconnects to same address → resume (poll receipt), (b) different address → row drops to pending state on next address change, (c) 10 min timeout → assume failed, return row to claimable state with retry CTA.
- A single `chesscito:claim-in-flight:{txHash}` localStorage key tracks the in-flight tx.

**`<PendingClaims>` behavior:**
- Lists 1 row per claim, no batching.
- On success: row disappears (optimistic), notif-dot decrements, telemetry fires.
- On failure: row stays, error toast, telemetry fires.
- On user cancellation: row stays, no toast.
- On wallet disconnect mid-flight: row enters `in-flight` state per above.

### D11. Leaderboard reframe

- Default tab: **"Puzzles this week"** — sum of solved puzzles (exercises + daily + mate) per player, weekly window. Inclusive training metric.
- Secondary tab: **"Arena wins"** — competitive ranking, opt-in for the player who wants it.
- Tab state persisted in localStorage so the chosen view sticks.

### D12. PRO storytelling

PRO slot copy on the right rail and in Profile/Shop is **dynamic per current PRO puzzle**:
- Active example: "PRO · Knight's Tour — solve the board"
- Inactive example: "Unlock Knight's Tour + monthly puzzles"

The current PRO puzzle name lives in `editorial.ts` as `PRO_DROP_COPY.current` and updates monthly with each content drop.

**Operational risk note (P1-11):** Monthly drops require a synchronized commit updating `PRO_DROP_COPY.current` simultaneously with the on-chain catalog update. SPEC 2 will introduce a server-side current-drop endpoint (or read directly from the on-chain shop catalog) to remove the dual-update risk. Until SPEC 2 ships, runbook for monthly drop must include "verify `PRO_DROP_COPY.current` matches the live shop catalog item".

### D13. Anchor asset cleanup — atomic fix (rewritten per P0-4)

**The real bug:** today the HUB anchor renders only the CSS `background:` (line `globals.css:2906`) because the `<picture>` is intentionally hidden by `opacity: 0` on `.kingdom-anchor--playhub .kingdom-anchor-picture` (lines `globals.css:2938-2940`). The "two images stacked" framing was wrong — one renders, one is invisible. Naming-wise `splash-loading` should not appear in HUB code at all.

**Fix sequence (must respect commit boundaries to avoid blanking the anchor):**

**Commit 1 — Asset prep (no behavior change):**
1. Generate `apps/web/public/art/scene-rooted/portal-centered.avif` + `.webp` companions (parity with `splash-loading` formats).
2. Verify in dev that the new files load (`curl -I http://localhost:3000/art/scene-rooted/portal-centered.avif` returns 200).

**Commit 2 — Atomic switchover (all 4 changes in same commit):**
1. `kingdom-anchor.tsx:27` → change `HERO_ASSET_BASE` from `/art/redesign/bg/splash-loading` to `/art/scene-rooted/portal-centered`.
2. `globals.css:2906-2918` → delete the `.kingdom-anchor--playhub { background: url(...) ... }` rule entirely.
3. `globals.css:2938-2940` → delete the `.kingdom-anchor--playhub .kingdom-anchor-picture { opacity: 0; }` rule (otherwise the JSX `<picture>` stays invisible and the anchor goes blank).
4. `kingdom-anchor.test.tsx` → update **all 7 occurrences** of `splash-loading` (lines 14, 19, 24, 63, 64, 67, and test name at line 27). Verify aspect-ratio expectation still holds for portal-centered or update.

**`splash-loading.png/avif/webp` files remain untouched** — they keep their semantic role as actual loading surface (`globals.css:2253-2259`).

### D14. Onboarding card (first-launch)

One-time card on first hub visit, dismissable:
> "Chesscito trains your brain with chess puzzles. Master one piece at a time. Graduate to Arena when ready."

**Timing spec (P1-8 resolution):**
- Component: `<HubOnboardingCard>` loaded via `dynamic(() => import(...), { ssr: false })` — same pattern as `<HubSplash>` to avoid first-paint hydration mismatch on localStorage reads.
- Mount position: between HUD (header) and Body (3-column rails), inline at top of `<main>` — pushes Body down rather than overlay (no modal scrim, no body-scroll lock).
- Dismissal: single `[Got it]` button. **No tap-outside dismiss** (avoids accidental dismissal on tile-rail taps). No close X.
- Persistence: `localStorage.setItem("chesscito:hub-onboarded:v1", "true")` on dismiss.
- Reload behavior: if user reloads mid-read without dismissing, card re-renders (flag still false). If they dismissed and reload, card stays hidden.

### D15. V2 canary retirement

`hub-scaffold-v2-client.tsx` is a behind-flag canary (`HUB_V2_DEFAULT = false`) that has structurally diverged from the V1 direction this spec extends: V2 has a MasteryDashboard 2x3 placeholder grid, no reward column, no PremiumSlot, different testids, different sticky-dock shape. Implementing SPEC 1 against both V1 and V2 doubles the work and bifurcates the test surface.

**Decision:** unship V2 entirely as part of SPEC 1.

**Cleanup scope:**
- Delete `apps/web/src/components/hub/hub-scaffold-v2-client.tsx`
- Delete `apps/web/src/components/hub/hub-scaffold-v2.tsx` (presentational sibling, if exists)
- Delete `apps/web/src/components/hub/__tests__/hub-scaffold-v2.test.tsx` and `hub-scaffold-v2-client.test.tsx`
- Delete `HUB_V2_DEFAULT` constant + `resolveHubVariant` helper from `lib/feature-flags.ts` (or refactor to remove V2 branch)
- Simplify `app/hub/page.tsx` to render `<HubScaffoldClient>` unconditionally (remove the `?hub=v2` query handling and the `resolveHubVariant()` call)
- Audit `_bmad-output/planning-artifacts/epics.md` and other docs referencing V2 — leave a one-line note that V2 was retired in this spec

If specific V2 ideas (MasteryDashboard, sticky shield ribbon, splash overlay) are worth preserving, fold them into the V1 architecture as discrete primitives during implementation. The goal is "1 hub composition", not "preserve V2 features by default".

---

## Architecture

### New components

| Component | Path | Purpose |
|---|---|---|
| `<ProfileSheet>` | `components/profile/profile-sheet.tsx` | Top-level modal, mounted via `Sheet` (matches existing pattern) |
| `<ProfileBanner>` | `components/profile/profile-banner.tsx` | Avatar + name + tier + wallet + XP badge |
| `<PendingClaims>` | `components/profile/pending-claims.tsx` | Reads from `useClaimQueue()`, renders rows (individual claims, no batching v1) + refresh button |
| `<GeneralStats>` | `components/profile/general-stats.tsx` | 6-cell grid; reads from `useProfileStats()`; always rendered (P2-4) |
| `<TierBadge>` | `components/profile/tier-badge.tsx` | Red shield badge with XP, computed tier title |
| `<DisplayNameDialog>` | `components/profile/display-name-dialog.tsx` | Name edit text-input dialog (avoids inline-edit keyboard shifts) |
| `<SecondaryCta>` | `components/hub/secondary-cta.tsx` | Small blue Arena link below Hero |
| `<HubOnboardingCard>` | `components/hub/onboarding-card.tsx` | First-launch one-time card, ssr:false, inline mount |
| `<SettingsSheetStub>` | `components/hub/settings-sheet-stub.tsx` | v1 stub: version chip + disabled toggles |

### Pure helpers (testable in isolation)

| Helper | Path | Signature |
|---|---|---|
| `getHeroContextAction` | `lib/hub/hero-cta.ts` | `(state) → HeroCTA` — **NEW**, separate from `lib/game/context-action.ts`. Domain: HUB hero state (3 variants). |
| `computeTier` | `lib/profile/compute-tier.ts` | `(stats) → { tier, title, xp }`. Input shape: `{ puzzlesSolved, piecesMastered, arenaWins, daysStreak }`. Handles wallet-disconnected case (returns "Visitor" tier). |
| `computePendingClaims` | `lib/claims/queue.ts` | `(playerState) → Claim[]` — applies dedup invariants from D10 |
| `resolveDisplayName` | `lib/profile/display-name.ts` | `(address, customName?, talentProtocolName?) → string` — precedence: custom > Talent > truncated wallet |

### Hooks

| Hook | Path | Returns |
|---|---|---|
| `useProfileStats` | `hooks/use-profile-stats.ts` | Fetches from new `/api/profile/stats?address=0x...` (server-side aggregates via Supabase cache + on-chain reads). No client-side cache (per-user data). Wrapped in `<Suspense>` boundary at ProfileSheet level. Returns `{ stats, isLoading, error }`. |
| `useClaimQueue` | `hooks/use-claim-queue.ts` | `{ claims, claimOne, isClaiming, inFlight, refresh }` — single-claim only in v1 |
| `useDisplayName` | `hooks/use-display-name.ts` | resolves wallet → localStorage custom name → Talent Protocol → truncated wallet |
| `useHubOnboarding` | `hooks/use-hub-onboarding.ts` | `{ hasSeenOnboarding, dismiss }` reads/writes `chesscito:hub-onboarded:v1` |

### New API route

| Route | Purpose | Auth | Cache |
|---|---|---|---|
| `/api/profile/stats` | Aggregates trophies/arenaWins/NFTs/dailyStreak from Supabase + on-chain reads, keyed by `?address=0x...` | Best-effort by address (no SIWE — data is non-sensitive public stats) | No HTTP cache (per-user; rate-limit by IP at 10 req/min) |

### Routing

- `app/hub/page.tsx`:
  - `parseInitialSheet` union: add `"trophies" | "profile" | "settings"` (existing supports `"shop" | "pro" | "badges"`).
  - Remove `?hub=v2` handling (V2 retired per D15).
- `app/trophies/page.tsx`:
  - Stays as a real page. Visual port to candy aesthetic. **Not** a redirect.

### Editorial additions (`lib/content/editorial.ts`)

```ts
PROFILE_COPY: { pageTitle, pendingClaimsHeader, generalStatsHeader, walletLabel, networkLabel, disconnect, manage, refreshAria }
DISPLAY_NAME_COPY: { dialogTitle, placeholder, save, cancel, visitor }
TIER_LABELS: { apprentice, trainee, knight, wizard, grandmaster, visitor }
TIER_THRESHOLDS: { trainee: 25, knight: 75, wizard: 200, grandmaster: 500 } // puzzles solved
CLAIM_COPY: {
  kinds: { badge, score, victoryNft },
  claimVerb,
  costGasOnly,          // shown when cost is gas-only
  costEstimateUsd,      // shown when there's a USD price (victory-nft)
  inFlightLabel,        // "In flight — reconnect to verify"
  refreshAria,
}
HERO_CTA_COPY: {
  newPlayer: { label, sub, variant },
  dailyPending: { label, sub, variant },     // sub = "today's tactic awaits" (no countdown in v1)
  defaultCaughtUp: { label, sub, variant },   // also used during loading
}
SECONDARY_CTA_COPY: { arena: { label, ariaLabel } }
HUB_ONBOARDING_COPY: { title, body, dismissLabel } // dismiss = "Got it"
LEADERBOARD_COPY_V2: { tabs: { puzzlesWeek, arenaWins } }
PRO_DROP_COPY: { current: "Knight's Tour", activeLabel, inactiveLabel }
SETTINGS_STUB_COPY: { title, comingSoonTooltip, versionChipLabel }
```

### Telemetry events (`lib/telemetry.ts`)

- `profile_opened`
- `profile_name_edited`
- `profile_refresh_tapped`
- `claim_attempted` (kind)
- `claim_succeeded` (kind) — **no `tx_hash`** (would leak wallet via Celoscan; if server-side correlation needed, log to server logs only with salted hash; P1-12 resolution)
- `claim_failed` (kind, error_code)
- `claim_in_flight_reconnected` (kind, outcome: resumed | dropped | timed_out)
- `hero_cta_clicked` (variant: new_player | daily_pending | default)
- `secondary_arena_clicked`
- `hub_onboarding_dismissed`

---

## Testing strategy

### Unit (Vitest)

- `getHeroContextAction`: 3 variant priority order, loading-state returns default, edge inputs (undefined fields treated as falsy).
- `computeTier`: 5 tier thresholds + Visitor tier (wallet disconnected) + "0 puzzles + 5 badges claimed" boundary + i18n-safe title resolution.
- `computePendingClaims`: each claim kind, dedup invariants (chain-says-claimed dominates, optimistic-removed entries don't reappear before refetch).
- `resolveDisplayName`: precedence order (custom > Talent > truncated wallet).
- `parseInitialSheet`: trophies/profile/settings additions, invalid values, undefined, no longer handles V2 param.

### Component (Vitest + RTL)

- `<HubScaffold>`: rails LEARN/UNLOCK labels render, secondary CTA visible, dock has 5 slots (Home/Pieces/Shop/Board/Settings), Hero label changes per state (3 variants), notif-dot count on avatar, no V2 testid references remain.
- `<ProfileSheet>`: all sections render, banner shows tier+xp, claims section hides when empty, stats grid renders even at 0.
- `<PendingClaims>`: claim row click triggers callback, no "Claim all" button rendered v1, refresh button fires refetch, in-flight state freezes row.
- `<GeneralStats>`: 6 cells render with formatted values, "Visitor" tier shows when address absent.
- `<DisplayNameDialog>`: opens on pen tap, save persists to localStorage, cancel discards.
- `<HubOnboardingCard>`: only renders on first visit, Got-it dismiss persists, no tap-outside dismiss.
- `<SettingsSheetStub>`: version chip shows current build SHA, disabled toggles show tooltip on hover.

### E2E (Playwright)

- `/hub` → tap avatar → Profile opens → claim badge → tx prompt fires (mocked) → row disappears optimistically.
- `/hub` → confirm secondary "Enter Arena →" navigates to `/arena`.
- `/hub` with no exercises done → Hero shows START WITH PIECES → click → lands on `/exercises?piece=rook`.
- `/hub` with daily pending → Hero shows PLAY TODAY'S TACTIC.
- `/hub` first visit → onboarding card visible → dismiss → reload → card stays hidden.
- `/trophies` → real page loads with back button (no redirect, no hub render).
- `/hub?sheet=trophies` → sheet opens over hub.
- `/hub?sheet=profile` → profile sheet opens, deep-link works.
- `/hub?hub=v2` → falls through to default V1 (V2 retired, query ignored).

### Manual QA checklist (P2-6, run before flag-flip)

iPhone MiniPay viewport (390px), real wallet:
- Each Hero CTA state: (1) new-player, (2) daily-pending, (3) default — confirm correct label/destination per state.
- Each PRO state: active (shows days), inactive (shows upsell with current drop name).
- Each claim queue state: empty (section hidden), single-free claim, single-paid claim.
- Disconnected wallet: HUD shows "Connect" affordance; Profile shows "Visitor" tier; claims show "Connect wallet to claim".
- Mid-onboarding-card: reload mid-read → card re-renders; dismiss → reload → hidden.
- Settings sheet: version chip matches build, disabled toggles show "Coming soon" tooltip.
- DisplayName dialog: type → save → reopens Profile → name persists across reload; clear → reopens with default.

---

## Files affected (preview)

**Modified:**
- `apps/web/src/components/hub/hub-scaffold.tsx` (rails reorganized, secondary CTA, hero contextual using new helper)
- `apps/web/src/components/hub/hub-scaffold-client.tsx` (wire new props, profile sheet routing, claim queue, onboarding card)
- `apps/web/src/app/hub/page.tsx` (parseInitialSheet union extended; V2 routing removed per D15)
- `apps/web/src/app/trophies/page.tsx` (visual port to candy aesthetic; **not** a redirect — D8 reverted)
- `apps/web/src/components/exercises/persistent-dock.tsx` (5-slot taxonomy: Home/Pieces/Shop/Board/Settings)
- `apps/web/src/components/kingdom/kingdom-anchor.tsx` (HERO_ASSET_BASE → portal-centered)
- `apps/web/src/components/kingdom/__tests__/kingdom-anchor.test.tsx` (all 7 occurrences of splash-loading updated)
- `apps/web/src/app/globals.css` (delete .kingdom-anchor--playhub background rule AND opacity:0 rule in same commit; add tier-badge + secondary-cta + label-track styles; add candy port for `/trophies` page)
- `apps/web/src/lib/content/editorial.ts` (new copy blocks listed above; no `tx_hash` in telemetry props)
- `apps/web/src/lib/telemetry.ts` (new events without `tx_hash`)
- `apps/web/src/lib/feature-flags.ts` (remove `HUB_V2_DEFAULT` + `resolveHubVariant`)

**New:**
- `apps/web/src/lib/hub/hero-cta.ts` (NEW pure helper, separate from existing context-action.ts)
- `apps/web/src/lib/profile/compute-tier.ts`
- `apps/web/src/lib/profile/display-name.ts`
- `apps/web/src/lib/claims/queue.ts`
- `apps/web/src/hooks/use-profile-stats.ts`
- `apps/web/src/hooks/use-claim-queue.ts`
- `apps/web/src/hooks/use-display-name.ts`
- `apps/web/src/hooks/use-hub-onboarding.ts`
- `apps/web/src/app/api/profile/stats/route.ts` (NEW endpoint; aggregates Supabase + on-chain stats by address)
- `apps/web/src/components/profile/profile-sheet.tsx`
- `apps/web/src/components/profile/profile-banner.tsx`
- `apps/web/src/components/profile/pending-claims.tsx`
- `apps/web/src/components/profile/general-stats.tsx`
- `apps/web/src/components/profile/tier-badge.tsx`
- `apps/web/src/components/profile/display-name-dialog.tsx`
- `apps/web/src/components/hub/secondary-cta.tsx`
- `apps/web/src/components/hub/onboarding-card.tsx`
- `apps/web/src/components/hub/settings-sheet-stub.tsx`
- `apps/web/public/art/scene-rooted/portal-centered.avif` (generated)
- `apps/web/public/art/scene-rooted/portal-centered.webp` (generated)
- Tests mirroring each new component/helper/route.

**Deleted (V2 retirement, D15):**
- `apps/web/src/components/hub/hub-scaffold-v2-client.tsx`
- `apps/web/src/components/hub/hub-scaffold-v2.tsx` (if exists as separate file)
- `apps/web/src/components/hub/__tests__/hub-scaffold-v2.test.tsx`
- `apps/web/src/components/hub/__tests__/hub-scaffold-v2-client.test.tsx`

**Also deleted:**
- Trophies dock entry (in `persistent-dock.tsx`).
- Account sheet (functionality migrated to ProfileSheet — references in `exercises-screen.tsx` updated).

---

## Open questions / hooks for SPEC 2/3

- **SPEC 2 prerequisites** SPEC 1 leaves ready:
  - PRO slot on right rail with dynamic copy → SPEC 2 wires real PRO puzzle catalog and current-drop endpoint (kills P1-11 risk).
  - Avatar editable pen → SPEC 2 ships avatar picker with PRO variants.
  - Shop dock slot in place → SPEC 2 adds PRO subscription as Shop item; introduces `?sheet=pro → ?sheet=shop&item=pro` redirect (D6.1).
  - Cosmetic NFT system (board/piece skins) → SPEC 2 design.
  - SIWE-signed display-name persistence + profiles table → SPEC 2 sub-spec.
  - Multicall primitive on contracts → enables "Claim all" batching in Profile.
- **SPEC 3 hooks** SPEC 1 establishes:
  - Coach chip with dormant notif-dot → SPEC 3 wires the analyze-ready trigger.
  - Claim queue infrastructure → SPEC 3 adds `coach-moment` kind (paid, manual mint).
  - NFTs Minted stat in Profile already aggregates → SPEC 3 ensures Coach Moments count toward it.
- **SPEC future (no number yet):**
  - Mini-arena streak counter → enables Hero CTA `mate-streak` state.
  - Daily Tactic live countdown → ticker hook with reduced re-render cadence.
  - Full Settings sheet (theme, haptics, i18n).

---

## Validation gates

Before implementing SPEC 1:
- User reviews this spec and approves (gate before writing-plans).
- Brainstorming session captured in `.superpowers/brainstorm/4844-1779089056/content/` (3 layout screens + anchor/profile screen) — kept as visual record.
- Red-team report `docs/reviews/2026-05-18-spec-1-hub-redesign-red-team.md` reviewed; all P0/P1 applied to this spec; P2 selectively applied (P2-1 negative tests, P2-2 pen-scoped-to-name, P2-4 stats-always-render, P2-5 arena-gate-handles-disconnect, P2-6 QA checklist, P2-7 7-test-occurrences, P2-8 keyboard MiniPay note); deferred P2s (P2-3 localStorage namespace cleanup, P2-9 dynamic-imports of sheets) tracked as follow-ups.

Before merging implementation:
- All unit + component + E2E tests pass.
- Manual QA checklist (see Testing) passes on iPhone (MiniPay viewport 390px) + desktop fallback.
- Telemetry events fire end-to-end (verified in console + dev dashboard); no `tx_hash` in client payloads.
- No regression in `/exercises` flow (still reachable via dock "Pieces"); existing `getContextAction` untouched.
- No regression in `/arena` flow (still reachable via secondary CTA).
- Anchor renders correctly (portal-centered visible) after Commit 2 of D13 — manual visual smoke before merging.
- V2 retirement clean: `grep -r "hub-v2\|HUB_V2\|hub-scaffold-v2"` returns zero application matches after the retirement commit.

**MiniPay-specific QA (P2-8):** All new text inputs (DisplayNameDialog) tested in MiniPay simulator for keyboard layout shifts. Trophies sheet search/filter (if added later) follows same pattern.
