# Spec — lite-hub-redesign

**Date**: 2026-06-26
**Status**: ready-for-tdd
**Red-team**: P0-1/P0-2/P0-3 resolved below; open questions #1–#4 closed.
PR-B red-team (`lite-hub-redesign-redteam-prb.md`): P1-A/P1-B/P1-C resolved in
"Red-team PR B — P1 resolutions"; P2/P3 tracked there for their stages.

## Problem

The Lite HUB (build `bebc23f`, Image #7) reuses the Full 3-column scaffold
(`HubScaffold`) and gates every Lite/Full difference with ~30 inline
`CHESSCITO_LITE_MODE` conditionals across `hub-scaffold-client.tsx` (694 LOC)
and `hub-scaffold.tsx` (480 LOC). The surface has drifted toward a textual,
left-rail-heavy layout that buries the 21-day habit story under decorative
chrome.

The target (Image #8) is a **vertical, habit-first stack**: smaller mascot,
a hero **21-Day Mind Challenge** card (streak + pass merged), a single
**Start Focus** primary action, a **horizontal Training Path**, and a bottom
dock. Same features, a different visual distribution. Expressing that purely
with more inline flags is unmaintainable: a Full edit can silently break Lite
(prior Lite regressions), and VR baselines for both modes entangle.

## Goal

Ship a dedicated `HubLiteScaffold` presenter — habit-first, 21-day-challenge
layout — selected by the existing `CHESSCITO_LITE_MODE` env var at a single
boundary, sharing all data with the Full hub via one container, with **zero
feature loss** vs today's Lite hub.

## Non-goals

- Redesigning the **Full** hub (`HubScaffold` stays as-is).
- A new env var or feature flag (reuse `CHESSCITO_LITE_MODE`).
- A new route (`/hub` stays; only the rendered tree forks).
- Final visual treatment of `Join Challenge` / `Start Focus` buttons (the
  reference is directional; tokens/art land during implementation polish).
- **A bottom dock on the Lite hub (this iteration).** Decision 2026-06-26
  (founder + Sally): the hub stays single-focus on the daily loop; a 5-tab
  dock competes with Start Focus / Join Challenge for the thumb zone. The
  "Edit" label in the Image #8 mock was a capture artifact (it is just Home).
  Lite navigation stays light: Trophies via the HUD chip, Practice via Start
  Focus + Training Path tiles → `/exercises`.
- A hub **layout-editor / "Edit" mode**.
- Changing scoring/quota logic (the session-limit + star-freeze just shipped).
- New art assets, Lotties, or carousels (reuse canonical assets).

## Architecture

Container/presenter split with a single switch:

1. **Extract a container** that owns all data/hooks currently in
   `HubScaffoldClient` and returns one view model. Two shapes:
   - `HubViewModel` — shared (trophies, pro, rewardTiles, hero, shields,
     connect).
   - `HubLiteViewModel` — Lite extras (focusPassport, contentLoopAction,
     sessionQuota, seasonPassStatus).
2. **Switch once** in `HubScaffoldClient` (or `hub/page.tsx`):
   ```tsx
   return CHESSCITO_LITE_MODE
     ? <HubLiteScaffold {...liteVm} />   // NEW presenter (this spec)
     : <HubScaffold {...vm} />;          // Full, unchanged
   ```
3. **Reuse leaf components** in the Lite presenter: `FocusPassport`,
   `NextStepCard`, `RewardColumn`/reward tiles, `LanguageChip`,
   `HubDailyTile`, `SeasonPassSheet`, the persistent dock. Fork only the
   **composition**, not the leaves.
4. **Remove Lite branches from `HubScaffold`** once the Lite presenter owns
   them (focusPassport, nextStepCard, seasonPass CTA, `!CHESSCITO_LITE_MODE`
   chip guards). Full keeps only its own path.

### Delivery ordering (P0-1 — two PRs, not one)

The container holds wagmi hooks, 12+ effects, refs, and event subscriptions.
To keep blast radius small and protect Full:

- **PR A — pure extraction.** Lift all data into `useHubData()` (returns the
  view models). `HubScaffoldClient` consumes it and renders **Full
  byte-identical** — no visual diff, Full VR baseline unchanged, all existing
  hub tests green. No Lite presenter yet (Lite keeps rendering today's
  `HubScaffold`).
- **PR B — Lite presenter.** Add `HubLiteScaffold`, flip the single switch,
  and remove the now-dead Lite branches from `HubScaffold`. New VR baseline
  for Lite; Full baseline still unchanged.

Rollback for either PR is one line (revert the switch / the hook wiring).

## Contracts (SDD)

```ts
// Shared data already derived in HubScaffoldClient today.
export type HubFocusPassport = {
  streak: number;
  totalCompleted: number;
  todayDone: boolean;
  isLoading: boolean; // dailyProgress === null
};

export type HubSessionQuota = {
  isAtFreeLimit: boolean;
  isAtHardMax: boolean;
} | null;

// Challenge meta sourced from config (NOT inline literals).
// Single source: SEASON_PASSES.lite_season_pass_21 in
// apps/web/src/lib/payments/rail-config.ts
//   durationDays: 21, shieldsOnPurchase: 3, priceUsd6: 1_990_000n
// priceLabel = formatUsd6(priceUsd6) → "$1.99".
export type SeasonChallengeMeta = {
  durationDays: number;   // getSeasonPass("lite_season_pass_21").durationDays
  shieldBonus: number;    // .shieldsOnPurchase
  priceLabel: string;     // formatted from .priceUsd6
};

export type SeasonPassState = {
  active: boolean;        // useSeasonPassStatus(address).active
  isLoading: boolean;
};

// The Lite presenter's full prop contract.
export type HubLiteScaffoldProps = {
  // HUD
  trophies: number;
  isWalletConnected: boolean;
  onConnectTap: (() => void) | null;
  onTrophyTap: () => void;
  // 21-Day Mind Challenge card
  focusPassport: HubFocusPassport;
  challenge: SeasonChallengeMeta;
  seasonPass: SeasonPassState;
  onJoinChallenge: (() => void) | null; // null when pass already active
  // Start Focus (primary daily action)
  primaryFocus: {
    label: string;
    ariaLabel: string;
    onPress: () => void;
    contentLoop: ContentLoopAction | null; // drives label/variant
    isHydrated: boolean;
  };
  // Training Path (horizontal piece roster). deriveRewardTiles already
  // returns the full 6-piece REWARD_TILE_ORDER (rook, bishop, queen, knight,
  // pawn, king) with state locked|progress|claimable|claimed — matches the
  // mock exactly; no extension needed.
  rewardTiles: RewardTile[];
  // Daily gift + language render via self-contained leaves
  // (HubDailyTile, LanguageChip) — no extra props.
};
```

No `any`/`unknown`. `onConnectTap`/`onJoinChallenge` are explicitly nullable
to encode "guest" and "already a pass holder".

## Layout — current → target mapping

| Feature (today) | Source | Target zone (Image #8) |
|---|---|---|
| Trophies / Language / Connect chips | HUD row | Top HUD (unchanged) |
| Daily gift (`HubDailyTile`) | right action-rail | Top-right corner icon (`variant="corner-icon"`, P1-B) |
| Mascot portal (`KingdomAnchor`) + caption | center | Smaller logo + mascot oval |
| Focus Passport (streak dots) | center | **Inside** 21-Day Challenge card |
| Season Pass band ($1.99/+3/21d) | center CTA | **Inside** 21-Day Challenge card (stat tiles + `Join Challenge`) |
| Hero CTA / Content Loop (`NextStepCard`) | center | **Start Focus** primary button |
| Training Path pieces (`RewardColumn`, 6) | left rail (vertical) | **Training Path** horizontal row |
| `TRAIN PIECES` CTA / Practice link | bottom | **Start Focus** + Training Path tiles → `/exercises` |
| Trophies | HUD chip | HUD chip (unchanged) — primary nav to `/trophies` |

(No bottom dock this iteration — see Non-goals.)

## Feature inventory — regression guard (P0-2)

This is **design-only**: no feature is added or removed, only redistributed.
The list below is a checklist so nothing is accidentally dropped when the
layout is recomposed. Every item must be reachable in `HubLiteScaffold`:

- [ ] HUD: Trophies chip → `/trophies`
- [ ] HUD: Language chip (`LanguageChip`, EN↔ES confirm)
- [ ] HUD: Connect chip (guest only) → `connectWallet()`
- [ ] Daily gift (`HubDailyTile`) with claimable/claimed/tomorrow states
- [ ] Focus Passport (streak / totalCompleted / todayDone / loading)
- [ ] Content Loop next action (`NextStepCard` / `contentLoopAction`)
- [ ] Season Pass offer (21 / +3 shields / $1.99) + `SeasonPassSheet`
- [ ] Season Pass active state (ACTIVE + Day X/21 + shields)
- [ ] Training Path: 6 piece tiles with locked/progress/claimable/claimed
- [ ] Mascot + CHESSCITO logo (smaller framing)
- [ ] `lite_session_started` once-per-tab analytics
- [ ] `hub_view` analytics
- [ ] Daily-progress / session-quota / shield in-tab event subscriptions
- [ ] `useShieldSync` boot reconciliation
- [ ] Claim-queue (`useClaimQueue`) for the notif dot
- [ ] Dev-only "+5 mock unlock" button (`NODE_ENV==='development'`)
- [ ] Deep-link `?sheet=trophies` → `/trophies` (Lite ignores shop/pro/badges)
- [ ] `?legacy=1` redirects (page.tsx, pre-switch — unaffected)

## Behavior

1. Given `CHESSCITO_LITE_MODE=true`, when `/hub` renders, then
   `HubLiteScaffold` mounts and `HubScaffold` (Full) does not.
2. Given `CHESSCITO_LITE_MODE` is false/unset, then `HubScaffold` renders
   unchanged and `HubLiteScaffold` never mounts.
3. Given `dailyProgress` is still loading (`null`), when the challenge card
   renders, then it shows the empty streak shell (no filled flames) and the
   Start Focus button shows its safe default label.
4. Given a streak of N days, when the challenge card renders, then the dot row
   fills N of `challenge.durationDays` and the flame anchors day 1.
5. Given the season pass is **active**, then `onJoinChallenge` is null and the
   card shows pass-holder state (no purchase CTA); `Join Challenge` is hidden.
6. Given the session quota `isAtFreeLimit` (session over), when Start Focus is
   pressed, then it routes into **practice/replay of completed exercises**
   (Decision: Start Focus = option A) — `/exercises` opens with completed
   tiles replayable, no stars accrue (star-freeze already shipped). It is
   never a dead tap and never re-pops the "Great focus today!" card (that card
   is one-shot per UTC day). See the Start Focus destination matrix below.
7. Given a guest (no wallet), then the Connect chip shows and `onJoinChallenge`
   still opens `SeasonPassSheet` (purchase flow handles connect).
8. Given a piece tile is `locked`, when tapped in the Training Path, then it is
   a no-op (matches today's reward-tile behavior); `unlocked`/`active` tiles
   route to `/exercises?piece=<id>`.
9. Given the daily gift is claimable, then the top-right gift shows its badge;
   claimed/tomorrow states match `HubDailyTile` today.
10. Given the bottom dock, then Practice/Badges/Trophies/Leaders route to their
    existing destinations; the Home tab is the active hub.

## Start Focus destination matrix (P0-3 resolved — option A)

`Start Focus` always navigates into the daily training; the variant is derived
from `contentLoopAction` × quota. It is never disabled and never a dead end.

| Quota state | Content-loop variant | Start Focus does | Label intent |
|---|---|---|---|
| Not at limit, day not started | next exercise/daily | `/exercises` (fresh) | "Start Focus" |
| Not at limit, mid-progress | resume | `/exercises` (resume) | "Continue" |
| `isAtFreeLimit` (session over) | practice | `/exercises` → completed tiles replayable, **no stars** | "Practice" |
| `isAtHardMax` | practice | same as above | "Practice" |
| Pre-hydration (`contentLoop===null`) | safe default | `/exercises` | default label |

Implementation note: the destination is `/exercises` in every row (the
exercises screen already gates fresh-vs-replay via `quotaState` +
`isExerciseReplayable`). Only the **label** changes, sourced from the existing
`contentLoopAction`. No new "dead/disabled" state is introduced.

## CTA hierarchy (founder + Sally, 2026-06-26, rev2)

Differentiate the two CTAs by **color + light**, not size, so they read as
distinct roles instead of equal-weight siblings. MiniPay-first: the paid
conversion (Join Challenge) is intentionally highlighted, without overpowering
the daily action.

- **Start Focus = gold.** Reuse the **dorado** CTA token family — the same
  flashy gold the `TRAIN PIECES` button uses (Image #12) — so the daily action
  reads as the user's familiar, solid primary. No glow; its weight comes from
  the saturated gold + size.
- **Join Challenge = green + illumination.** Reuse the **verde** CTA token
  family, plus a **subtle glow/halo (gentle pulse, not a harsh blink)** to draw
  the eye to the offer. It lives **inside** the challenge card so the light
  reads as "special offer", not "the button to tap for today". The glow must
  not out-shout the gold Start Focus.
- When the pass is **active**, Join Challenge is replaced by the ACTIVE tracker
  (no competing CTA, no glow).

Token reuse per the CTA token system in `globals.css :root` (verde / azul /
crema / dorado + popup-title) — consume existing families; do NOT mint a new
token for the glow, layer it as a box-shadow/animation over `verde`.

## Streak dot semantics (resolved)

The dot row represents **progress through the 21-day challenge** and MUST mean
the same thing in both card states:

- Each lit dot = one completed focus day in the current challenge; the flame
  anchors the run. Lit count = `min(streak, durationDays)` (clamp at 21).
- Frame as **potential, not deficit**: pre-join the row is a teaser ("light
  these up"), never "you are behind". First position shows the flame.
- The visible pip count is a presentation detail (a compact window is fine if
  21 pips don't fit at 390px), but the **meaning and the lit count source
  (`streak`) are identical** pre- and post-purchase. Label the row consistently
  (e.g. "Focus Passport").

## Red-team PR B — P1 resolutions (2026-06-26)

These three contradictions are resolved here and folded into the contract,
states, and acceptance below. P2/P3 from the PR-B red-team are resolved in their
implementation stages (see `lite-hub-redesign-prb-plan.md`).

### P1-A · Vertical fold budget (the original bug)
The Lite hub is **single-screen-first at 390px**; vertical scroll is a graceful
fallback, never the path to a primary action. Above-the-fold contract (must be
visible without scrolling at a 390×640 reference viewport, MiniPay WebView):
**Start Focus AND the challenge card's primary CTA (Join Challenge, or the ACTIVE
tracker when joined)**. Budget the height by shrinking the mascot/oval zone
(target ≤ 34% of viewport height) and keeping the challenge card compact (single
dot row, 3 stat tiles, one CTA). The Training Path row may sit at/just below the
fold (it is secondary nav), but Start Focus + the card CTA may not. Acceptance
adds a 390×640 layout assertion.

### P1-B · Daily gift is a corner-icon variant of `HubDailyTile`
`HubDailyTile` today renders a full `HubActionTile`; it cannot be a corner icon
"unchanged". Resolution: add `variant?: "tile" | "corner-icon"` to `HubDailyTile`
(default `"tile"` → Full path byte-identical). `"corner-icon"` renders **only**
the gift glyph + claimable/notif badge in the top-right HUD and opens the **same**
`DailyTacticSheet` / welcome-package flow (no logic fork — only the trigger's
presentation changes). No new asset (reuse an existing gift icon from
`public/art/new-icons-chesscito/`). The Lite presenter passes
`variant="corner-icon"`.

### P1-C · Start Focus label is i18n'd, never `ctaEN`
`ContentLoopAction` exposes English-only `ctaEN`/`subEN`. The Lite presenter MUST
NOT render those for Start Focus. Resolution: the **variant** drives the label
via a new i18n map (editorial.ts + `messages/en` + `messages/es`),
`startFocusLabelByVariant[action.variant] → key`, with a safe default key for the
pre-hydration / null case. `contentLoopAction` is consumed only for `variant` +
`destination`; its EN strings are never shown on the Lite hub. ES coverage is
part of the Stage-2 tests.

## UI states & transitions (per CLAUDE.md UI-spec rule)

**21-Day Challenge card**
- `loading` (dailyProgress null) → empty dots, skeleton-safe.
- `not-joined` (pass inactive) → dots + stat tiles + `Join Challenge`.
- `joined/active` (pass active) → dots + "active" affordance, no purchase CTA.
- transition: tap `Join Challenge` → `SeasonPassSheet` opens → on success →
  refresh → `joined/active`.

**Start Focus**
- `loading` → safe default label (i18n default key, per P1-C — never `ctaEN`).
- `available` → label from `startFocusLabelByVariant[variant]` (i18n), routes to
  today's focus.
- `at-limit` (isAtFreeLimit) → practice/replay variant (no dead end).
- transition: press → navigate (exercises/daily) per content-loop action.

**Training Path piece**
- `locked` → lock glyph, tap = no-op.
- `active` → highlighted (current piece), tap → `/exercises?piece`.
- `unlocked` → tap → `/exercises?piece`.

**HUD**
- `guest` → Connect chip visible.
- `connected` → Connect hidden (wallet-derived chips as today).

**Daily gift**: `claimable` / `claimed` / `tomorrow` (delegated to
`HubDailyTile`; Lite passes `variant="corner-icon"` — glyph + badge only, same
sheet flow; per P1-B).

## Edge cases

- `dailyProgress` null vs `streak=0`: both render empty; never show false
  filled days (existing anti-hydration pattern).
- Streak `> durationDays` (>21): clamp dot fill at `durationDays`.
- Pass active AND at free limit: card shows active, Start Focus shows practice
  variant — no contradictory CTA.
- Guest taps Join Challenge: purchase sheet drives connect; no crash.
- `sessionQuotaState` null (pre-hydration): treat as not-at-limit.
- Dev-only "+5 mock unlock" button: preserve behind `NODE_ENV==='development'`
  in the Lite presenter (do not lose the dev affordance).
- Locale switch (LanguageChip) mid-session: card copy re-renders via next-intl.
- SSR/first paint: server render must match client (defer all localStorage
  reads to mount, as today).

## Acceptance criteria

- [ ] `HubLiteScaffold` renders for `CHESSCITO_LITE_MODE=true`; `HubScaffold`
      for false (one switch, asserted by test).
- [ ] Every feature in the current→target table is reachable in the new layout
      (no feature loss) — checklist verified.
- [ ] Challenge card renders all 4 states (loading/not-joined/joined/clamped).
- [ ] Start Focus never produces a dead tap at the free limit.
- [ ] Training Path locked tiles are no-ops; active/unlocked route correctly.
- [ ] `HubScaffold` no longer contains Lite-only branches after extraction.
- [ ] Dev mock-unlock button preserved in dev.
- [ ] Editorial copy via `editorial.ts` + `messages/{en,es}` parity (no inline
      strings); challenge meta from season-pass config (no literals).
- [ ] VR baseline captured for the Lite hub; Full hub baseline unchanged.
- [ ] **PR A** renders Full byte-identical (no VR diff, hub tests green) before
      any Lite presenter exists.
- [ ] No bottom dock is added to the Lite hub.
- [ ] Start Focus routes to `/exercises` in every quota state (never disabled);
      at-limit opens completed exercises for practice with no star accrual.
- [ ] Start Focus uses the `dorado` CTA token (matches TRAIN PIECES); Join
      Challenge uses the `verde` token + a subtle glow; the glow does not
      out-shout Start Focus and is removed when the pass is active.
- [ ] Streak dots lit count = `min(streak, 21)` and the meaning is identical
      pre- and post-purchase.
- [ ] **P1-A** At a 390×640 viewport, Start Focus AND the challenge-card primary
      CTA (Join Challenge / ACTIVE tracker) are above the fold (no scroll);
      asserted by a layout test. Training Path may sit at/just below the fold.
- [ ] **P1-B** `HubDailyTile` defaults to `variant="tile"` (Full byte-identical);
      `variant="corner-icon"` renders gift glyph + badge only and opens the same
      sheet. Lite HUD uses `corner-icon`.
- [ ] **P1-C** Start Focus label comes from the i18n variant→key map (en + es
      parity), never `ctaEN`; pre-hydration uses the safe default key.
- [ ] `pnpm exec tsc --noEmit` clean; existing hub tests pass.

## Out of scope / future

- Hub layout-editor ("Edit" mode) — separate spec if pursued.
- Final button art/tokens for Join Challenge / Start Focus.
- Animating the streak dots / challenge completion celebration.

## Open questions — all resolved (2026-06-26)

1. ✅ **Training Path roster**: `deriveRewardTiles` already returns the full
   6-piece `REWARD_TILE_ORDER` (rook, bishop, queen, knight, pawn, king).
   Reuse as-is.
2. ✅ **Bottom dock**: NO dock this iteration (founder + Sally). "Edit" was a
   capture artifact. See Non-goals.
3. ✅ **Start Focus**: option A — always `/exercises`; at the limit it opens
   completed exercises for practice (no stars). Label varies by content-loop.
   See the destination matrix.
4. ✅ **Challenge meta**: single source `SEASON_PASSES.lite_season_pass_21`
   (`rail-config.ts`): durationDays 21, shieldsOnPurchase 3, priceUsd6 $1.99.
