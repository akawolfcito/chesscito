# Feature parity audit — Full hub vs Lite hub (pre Stage 3b)

**Date**: 2026-06-27
**Scope**: Compare what the Full `HubScaffold` surface exposes against what the
new `HubLiteScaffold` (+ the Lite branch of `HubScaffoldClient`) actually
surfaces, before removing the dead Lite branches from `HubScaffold` (Stage 3b).
Goal: catch any feature accidentally dropped while the Lite layout evolved.

Legend: ✅ present · ⚠️ present but changed/less prominent · ❌ not surfaced ·
🚫 intentionally out of scope for Lite.

## A. Lite inventory checklist (spec P0-2) — current status

| Feature | Status | Where in Lite |
|---|---|---|
| HUD Trophies chip → `/trophies` | ✅ | HUD chip, `onTrophyTap` |
| HUD Language chip (EN↔ES) | ✅ | `<LanguageChip/>` |
| HUD Connect chip (guest only) | ✅ | guest-gated, `onConnectTap` |
| Daily gift (`HubDailyTile`) states | ⚠️ | now the **corner-icon** variant (claimable badge); less prominent than the old tile but reachable |
| Focus Passport (streak/total/today/loading) | ⚠️ | merged into the ChallengeCard **progress bar** (`N/21 focus days`); the 7-flame row was replaced by the bar |
| **Content Loop next action** (`NextStepCard`) | ❌ | **NOT surfaced** — Start Focus is now a fixed "Start Focus" CTA; `primaryFocus.contentLoop` is passed but unused. See Gap G1 |
| Season Pass offer (21/+3/$1.99) + sheet | ✅ | ChallengeCard offer + `SeasonPassSheet` |
| Season Pass active (ACTIVE + Day X/21 + shields) | ✅ | ACTIVE chip + `X/21 day` tile (shields = `+3` tile) |
| Training Path: 6 tiles w/ states | ✅ | `RewardColumn` row, `/exercises?piece=` |
| Mascot + CHESSCITO logo | ✅ | avatar + title art |
| `lite_session_started` analytics | ✅ | client effect (scaffold-independent) |
| `hub_view` analytics | ✅ | client effect |
| daily-progress / session-quota / shield subscriptions | ✅ | `useHubData` subscriptions |
| `useShieldSync` boot reconcile | ✅ | client root |
| Claim-queue (`useClaimQueue`) | ⚠️ | hook runs, but the notif **dot has no home** in the Lite HUD (no avatar chip). Pre-existing deferred item |
| Dev-only "+5 mock unlock" | ✅ | client, `NODE_ENV==='development'` + at-limit |

## B. Intentionally dropped in Lite (🚫 by scope — confirm acceptable)

These Full surfaces are correctly absent from Lite (Lite = habit/daily focus,
no monetization rails beyond the Season Pass):

- PRO chip + ProSheet, Coach chip, Premium slot, PRO right-rail tile.
- Shop / shields chip + ShopSheet + PurchaseConfirmSheet, Peones balance chip.
- Enter Arena CTA + Arena tile + Mini-arena (rook★≥12), Mission ribbon.
- Secondary "practice" text-link (replaced by Start Focus + Training Path → `/exercises`).
- Badges sheet (Lite ignores `?sheet=badges`); Profile sheet deep-link is
  intentionally a ProSheet no-op in Lite.
- Bottom dock (explicit Non-goal this iteration).

## C. Gaps / regressions to decide on BEFORE Stage 3b

### G1 — Content Loop "next best action" is no longer surfaced (real loss)
Old Lite rendered `<NextStepCard>` driven by `contentLoopAction`, which
surfaced the contextual next step: `claim-pending` ("Claim your gift"),
`daily-pending` ("Today's Focus"), `daily-limit-reached` / `daily-max-reached`
("session over / come back"), `continue-path`, `labyrinth-ready`,
`improve-stars`, `next-piece`, `come-back-tomorrow`, `view-progress`.

New Lite: Start Focus is a **fixed** "Start Focus" → `/exercises` in every
state (founder choice). `primaryFocus.contentLoop` is plumbed but **unused**.
Consequences:
- The **welcome-gift** prompt is now only the small corner gift icon (still
  reachable, lower prominence).
- The **session-limit** states (free-limit / hard-max) get **no hub-level
  signal**; the user only discovers the cap on the exercises screen. (Note:
  the recent "wolf-mage session-limit card" ships on the daily/exercises flow,
  not the hub — verify that still fires so the cap isn't silent.)
- `come-back-tomorrow` / `view-progress` nudges are gone.

**Decision needed**: (a) accept — Start Focus stays fixed, content-loop nudges
live elsewhere (gift icon + exercises screen); or (b) re-surface a slim hint
(e.g., a one-line sub-label under Start Focus, or a small status pill) for the
high-value states only (claim-pending, at-limit). Either way, remove the now-
dead `primaryFocus.contentLoop`/`nextStepCard` plumbing if we keep (a).

### G2 — Focus Passport representation changed (flames → progress bar)
Not a loss of data (streak still shown as `N/21 focus days` + fill), but the
7-flame streak affordance and its per-day glow are gone. Confirm the bar is the
intended final representation (it is more accurate to the 21-day challenge).

### G3 — Claim-queue notif dot has no anchor in Lite
`useClaimQueue` runs but the unread-claims dot was historically meant for an
avatar slot that the Lite HUD doesn't render. Pre-existing deferred debt;
flag so it isn't assumed "wired".

## D. Recommendation
1. Resolve **G1** (accept fixed Start Focus, or add a slim hint for
   claim-pending + at-limit). This is the only genuine UX regression.
2. Confirm **G2** (progress bar is final) and **G3** (notif dot deferred).
3. THEN run Stage 3b: remove the dead Lite branches from `HubScaffold`
   (`focusPassport`, `nextStepCard`, `onSeasonPassPress`, the
   `!CHESSCITO_LITE_MODE` chip guards) and, per G1(a), drop the unused
   `contentLoop`/`nextStepCard` plumbing from the Lite path too.
4. Everything else in the inventory is present or an accepted scope drop.
