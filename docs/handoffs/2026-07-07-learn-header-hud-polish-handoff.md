# Handoff — LEARN Header System + Focus Panel + Account Consolidation

**Date:** 2026-07-07
**Branch/PR:** `feat/learn-pro-hud-chips` → **merged to `main` as PR #167** (`daea4466`). Branch deleted.
**UX spec:** `_bmad-output/planning-artifacts/2026-07-06-learn-header-consistency-ux-spec.md` (Sally, approved 2026-07-06). Note: `_bmad-output/` is gitignored — spec lives locally only.

## What shipped

### LEARN (Lite hub) header — cohesive system
- Grammar matches PLAY/FULL: **left cluster** = status pills (trophy · Peones · language), **right anchor** = account. One baseline (`align-items:center`), 6px in-cluster / 12px between-cluster gaps. Gift resized 52→44px, seated on the line (was floating).
- **Account** = compact gold-ringed circle (`avatar-small-account`), routes to `/exercises?sheet=account` (new deep-link). PRO → brighter ring accent.
- **Peones chip** moved to the left cluster + green "+" recharge affordance (hub only, `showRecharge` prop; opens Chesito Card → Get Peones rail).

### PRO LEARN treatment
- PRO avatar (`avatar-pro`, regenerated to 499×560 = layout-shift-free swap) + gold Start Focus ring, both gated by `seasonPassStatus.source === "pro"` (SAME signal as ChallengeCard → flips in lockstep on first load; NOT a second `/api/pro/status` fetch). See [[feedback_duplicate_stateful_hook_desync]].

### Mind Challenge panel
- "PRO Benefit included" → gold **crown badge** (not the green Active pill). `21-day-icon` replaces `21-challenge-icon`.
- **Ticket + shield-check** icons on the PRO stat row (Training Pass / Access active).
- Progress bar → **7 streak flames + "N/21 focus days"** ordinal (restored pre-`70ee44f7` view; flames 1.15rem). **No weekday labels** — data-honest (no `completedDates[]`, streak-derived only).
- Flame/streak block is a **tap target** into today's focus (`onFocusTap` → `primaryFocus.onPress`).

### /exercises
- Dropped standalone Peones chip from header (**Account-only** now). **Chesscito Card** (balance + "+") is the hero inside the Account sheet in every mode (was gated to `!LITE`). One wallet home.
- Lite dock now inherits the base **`menu-wall` 5-panel bg** (was `dock-4slots`) — removed the `.chesscito-dock--lite` override. Dock = 5 slots (badge·shop·pieces·trophies·leaders).

## Tests / VR
- **Full suite green: 4666 passing** (389 files). Added coverage: tappable focus, PRO/guest chip states, dock.
- Fixed a **pre-existing** failure: `learn-shop-sheet.test.tsx` lacked a wagmi mock (WagmiProviderNotFoundError) — `a7b40457`.
- VR (`pnpm test:e2e:visual`): **cluster surfaces clean** (50 passed). 2 pre-existing failures, NOT from this cluster:
  - `about-page` — ~1% icon decode drift → baseline refreshed (`2d402719`).
  - `shop-sheet` — env-dependent: PRO buy pill shows "Coming soon" (`item.configured === false`) without local shop price config → precondition `.toContainText("$")` fails before the screenshot. Would fail on main too.

## Design decisions (locked)
- **PRO capsule on LEARN header: DROPPED** by founder — header space is tight + asset swap too noticeable. Instead the `title-chesscito` wordmark will be adapted to read "CHESSCITO PRO" **later** (not scoped yet).
- **Focus weekday labels: dropped** — needs real `completedDates[]` (P1.5 backlog); streak-derived flames can't map to real weekdays honestly.

## Open items / next steps
1. **Shop dock-slot design** (founder undecided): the SHOP dock slot opens an effectively 1-item shop (PRO only in Lite). Options in spec §3-note: **enrich** to >1 SKU (Peones packs + themes + shield) to earn the slot, or **demote** to the Account sheet. Bonus: 3 of 5 dock slots are achievement surfaces (badges/trophies/leaders) — consolidation candidate.
2. **`shop-sheet` VR is env-dependent** — needs the shop configured with prices to run locally; flag as test-infra debt.
3. **Orphaned assets:** `apps/web/public/art/redesign/bg/dock-4slots.{png,webp,avif}` now unused (dock bg swapped). Confirm before deleting.
4. **"CHESSCITO PRO" wordmark** adaptation (deferred, see above).
5. **`avatar-pro` framing** — bottom-aligned into the 499×560 box; if a future PRO avatar art ships, regenerate with the same box to keep the swap shift-free.

## Key files
- `apps/web/src/components/hub/hub-lite-scaffold.tsx` — LEARN header + PRO avatar/ring + chips.
- `apps/web/src/components/hub/challenge-card.tsx` — flames, PRO badge, stat icons, tappable focus.
- `apps/web/src/components/hub/legacy-hub-client.tsx` — `isPro` + `onAccountTap` wiring.
- `apps/web/src/components/exercises/exercises-screen.tsx` — header Account-only, ChesitoCard hero, `?sheet=account` deep-link.
- `apps/web/src/components/peones/peones-balance-chip.tsx` — `showRecharge` "+" affordance.
- `apps/web/src/app/globals.css` — header cohesion, flames, dock bg, chip styles.
