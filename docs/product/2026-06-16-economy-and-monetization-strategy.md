# Chesscito — Economy & Monetization Strategy (insumo para validar)

**Date:** 2026-06-16 · **Status:** Proposal for founder validation — NO
implementation until the model is chosen. · Author: senior F2P-economy lens
(adversarial strategist pass) + cross-checked vs code.

Builds on the existing notes `docs/product/2026-06-08-peones-economy-philosophy-and-future-sinks.md`,
`docs/product/2026-06-10-savescore-share-leaderboard-economy-proposal.md`,
`docs/design-patterns/game-economy-patterns.md`.

> Cross-check note: amounts below were read from code but should be re-confirmed
> at implementation time (treat as draft figures).

## Executive take

Chesscito has solid economic *plumbing* (append-only Peones ledger, idempotent
earn/spend, a fail-closed MiniPay stablecoin rail, 4 real-money SKUs) but a
**demand problem, not a supply problem** — the founder's own note already says
"Peones se sienten como número en HUD, no como recurso." The sinks are trivial
(1 Peón each) and the only recurring sink (Coach) is bypassed by PRO and by
credit packs, so a paying user never spends Peones at all. Worse, the earn
engine sits on a **finite, hand-authored catalog (~60 exercises + 18
labyrinths)** that pays once per item and never again — an economy with no daily
heartbeat. **#1 recommendation: build a daily-reset loop with a real recurring
sink (Streak Freeze + Deep Hint), the only thing that keeps a finite-content
game economically alive day-over-day.**

## Current economy map (cited)

**Earn** (server-trusted, daily cap **6/UTC day** — `lib/peones/types.ts`):
Daily Tactic +3 (`lib/daily/peones-earn.ts`); exercise/labyrinth first
completion **+1 flat** (`lib/peones/{training,labyrinth}-earn.ts`); welcome pack
+1 once; pack purchase +50 (real money, `lib/payments/rail-config.ts`).

**Sinks** (single currency, all minor — `lib/peones/spend-service.ts`): Hint 1 ·
Coach analysis 1 (PRO + Redis credits BYPASS) · Save off-chain 1 (after 3 free) ·
Retry 2 (deprecated, never charged) · Labyrinth key (reserved, not shipped).

**Real-money rails** (ERC20 → treasury via MiniPay/MetaMask): PRO 30-day $1.99
(`shop-catalog.ts`) · Peones pack $0.50→50 · Coach packs $0.05/$0.10 · Founder
Badge ~$0.10 · Shields · on-chain victory save $0.005–0.02 by difficulty.
**Treasury currently unset → pack rail fail-closed** (matches the payment
fail-closed rule).

**The loop:** free play earns ≤6/day from a depleting catalog; money enters
mostly via Coach (PRO + packs); Peones drain via 1-Peón optional actions. The
**cash rail and the soft currency are divorced** — payers bypass Peones, Peones
users have no reason to pay.

## Diagnosis (opinionated)

1. **No painful sink.** 6/day cap + ~2 optional 1-Peón actions = players end most
   days net-positive; the currency is a vanity counter.
2. **No daily heartbeat.** Exercises/labyrinths pay once forever; after clearing
   ~78 items the only income is +3/day. That's a countdown, not a loop.
3. **Split-brain.** PRO + credits bypass Peones, so the paying user never touches
   the economy and the Peones user never pays. Neither side reinforces the other.
4. **Content-finiteness is the structural threat** (the FEN pipeline spec targets
   supply; this targets demand). Mastery stars exist but are economically inert.
5. **Leak:** retention dies at content-exhaustion; monetization leans on Coach —
   an advanced desire sold to a pre-chess beginner audience ("steak to people
   learning to chew").

## Three models (ranked)

### 🥇 #1 — Daily loop + loss-aversion sink (the heartbeat) — DO FIRST
Make the daily cycle the spine: Daily Tactic + **Streak Freeze (3–5 Peones)** +
**Daily reroll (3)** + **Deep Hint (3)**. Peones become a daily drain you
occasionally top up with the $0.50 pack to save a streak.
- **Reuses:** shield mechanic (`lib/shop/shield-*`), streak counter
  (`lib/daily/progress.ts`), pack rail, Deep Hint (already specced twice).
- **Precedent:** Duolingo Streak Freeze — loss aversion ≈ 2× gain motivation.
- **Impact:** renewable daily drain + connects Peones↔cash + fixes the
  split-brain. **Highest ROI; mechanics already exist.**
- **Risk:** must not tax *learning* (founder's anti-tax rule §7) → these are NEW
  optional sinks, the free first-move hint stays.

### 🥈 #2 — Cosmetic / theme economy (the vanity sink) — NEXT
Peones → board skins, piece sets, Wolfcito/avatar variants; premium themes
behind PRO or higher Peones price.
- **Reuses:** the **theme system is built and dormant** (`useThemeAsset`) + the
  just-shipped rival avatar variants — lowest-infra big sink available.
- **Precedent:** Clash Royale skins — cosmetics decouple spend from progression
  (no "learning tax").
- **Impact:** the only sink that absorbs *unlimited* Peones long-term and gives
  the $0.50 pack a permanent reason. Slow burn — needs retention first.
- **Risk:** needs art assets (the bottleneck).

### 🥉 #3 — Coach-as-the-product, repositioned (depth sink) — EXPANSION ARPU
Lean into Coach as the premium tier (Deep Dive, multi-game reports), routed via
Peones OR PRO.
- **Reuses:** the whole Coach + PRO + packs stack.
- **Precedent:** Chess.com Game Review paywall.
- **Impact:** highest revenue-per-payer but **smallest audience** in a beginner
  product. Build it, don't lean the economy on it.

**Sequence: #1 now → #2 next → #3 as it matures.**

## Missing core pieces (decisive)

1. **A daily-reset loop with a recurring sink — THE foundational gap, build
   first.** (a) a streak players fear losing, (b) a sink that protects it +
   optional recurring spends (Deep Hint/reroll), (c) daily reset pressure.
2. **A mastery/progression ladder that uses finite content as fuel.** Stars are
   inert today; tie milestones ("3★ all rook drills → crown/theme/Peones
   bounty") so 78 items become a journey with payouts, not a one-shot checklist.
3. **Second currency — verdict: NO.** ~78 items, beginner audience, single dev →
   a hard currency adds UX surface + exchange confusion on 390px. Keep **Peones
   as the one soft currency** and let the **$0.50 stablecoin pack be the de-facto
   premium tier**. Revisit only post-listing with real volume.

## Worthwhile features (low–med effort, each tied to an existing asset)

1. **Streak Freeze** (3–5 Peones) — reuses shields + streak. Surface at the
   rescue moment. *Highest ROI.*
2. **Deep Hint** (3 Peones) — already specced; premium tier of the 1-Peón hint.
3. **Daily reroll** (3 Peones) — reuses `lib/daily/daily-puzzles.ts`.
4. **Theme unlock with Peones** — first cosmetic (1 board skin @ ~50 Peones) to
   prove the vanity sink; reuses the dormant theme system.
5. **Mastery milestone payouts** — reuses the star system; finite content → ladder.
6. **The bridge (highest-value wiring):** when Peones run out at a streak-break
   moment, deep-link to the $0.50 pack (`GetPeonesSheet` + `AddCashCta`) — the
   one place scarcity converts to cash.

**Founder-rule guardrails respected:** no "MiniPay game" copy; pre-launch; no
learning tax (only NEW optional sinks, never raise existing free-action costs
mid-flight); plain language (no NFT/mint jargon); single currency; fail-closed pay.

## Decisions to validate (before any implementation)

1. **Pick the spine:** confirm #1 (daily loop + Streak Freeze + Deep Hint) as the
   first economy build. (Recommended.)
2. **Streak strictness on a learning product** — how punitive may a streak be
   before it violates the anti-tax rule? (Needs founder call.)
3. **Mastery ladder payouts** — do milestones pay Peones, unlock cosmetics, or
   both?
4. **Sequence vs the FEN content pipeline** — demand-side (this) likely precedes
   or parallels the supply-side (pipeline); confirm order.
