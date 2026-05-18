# SPEC 1 — Hub Redesign: Destinations & Profile

**Date:** 2026-05-18
**Status:** Brainstorming → Implementation Planning
**Scope:** Hub layout + Profile modal + Claim Queue + Trophies consolidation + Anchor asset cleanup
**Out of scope (separate specs):** SPEC 2 — Shop Unification + Cosmetic Variants. SPEC 3 — Coach Moments NFT.

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
5. **Consolidate the Trophies duplication** — one canonical surface (sheet), one URL shim for external links.
6. **Fix the anchor asset stack** — HUB renders two layered images today (`splash-loading` over `portal-centered`); unify to `portal-centered`.
7. **Establish the Claim Queue pattern** — elegant CTAs, never auto, web-graceful, single reusable component for all free-action mints.

---

## Non-goals (deferred)

- **Move PRO subscription into Shop** → SPEC 2.
- **Cosmetic NFTs** (board/piece skins, avatar variants) → SPEC 2.
- **Coach Moments NFT** (transferable game highlights mintable from Coach analysis) → SPEC 3.
- **PRO puzzle catalog** (Knight's Tour, non-capture, cross-board) → content drop, not part of SPEC 1 (HUB only reserves the slot).
- **Avatar picker UI** → SPEC 2 (HUB only ships static wizard wolf as default, with editable display name).

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
  - LEFT rail `LEARN` — vertical stack: Daily Tactic (countdown badge), Mate Endgame (K+R label), Labyrinth (star count).
  - CENTER — KingdomAnchor (portal-centered.png, decorative, no tap).
  - RIGHT rail `UNLOCK` — vertical stack: PRO content drop tile (names current PRO puzzle), Shop spotlight, Badge progress.
- **Footer:**
  - Hero CTA (amber, contextual — see D4).
  - Secondary CTA (small blue "Enter Arena →", always visible — see D5).
  - Persistent dock (5 slots — see D7).

### D4. Hero CTA — contextual training-first (4 states)

A single amber primary CTA whose label/destination/sub-copy rotates based on player state, computed by an extended `getContextAction(state)` helper. Color stays amber across all states (= "your next training session"). Four states v1:

| State | Trigger | Label | Sub | Destination |
|---|---|---|---|---|
| **new-player** | 0 exercises completed | START WITH PIECES | "learn the rook first" | `/exercises?piece=rook` |
| **daily-pending** | Today's daily not solved | PLAY TODAY'S TACTIC | "Nh left" countdown | `/exercises?slot=daily` |
| **mate-streak** | Mini-arena active streak | CONTINUE MATE TRAINING | "K+R · 3/5 solved" | `/exercises?slot=mini-arena` |
| **default** | All training caught up | DAILY COMPLETE — TRAIN MORE | "tap a tile to pick" | scrolls/highlights LEARN rail |

Priority order: `new-player > daily-pending > mate-streak > default`. Future PRO state will slot in between daily-pending and mate-streak when SPEC 2 ships.

### D5. Secondary CTA — Arena always visible

A small blue text-link-style CTA `Enter Arena →` immediately below the Hero. Always present, never promoted, no badge, no nag. Visually subordinated (50% the height of Hero, calm blue, not gradient candy). Single source: `<SecondaryCta surface="arena">`.

### D6. HUD chips — actionable, not info

| Chip | Tap action | Notif-dot logic |
|---|---|---|
| **Avatar** (top-left) | Opens Profile modal (`/hub?sheet=profile`) | Shows total pending claims count |
| **Trophies** | Opens Trophies sheet (`/hub?sheet=trophies`); if pending scoreboard saves exist, label becomes "Save N pts" instead of count | Red dot if any unsaved score |
| **PRO** (active) | Opens PRO sheet (`/hub?sheet=pro`) → days remaining + manage | None |
| **PRO** (inactive) | Opens PRO sheet → upsell with current monthly drop | None |
| **Coach** | Opens Coach sheet → "Analyze last Arena game" if one exists, else "Browse history" | **Dormant in SPEC 1** (no analysis-ready signal exists yet). SPEC 3 wires the trigger when Coach Moments detects a notable game. |

### D7. Dock taxonomy (5 slots)

| Slot | Destination | Notes |
|---|---|---|
| **Home** | `/hub` | Active state when on hub |
| **Pieces** | `/exercises` | Practice piece arc |
| **Shop** | `/hub?sheet=shop` | Commerce (PRO moves here in SPEC 2) |
| **Board** | `/hub?sheet=leaderboard` (or `/leaderboard`) | Default tab: "Puzzles this week" (D11) |
| **Settings** | `/hub?sheet=settings` (new sheet — same pattern as shop/pro/badges) | Theme, haptics, language, version chip |

**Removed from dock:** Badges (lives in Profile + HUD trophy chip flow), Trophies (lives in HUD chip + sheet), Account (lives in HUD avatar → Profile), Invite (future SPEC), Free Play (Hero CTA covers it).

**Profile is NOT in the dock** — the HUD avatar is its single entry point. Avoids duplication and signals identity prominence.

### D8. Trophies consolidation

- `<TrophiesBody>` already shared (no change).
- `app/trophies/page.tsx` becomes a 1-line `redirect("/hub?sheet=trophies")`. External bookmarks/share-cards continue to work, but UI converges on the sheet.
- Sheet remains as the only rendered surface — visually candy-aligned via `sheet-bg-hub`.
- Hub `parseInitialSheet` union extends to include `"trophies"` and `"profile"`.

### D9. Profile modal (replaces Account sheet)

Triggered by HUD avatar tap. URL: `/hub?sheet=profile`. Structure:

1. **Banner (blue gradient, top)**
   - Avatar (64px circle, wizard wolf default, editable pen icon — picker deferred to SPEC 2)
   - Display name (default = truncated wallet `0x0924…eba4`, or Talent Protocol identity if available). Tapping the pen icon opens a small edit dialog with text input + Save/Cancel — no inline-editing (avoids keyboard layout shifts in MiniPay WebView). Custom name persisted in Supabase keyed by wallet address.
   - Tier title (computed: `Apprentice → Trainee → Knight → Wizard → Grandmaster`)
   - Wallet truncated (monospace)
   - XP badge (top-right, computed numeric)
2. **Pending Claims section** (band header + claims card)
   - One row per pending claim (icon + label + cost estimate + green "Claim" button)
   - "Claim all (N) · ~$X total" batched action when all rows are free
   - Empty state: hidden (the section + band do not render if claims.length === 0)
3. **General Stats grid** (band header + 3x2 grid)
   - Pieces Mastered (X / 6) — count of exercise arcs completed past threshold
   - Daily Streak (current days) — from `lib/daily/progress.ts`
   - Puzzles Solved (cumulative) — sum across exercises + daily + mate
   - Arena Wins (cumulative) — from victory NFT history
   - Trophies (cumulative) — from scoreboard
   - NFTs Minted (cumulative) — victory NFTs (+ coach NFTs when SPEC 3 ships)
4. **PRO banner** — purple gradient: active days + "Manage" → opens PRO sheet (later: deep-link into Shop)
5. **Wallet / Network cards** — collapsed-style subdued rows
6. **Disconnect link** — small, low-emphasis bottom of modal

### D10. Pending Claims queue (the value layer)

**Principles:**
- **Never auto-launch a tx.** Every claim is user-initiated via explicit CTA.
- **Notification dot is the persistent signal.** Lives on avatar (HUD top-left) + Trophies chip (when score pending) + Coach chip (when analysis pending).
- **Web-graceful.** No wallet → CTA becomes "Connect wallet to claim" chip; never errors.
- **Single source.** `lib/claims/queue.ts` computes; `<PendingClaims>` renders; reusable across surfaces.

**Claim kinds in v1:**
| Kind | Trigger condition | Cost | Action |
|---|---|---|---|
| `badge` | Exercise score crossed badge threshold, no on-chain mint yet | gas only | Calls `badges.claim(badgeId)` |
| `score` | Local exercise score not synced to scoreboard | gas only | Calls `scoreboard.save(scoreData)` |
| `victory-nft` | Arena win in last 24h and not yet minted (stored in localStorage `chesscito:victory-pending:{txHash}`) | $0.005–$0.02 | Routes to existing victory mint flow (no auto, no batching since it's paid) |

**`<PendingClaims>` behavior:**
- Lists 1 row per claim.
- "Claim all" appears only if **all** rows are free (badges + scores). Mixed lists show individual rows only.
- On success: row disappears, notif-dot decrements, telemetry fires.
- On failure: row stays, error toast, telemetry fires.
- On user cancellation: row stays, no toast.

### D11. Leaderboard reframe

- Default tab: **"Puzzles this week"** — sum of solved puzzles (exercises + daily + mate) per player, weekly window. Inclusive training metric.
- Secondary tab: **"Arena wins"** — competitive ranking, opt-in for the player who wants it.
- Tab state persisted in localStorage so the chosen view sticks.

### D12. PRO storytelling

PRO slot copy on the right rail and in Profile/Shop is **dynamic per current PRO puzzle**:
- Active example: "PRO · Knight's Tour — solve the board"
- Inactive example: "Unlock Knight's Tour + monthly puzzles"

The current PRO puzzle name lives in `editorial.ts` as `PRO_DROP_COPY.current` and updates monthly with each content drop. SPEC 1 ships the slot + copy structure; the puzzles themselves ship in SPEC 2 content drops.

### D13. Anchor asset cleanup

Today the HUB anchor renders **two images stacked** by accident:
- CSS: `.kingdom-anchor--playhub { background: url("/art/scene-rooted/portal-centered.png") }` (`globals.css:2911`)
- JSX: `<picture>` with `splash-loading.{avif,webp,png}` (`kingdom-anchor.tsx:27`)

**Fix:**
1. Change `HERO_ASSET_BASE` in `kingdom-anchor.tsx:27` from `/art/redesign/bg/splash-loading` to `/art/scene-rooted/portal-centered`.
2. Generate `portal-centered.avif` + `portal-centered.webp` companions (parity with splash-loading).
3. Remove the `background:` rule on `.kingdom-anchor--playhub` (lines 2906–2918) — JSX `<picture>` is the single source.
4. Update test assertions in `kingdom-anchor.test.tsx` (lines 14, 19, 24, 67) from `splash-loading` to `portal-centered`.
5. `splash-loading.png/avif/webp` remain untouched — they keep their semantic role as actual loading surface (`globals.css:2253`).

### D14. Onboarding card (first-launch)

One-time card on first hub visit, dismissable:
> "Chesscito trains your brain with chess puzzles. Master one piece at a time. Graduate to Arena when ready."

Stored in localStorage `chesscito:hub-onboarded:v1`. Sets expectations for both audiences (training-first newcomers AND chess-literate skippers).

---

## Architecture

### New components

| Component | Path | Purpose |
|---|---|---|
| `<ProfileSheet>` | `components/profile/profile-sheet.tsx` | Top-level modal, mounted via `Sheet` (matches existing pattern) |
| `<ProfileBanner>` | `components/profile/profile-banner.tsx` | Avatar + name + tier + wallet + XP badge |
| `<PendingClaims>` | `components/profile/pending-claims.tsx` | Reads from `useClaimQueue()`, renders rows + claim-all |
| `<GeneralStats>` | `components/profile/general-stats.tsx` | 6-cell grid; reads from `useProfileStats()` |
| `<TierBadge>` | `components/profile/tier-badge.tsx` | Red shield badge with XP, computed tier title |
| `<SecondaryCta>` | `components/hub/secondary-cta.tsx` | Small blue Arena link below Hero |
| `<HubOnboardingCard>` | `components/hub/onboarding-card.tsx` | First-launch one-time card |

### Pure helpers (testable in isolation)

| Helper | Path | Signature |
|---|---|---|
| `computeTier` | `lib/profile/compute-tier.ts` | `(stats) → { tier, title, xp }` |
| `computePendingClaims` | `lib/claims/queue.ts` | `(playerState) → Claim[]` |
| `getContextAction` (extended) | `lib/game/context-action.ts` (existing) | `(state) → HeroCTA` — extend with 4 new variants |

### Hooks

| Hook | Path | Returns |
|---|---|---|
| `useProfileStats` | `hooks/use-profile-stats.ts` | RSC fetch via Supabase cache (~5ms) for trophies/arena wins/NFTs/daily streak (pre-aggregated server-side, see project memory on Supabase Cache Layer); localStorage fallback for exercise progress / pieces mastered (client-only state). Returns `{ stats, isLoading, error }`. |
| `useClaimQueue` | `hooks/use-claim-queue.ts` | `{ claims, claimOne, claimAll, isClaiming }` |
| `useDisplayName` | `hooks/use-display-name.ts` | resolves wallet → custom name OR Talent Protocol OR truncated wallet |

### Routing

- `app/hub/page.tsx`:
  - `parseInitialSheet` union: add `"trophies" | "profile" | "settings"` (existing supports `"shop" | "pro" | "badges"`).
- `app/trophies/page.tsx`:
  - Replace JSX with `redirect("/hub?sheet=trophies")` (preserves external links).

### Editorial additions (`lib/content/editorial.ts`)

```ts
PROFILE_COPY: { pageTitle, pendingClaimsHeader, generalStatsHeader, walletLabel, networkLabel, disconnect, manage }
TIER_LABELS: { apprentice, trainee, knight, wizard, grandmaster }
TIER_THRESHOLDS: { trainee: 25, knight: 75, wizard: 200, grandmaster: 500 } // puzzles solved
CLAIM_COPY: { kinds: { badge, score, victoryNft }, claimVerb, claimAllFormat, costGasOnly }
HERO_CTA_COPY: { newPlayer, dailyPending, mateStreak, defaultCaughtUp } // each: { label, sub, variant }
SECONDARY_CTA_COPY: { arena: { label, ariaLabel } }
HUB_ONBOARDING_COPY: { title, body, dismissLabel }
LEADERBOARD_COPY_V2: { tabs: { puzzlesWeek, arenaWins } }
PRO_DROP_COPY: { current: "Knight's Tour", activeLabel, inactiveLabel }
```

### Telemetry events (`lib/telemetry.ts`)

- `profile_opened`
- `profile_name_edited`
- `claim_attempted` (kind, count)
- `claim_succeeded` (kind, tx_hash)
- `claim_failed` (kind, error_code)
- `claim_all_attempted` (count, total_cost_estimate)
- `hero_cta_clicked` (variant)
- `secondary_arena_clicked`
- `hub_onboarding_dismissed`

---

## Testing strategy

### Unit (Vitest)

- `computeTier`: 5 tier thresholds, boundary cases, edge (0 puzzles, max int).
- `computePendingClaims`: each claim kind, mixed lists, empty list, dedup logic.
- `getContextAction`: 4 variant priority order, fallback to default.
- `parseInitialSheet`: trophies/profile/settings additions, invalid values, undefined.

### Component (Vitest + RTL)

- `<HubScaffold>`: rails LEARN/UNLOCK labels render, secondary CTA visible, dock has 5 slots, Hero label changes per state, notif-dot count on avatar.
- `<ProfileSheet>`: all sections render, banner shows tier+xp, claims section hides when empty.
- `<PendingClaims>`: claim row click triggers callback, claim-all only when all free, error state.
- `<GeneralStats>`: 6 cells render with formatted values.

### E2E (Playwright)

- `/hub` → tap avatar → Profile opens → claim badge → tx prompt fires (mocked).
- `/hub` → confirm secondary "Enter Arena →" navigates to `/arena`.
- `/trophies` → server redirect to `/hub?sheet=trophies` → sheet renders.
- Hero CTA: simulate new-player state → confirm amber "START WITH PIECES" + correct destination.

---

## Files affected (preview)

**Modified:**
- `apps/web/src/components/hub/hub-scaffold.tsx` (major: rails reorganized, secondary CTA, hero contextual)
- `apps/web/src/components/hub/hub-scaffold-client.tsx` (wire new props, profile sheet routing, claim queue) — **canonical V1, primary target**
- `apps/web/src/components/hub/hub-scaffold-v2-client.tsx` (mirror changes) — V2 canary kept in parity until promotion or removal
- `apps/web/src/app/hub/page.tsx` (parseInitialSheet union extended)
- `apps/web/src/app/trophies/page.tsx` (replaced with redirect)
- `apps/web/src/components/exercises/persistent-dock.tsx` (5-slot taxonomy: Home/Pieces/Shop/Board/Settings)
- `apps/web/src/components/kingdom/kingdom-anchor.tsx` (HERO_ASSET_BASE → portal-centered)
- `apps/web/src/components/kingdom/__tests__/kingdom-anchor.test.tsx` (assertion updates)
- `apps/web/src/app/globals.css` (remove .kingdom-anchor--playhub background rule, add tier-badge + secondary-cta + label-track styles)
- `apps/web/src/lib/game/context-action.ts` (extend to 4 variants)
- `apps/web/src/lib/content/editorial.ts` (new copy blocks listed above)
- `apps/web/src/lib/telemetry.ts` (new events)

**New:**
- `apps/web/src/components/profile/profile-sheet.tsx`
- `apps/web/src/components/profile/profile-banner.tsx`
- `apps/web/src/components/profile/pending-claims.tsx`
- `apps/web/src/components/profile/general-stats.tsx`
- `apps/web/src/components/profile/tier-badge.tsx`
- `apps/web/src/components/hub/secondary-cta.tsx`
- `apps/web/src/components/hub/onboarding-card.tsx`
- `apps/web/src/lib/profile/compute-tier.ts`
- `apps/web/src/lib/claims/queue.ts`
- `apps/web/src/hooks/use-profile-stats.ts`
- `apps/web/src/hooks/use-claim-queue.ts`
- `apps/web/src/hooks/use-display-name.ts`
- `apps/web/public/art/scene-rooted/portal-centered.avif` (generated)
- `apps/web/public/art/scene-rooted/portal-centered.webp` (generated)
- Tests mirroring each new component/helper.

**Deleted:**
- Trophies dock entry (in `persistent-dock.tsx`).
- Account sheet (functionality migrated to ProfileSheet — references in `exercises-screen.tsx` updated).

---

## Open questions / hooks for SPEC 2/3

- **SPEC 2 prerequisites** SPEC 1 leaves ready:
  - PRO slot on right rail with dynamic copy → SPEC 2 wires real PRO puzzle catalog.
  - Avatar editable pen → SPEC 2 ships avatar picker with PRO variants.
  - Shop dock slot in place → SPEC 2 adds PRO subscription as Shop item.
  - Cosmetic NFT system (board/piece skins) → SPEC 2 design.
- **SPEC 3 hooks** SPEC 1 establishes:
  - Coach chip with notif-dot pattern → SPEC 3 surfaces analyzed-game-ready signal here.
  - Claim queue infrastructure → SPEC 3 adds `coach-moment` kind (paid, manual mint).
  - NFTs Minted stat in Profile already aggregates → SPEC 3 ensures Coach Moments count toward it.

---

## Validation gates

Before implementing SPEC 1:
- User reviews this spec and approves (gate before writing-plans).
- Brainstorming session captured in `.superpowers/brainstorm/4844-1779089056/content/` (3 layout screens + anchor/profile screen) — kept as visual record.

Before merging implementation:
- All unit + component + E2E tests pass.
- Manual QA on iPhone (MiniPay viewport 390px) + desktop fallback.
- Telemetry events fire end-to-end (verified in console + dev dashboard).
- No regression in `/exercises` flow (still reachable via dock "Pieces").
- No regression in `/arena` flow (still reachable via secondary CTA + dock if added).
