# Chesscito Lite — Mini Grant Pack

**Date:** 2026-06-20
**Status:** Lite P0 closed (smoke passed on `lite-preview`)
**Context refs:** `docs/handoffs/2026-06-20-lite-p0-closure-handoff.md` ·
`docs/reviews/2026-06-18-celopedia-ecosystem-fit-and-grants-strategy.md`

---

## One-liner

> **Chesscito Lite turns chess into a daily focus ritual on MiniPay: short
> challenges, visible progress, zero friction — no wallet funds required to
> start.**

---

## User flow

1. Open MiniPay → launch Chesscito Lite.
2. Land on **Hub Lite** — clean, focus-first surface (no shop, no upsell).
3. Tap **Daily Focus** → solve a short chess challenge.
4. **Solve it** → celebratory overlay + visible progress (YOUR PROGRESS).
5. Keep training: **Exercises** (piece movement) and **Labyrinths**.
6. Track growth in **Trophies/Progress** (Achievements only).
7. **Share** result → return tomorrow for the next focus day.

> Playable without funding the wallet → lowest possible activation barrier for
> first-time MiniPay users.

---

## Key screenshots (to attach)

- Hub Lite (focus-first, no monetization surfaces)
- Daily Focus — playable challenge
- Daily solved — celebratory overlay (no Peones)
- Trophies/Progress — Achievements + YOUR PROGRESS hero band
- Account — Wallet / Network / Language only

> Capture pending — see handoff §3. Store under `docs/grants/assets/`.

---

## Value for MiniPay / Celo

- **Daily-use app beyond finance** — a reason to open MiniPay every day that
  isn't a transaction.
- **Mobile-first, 390px** — built natively for the MiniPay viewport.
- **Zero-friction onboarding** — Lite is playable without funds; no web3 jargon
  on entry surfaces.
- **Focus / cognitive training** — visible progress loop drives retention.
- **Stablecoin-ready** — Full mode adds optional stablecoin actions (Peones,
  PRO, on-chain proof) once a user is engaged — a clean upgrade path on Celo.
- **Educational** — teaches chess from piece movement up, broad audience.

---

## What Chesscito Lite is NOT

- ❌ Not a casino / gambling app
- ❌ Not a trading or DeFi app
- ❌ Not NFT-first (no mint language anywhere in Lite)
- ❌ Not a medical / clinical "brain training" claim
- ❌ Not a full chess platform (no PvP ladder, no engine analysis in Lite)
- ❌ Not pay-to-play (Lite requires no funds)

---

## Metrics / evidence available

- ✅ **P0 smoke checklist** (17/17 passed) — see handoff §2.
- ✅ **Surface isolation verified** — Lite hides Shop/PRO/Peones/Coach/Arena/NFT;
  Full-only deep links (`/arena`, `/shop`, `/coach`, `?sheet=shop`) blocked.
- ✅ **No Full-mode regression** confirmed in same smoke.
- ⏳ **Screenshots** — pending capture (handoff §3).
- ⏳ **Usage telemetry** — not yet instrumented for Lite (future: daily active,
  focus-day completion, return rate).

---

## Roadmap signal (not in P0)

- **P1 — Focus Passport** (spec next, not built): 7-day focus progress +
  streak. Spec only.
- Welcome Package: deferred. Not in current scope.
