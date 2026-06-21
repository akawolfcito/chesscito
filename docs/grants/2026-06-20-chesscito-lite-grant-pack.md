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

| Layer | Component | Status |
|---|---|---|
| Daily habit | Daily Focus | Shipped |
| Consistency | Focus Passport (7-slot visual) | Shipped |
| Recognition | Lite Achievements (First Focus Day / 3-Day Rhythm / 7-Day Focus) | Shipped |
| Reward | Welcome Package (pending to claim) | Shipped |
| Progress | Trophies / YOUR PROGRESS hero band | Shipped |
| Training continuity | Exercise Path Sequencing (auto-advance through interleaved exercises + labyrinths) | Shipped |

---

## Key screenshots (to attach)

See full checklist and capture notes in [`docs/grants/assets/README.md`](assets/README.md).

| # | File | Surface |
|---|------|---------|
| 1 | `assets/01-hub-lite.png` | Hub Lite — focus-first, no monetization surfaces |
| 2 | `assets/02-daily-focus.png` | Daily Focus — playable challenge, mid-solve |
| 3 | `assets/03-focus-passport.png` | Focus Passport — 7-slot streak visual |
| 4 | `assets/04-lite-achievements.png` | Trophies — Lite Achievements + YOUR PROGRESS hero band |
| 5 | `assets/05-claim-gift.png` | Welcome Package — Claim Gift overlay on Hub |
| 6 | `assets/06-exercises-path.png` | Exercises — interleaved path (exercise + labyrinth rows) |
| 7 | `assets/07-labyrinth-active.png` | Labyrinth — challenge in progress |
| 8 | `assets/08-account-lite.png` | Account Lite — Wallet / Network / Language only |
| 9 | `assets/09-stats-public.png` | /stats — public metrics page |

> Captures pending. See [`docs/grants/assets/README.md`](assets/README.md) for status checklist.

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
