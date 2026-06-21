# Chesscito Lite — Mini Grant Pack

**Date:** 2026-06-20 (updated 2026-06-21)
**Status:** Lite P0 + P1 closed (Focus Passport + Welcome Package shipped)
**Context refs:** `docs/handoffs/2026-06-20-lite-p0-closure-handoff.md` ·
`docs/handoffs/2026-06-20-focus-passport-p1-1-closure-handoff.md` ·
`docs/reviews/2026-06-18-celopedia-ecosystem-fit-and-grants-strategy.md`

---

## One-liner

> **Chesscito Lite turns chess into a daily focus ritual on MiniPay: short
> challenges, visible progress, zero friction — no wallet funds required to
> start.**

---

## User flow

1. Open MiniPay → launch Chesscito Lite.
2. Land on **Hub Lite** — focus-first surface (no shop, no upsell).
3. Tap **Daily Focus** → solve a short chess challenge.
4. **Solve it** → celebratory overlay + visible progress (YOUR PROGRESS).
5. **Focus Passport** tracks 7-day streak with llama-slot visual (blue = previous day, colored = today/active, gray = pending).
6. Keep training: **Exercises** (piece movement) and **Labyrinths**.
7. Track growth in **Trophies/Progress** — Lite Achievements only.
8. Unlock **Welcome Package** after first focus day → claim your reward.
9. **Share** result → return tomorrow for the next focus day.

> Playable without funding the wallet → lowest possible activation barrier for
> first-time MiniPay users.

---

## Lite loop (shipped)

| Product piece | Component | Status |
| --- | --- | --- |
| Daily Focus | Daily Focus challenge (piece movement) | Shipped |
| Focus Passport | 7-slot streak visual (llamas) | Shipped |
| Lite Achievements | First Focus Day / 3-Day Rhythm / 7-Day Focus | Shipped |
| Claim Gift / Welcome Package | Pending → Claim → Claimed flow | Shipped |
| Exercises | Piece-movement exercises with star ratings | Shipped |
| Labyrinths | Multi-step challenge routes, interleaved with exercises | Shipped |
| Exercise Path Sequencing | Auto-advance through interleaved exercises + labyrinths | Shipped |
| Save Flow Simplification | Progress saves without wallet friction | Shipped |
| Lite Account | Clean account surface (no Arena Wins / Saved Victories) | Shipped |
| Public Stats | `/stats` page with platform-level metrics | Shipped |

---

## Key screenshots (to attach)

See full checklist and capture notes in [`docs/grants/assets/README.md`](assets/README.md).

| # | File | Surface |
| --- | --- | --- |
| 1 | `assets/01-hub-lite.png` | Hub Lite — focus-first, no monetization surfaces |
| 2 | `assets/02-daily-focus.png` | Daily Focus — playable challenge, mid-solve |
| 3 | `assets/03-focus-passport.png` | Focus Passport — 7-slot streak visual |
| 4 | `assets/04-lite-achievements.png` | Trophies — Lite Achievements + YOUR PROGRESS hero band |
| 5 | `assets/05-claim-gift.png` | Welcome Package — Claim Gift overlay on Hub |
| 6 | `assets/06-exercises-path.png` | Exercises — interleaved path (exercise + labyrinth rows) |
| 7 | `assets/07-labyrinth-active.png` | Labyrinth — challenge in progress |
| 8 | `assets/08-account-lite.png` | Account Lite — Wallet / Network / Language only |
| 9 | `assets/09-stats-public.png` | /stats — public metrics page |

> All 9 screenshots captured (2026-06-21). See [`docs/grants/assets/README.md`](assets/README.md) for full checklist.

---

## Value for MiniPay / Celo

- **Daily-use app beyond finance** — a reason to open MiniPay every day that
  isn't a transaction.
- **Mobile-first, 390px** — built natively for the MiniPay viewport.
- **Zero-friction onboarding** — Lite is playable without funds; no web3 jargon
  on entry surfaces.
- **Visible focus loop** — Daily Focus, Passport, Achievements, Welcome Package drive return habit.
- **Stablecoin-ready** — Full mode adds optional stablecoin actions (Peones,
  PRO, on-chain proof) once a user is engaged — a clean upgrade path on Celo.
- **Educational** — teaches chess from piece movement up, broad audience.

---

## What Chesscito Lite is NOT

- Not a casino / gambling app
- Not a trading or DeFi app
- Not NFT-first (no mint language anywhere in Lite)
- Not a medical / clinical "brain training" claim
- Not a full chess platform (no PvP ladder, no engine analysis in Lite)
- Not pay-to-play (Lite requires no funds)

---

## Metrics / evidence available

### Platform-level (Supabase — verifiable at `/stats`)

- Total Victories Saved on Celo (Full mode only, from `victories` table — Lite progress is local-only)
- Approx. App Sessions (7d / 30d — anonymous, from `analytics_events`)
- Welcome Packs Claimed (lifetime + 7d, from `welcome_pack_claims`)
- On-chain transaction counts by method (progress saves, score saves, Get Peones)
- Unique on-chain wallets (lifetime)
- Community Leaderboard (top 10)
- External verification: Talent Protocol dashboard + Celoscan

### Device-level (localStorage — honest scope)

These metrics exist per-device. They are not cross-device or global aggregates.
Presented as local progress when relevant.

- `DailyProgress.totalCompleted` — Focus Sessions completed on this device
- `DailyProgress.streak` — Current streak (days)
- `deriveLiteAchievements(progress)` — Achievements unlocked (up to 3: First Focus Day / 3-Day Rhythm / 7-Day Focus)
- `welcomePackage.isClaimed` — Welcome Package claimed on this device
- `welcomePackage.isPending` — Welcome Package pending claim

> Not yet available: Global Lite DAU, platform-wide Focus Sessions count,
> cross-device retention cohorts. These require a future analytics layer
> (out of current scope).

---

## What reviewers can test

Open `https://lite.chesscito.com` (or MiniPay → Chesscito Lite) and walk through:

- [ ] Open Lite — Hub loads focus-first, no shop or upsell surfaces
- [ ] Tap **Daily Focus** — chess challenge loads and is playable
- [ ] Solve the challenge — progress overlay + YOUR PROGRESS bar updates
- [ ] See **Focus Passport** — streak slots reflect completed days
- [ ] Open **Trophies** — only 3 Lite achievements shown (not Full mode list)
- [ ] Trigger **Claim Gift** — Welcome Package overlay appears after first focus day
- [ ] Open **Exercises** path — interleaved list (Exercise → Labyrinth → Exercise…)
- [ ] Tap a **Labyrinth** row — labyrinth challenge loads and is playable
- [ ] Open **Account** (Lite) — no Arena Wins / no Saved Victories visible
- [ ] Visit `/stats` — public metrics page renders with platform data

---

## Known limitations

These are honest gaps — none block grant review:

- **Progress is local-first.** Focus Sessions, streak, and achievements are stored per-device. Cross-device sync requires a future auth + backend layer (P2).
- **Global Lite cohorts are limited.** Platform-wide Lite DAU and focus completion counts are not yet available — they require a dedicated analytics layer not in current scope. Per-device data is accurate.
- **Content loop is the next milestone.** Current Daily Focus content is finite; a rotation/content-loop system is the primary post-grant build.
- **Minor UX polish remaining.** Post-labyrinth completion end-state and dock navigation (Pieces/Home) have known minor polish items that do not affect core flow.

---

## What funding unlocks

Grant resources would go directly toward:

1. **More Daily Focus content** — daily challenge rotation system so content refreshes and users return each day
2. **More Exercises and Labyrinth routes** — broader piece coverage (bishop, knight, pawn) beyond the current rook-first path
3. **Stronger content loop** — author tooling to produce, publish, and schedule new challenges without redeploy
4. **Better MiniPay-first onboarding** — first-session polish, guided first focus day, contextual tooltips
5. **Retention improvements** — streak recovery mechanics, milestone celebrations, re-engagement nudges
6. **Better public metrics** — Lite-specific DAU, daily completions, cross-device retention cohorts
7. **More polished reward flow** — Claim Gift visual polish, post-labyrinth completion end-state

---

## Demo script (60–90 seconds)

Designed for a live walkthrough or screen recording. No narration required — UI is self-explanatory.

**Step 1 — Hub Lite (0–10s)**
Open Chesscito Lite. Show Hub: Focus Passport at top, wizard character, Training Path sidebar. Point out: no shop chips, no upsell surfaces.

**Step 2 — Daily Focus (10–30s)**
Tap "Daily Focus". Challenge loads — board visible, piece shown. Make a valid move. Completion overlay fires — YOUR PROGRESS bar updates.

**Step 3 — Focus Passport (30–40s)**
Return to Hub. Focus Passport slot for today is now lit (flame icon, active color). Prev day shown in blue. Show the streak label.

**Step 4 — Achievements (40–50s)**
Tap Trophies. Show Lite achievements only: "First Focus Day" unlocked. "3-Day Rhythm" and "7-Day Focus" locked but visible as goals. YOUR PROGRESS hero band visible.

**Step 5 — Claim Gift (50–60s)**
If Welcome Package is pending: show the pedestal-pin overlay on Hub. Tap "Keep it" to claim.

**Step 6 — Exercises path (60–75s)**
Open Exercises drawer. Scroll: Exercise 1 (★★★ completed), Exercise 2 (★★★ completed), Labyrinth 1 (READY), Exercise 3 (★ partial), Labyrinth 2 (locked). Tap Labyrinth 1 — labyrinth board loads.

**Step 7 — Account + Stats (75–90s)**
Open Account. Show: Wallet / Network / Language — no Arena Wins / Saved Victories in Lite. Navigate to `/stats` — public metrics page with Welcome Packs Claimed, Unique Wallets, etc.

---

## Submission copy

### One-liner

Chesscito Lite turns chess into a daily focus ritual for MiniPay users — short challenges, visible progress, zero friction.

### Short description (80 words)

Chesscito Lite is a focus-first chess learning miniapp for MiniPay. Every day, users complete a short chess challenge, advance their Focus Passport streak, and unlock achievements. The interleaved Exercises and Labyrinth path teaches piece movement progressively. Claiming the Welcome Package rewards the first focus milestone. No wallet funds required to start — Lite is playable with zero friction on day one.

### Long description (200 words)

Chesscito Lite is a habit-building chess learning app designed natively for MiniPay and the Celo mobile ecosystem.

The core loop: open MiniPay → tap Daily Focus → solve a short chess challenge → see visible progress. The Focus Passport tracks a 7-day streak with a clear visual (llama slots: blue = previous day, colored = active, gray = pending). Three Lite Achievements mark real milestones: First Focus Day, 3-Day Rhythm, and 7-Day Focus.

The Exercises and Labyrinth path teaches piece movement progressively. Exercises and Labyrinths are interleaved — completing an exercise unlocks the next labyrinth, and vice versa. The Save Flow is frictionless: progress saves without requiring wallet funds or signatures at every step.

When a user completes their first focus day, the Welcome Package unlocks — a Claim Gift moment that reinforces the habit loop.

Public metrics are available at `/stats`: Welcome Packs Claimed, platform sessions, and more.

Chesscito Lite requires no wallet funds to play. It is not a casino, not DeFi, not pay-to-play. It is a daily focus ritual on Celo.

### Current status

Lite P0 + P1 shipped. Core habit loop fully functional. All 10 shipped product pieces verified in smoke testing. Screenshots available in `docs/grants/assets/`.

### Grant unlocks

Content rotation for Daily Focus, broader Exercises and Labyrinth coverage, cross-device progress sync, Lite-specific retention analytics, and onboarding polish for first-time MiniPay users.

### Demo steps (for submission form)

1. Open Chesscito Lite (lite.chesscito.com or MiniPay)
2. Tap Daily Focus → solve the chess challenge
3. See Focus Passport update with today's completed slot
4. Open Trophies → view Lite Achievements
5. If Welcome Package is pending: claim it from Hub
6. Open Exercises → scroll the interleaved path (exercises + labyrinths)
7. Tap an available Labyrinth → play it
8. Open Account → confirm Lite-only view
9. Visit /stats → see public platform metrics

---

## P0 smoke evidence (17/17 passed)

- Hub Lite renders focus-first (no Shop / PRO / Peones / Coach / Arena)
- Daily Focus playable and completes
- Focus Passport tracks streak visually
- Lite Achievements filtered (only 3 Lite achievements shown, not Full achievements)
- Welcome Package: pending, claim, claimed flow
- Account: no Arena Wins / no Saved Victories in Lite
- Full mode: no regression (all Full surfaces intact)
- Deep links to Full-only surfaces (`/arena`, `/shop`, `?sheet=shop`) blocked in Lite

---

## Roadmap signal (post-P1)

- P1.5: Focus Passport calendar with real `completedDates[]` (requires backend)
- P2: Cross-device Lite progress sync (requires auth + backend)
- P3: Platform-level Lite DAU / focus completion analytics
