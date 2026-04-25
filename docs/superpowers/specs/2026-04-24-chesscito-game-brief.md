# Chesscito — Game Brief

*A Den Labs experiment — cognitive exercise gamified, chess as the vehicle.*

| Field | Value |
|---|---|
| Date | 2026-04-24 |
| Author | Wolfcito — facilitated by Samus Shepard (BMAD Game Designer) |
| Status | v0.3 — locked (Coach's Pause + landing scope added) |
| Parent brand | Den Labs (web2/web3/AI experience lab) |
| Type | Cognitive exercise gamified. Chess as vehicle. |

---

## 1. Elevator pitch

Chesscito is a cognitive exercise gamified as a chess-learning journey, designed to stay fun for kids and adolescents while building daily habits that may mitigate neurodegenerative decline later in life. Adults and web3 sponsors fund the pool; kids earn on-chain proof of cognitive engagement. First vertical of Den Labs' cognitive platform thesis.

---

## 2. Core fantasy

> *"I'm not practicing chess — I'm solving puzzles, climbing a tower, proving I understand every piece. And when I'm ready, real chess opens up to me."*

The player feels **guided mastery**. Not gated. Not patronized. Not rushed. Each piece unlocks its own identity through three deepening levels, and at the end, the full chess game is the natural consequence of that mastery — not a cliff.

---

## 3. Pillars

Ordered by priority. When two pillars conflict, the higher wins.

| # | Pillar | Non-negotiable |
|---|---|---|
| 1 | **Fun first** | Kids don't tolerate boring. Every level must have delight. |
| 2 | **Evidence-based cognitive exercise** | Each mechanic maps to a recognized cognitive domain (spatial reasoning, working memory, planning depth). No "gaming for gaming's sake." |
| 3 | **Session hygiene** | 10–15 min optimal. Never shorter (no dopamine shots). Never compulsive (no infinite loop, no addictive hooks). |
| 4 | **Fluid on-chain economy** | Web3 is invisible to the player but real to sponsors. Tx friction must not interrupt flow. |

---

## 4. Audience

**Product thesis audience** (what the game is designed for, long-term):
- **Primary player**: kids and adolescents (8–16). Prevention window — cognitive training at this age pays compound interest into older adulthood.
- **Secondary player**: adults seeking self-directed cognitive exercise.
- **Primary funder**: web3 sponsors — DAOs, healthtech companies, longevity-aligned entities. Adults buying for themselves or gifting via "sponsor a player" count.

**MVP audience gate** (what v1 actually accepts):
- **18+ adults only via Terms of Service.** Wallet-required.
- Supported wallets: **MiniPay** (primary, mobile, Celo-native) and **Metamask** (desktop web, any EVM).
- Minors play in v2+ through **institutional partnerships** — the institution becomes the adult-of-record and handles parental consent / COPPA / GDPR-K compliance. Chesscito never holds PII of minors directly.

**Design rule** (long-term, applies once minors are onboarded): a kid should never hit a paywall. A sponsor, adult, or institution pays on their behalf, or the kid earns progress off-chain that an adult can sponsor the mint of later.

---

## 5. Positioning

**Category**: cognitive exercise, gamified. **Vehicle**: chess.

Chesscito is the first vertical of Den Labs' cognitive platform thesis. Future verticals (shogi, memory puzzles, spatial reasoning, go, etc.) can share the same progression ladder format, economic rails, and sponsor mechanics.

**Anti-positioning** (what we are *not*):
- Not speed chess, blitz, or a chess.com competitor
- Not an addictive gaming loop
- Not edutainment theater ("learn chess in 5 minutes!")
- Not a token-first product
- Not a clinical device or medical claim (though mechanics align with cognitive health research)

---

## 6. Session window & hygiene

| Metric | Target |
|---|---|
| Ideal session | 10–15 min |
| Cadence | Daily, same time window |
| Exit friction | Zero — leave any time, progress always saved |
| Session shape | 2–3 mini-puzzles, 1 cross-piece reinforcement, 1 reflection moment |

**Anti-adrenaline principles** (binding):
- No countdown timers on learning levels (L1 / L2 / L3). Optional in cross-piece for variety, never as primary gating.
- No cross-session streak rewards that create compulsion (daily reset encouraged over infinite streaks).
- No "just one more" denial-of-exit patterns.
- Soft daily cap suggestion (≈ 20 min) with a friendly "take a break" nudge — not enforced.

### The Coach's Pause (anti-addiction visual language)

The break-time nudge is delivered by the **Coach character** — same agent that, in v2, delivers personalized cognitive-improvement guidance. In v1 the Coach's first public role is the *cognitive wellness companion that protects the player from over-use*.

**Trigger**: continuous play of ~15–20 min (configurable, soft).

**Surface**: a non-blocking ghost card (not modal) overlaid on the play hub. Reuses the candy-paper aesthetic — warm cream, amber halo, Wolf mascot.

**Copy structure**:

```
🐺  Your mind just did a full workout.
    {N} puzzles, {M} min of focused thinking.

    [ Take a 5 min break ]    one more puzzle
```

**Design principles**:
- ✅ **Reward-framing first**: celebrates what the player just achieved before suggesting the break. The break is presented as a logical next move, not a stop sign.
- ✅ **Wolf mascot** as the messenger — brand consistency; Wolfcito is the friend, not the rule-enforcer.
- ✅ **Candy-paper visual** — same warm cream + amber tones used everywhere else; reuses 100% of existing components.
- ❌ **No red, no alarms, no "Game Over" energy.**
- ❌ **No dark patterns** in "one more puzzle" — equally visible, no trick to dismiss.
- ❌ **No sound by default** (optional in settings) — respects environment.

**Why this works strategically**:
1. Re-frames the anti-addiction moment as a positive engagement signal.
2. Establishes the Coach character before its full v2 role lands — players already know him as their friend by the time analysis features ship.
3. Gives a single anchor for all session-hygiene UX.

---

## 7. Pedagogy ladder (high-level)

Each piece progresses through three levels. Order of piece introduction is engineered by **composition of knowledge**: later pieces reuse the mental models of earlier ones.

### Per-piece ladder

1. **L1 — Move/Capture** *(current POC)*: move the piece to a star target. Board + piece + objective.
2. **L2 — Labyrinth**: reach the star through obstacles (friendly pieces as blockers, dead-ends, tight paths) in the minimum number of moves.
3. **L3 — Specialized challenge**: exploits the piece's unique identity. Examples:
   - **Knight**: Knight's Tour variant — cover the maximum number of squares without repeating, with a pass threshold (scaled 4×4 → 8×8).
   - **Pawn**: promotion puzzles requiring forward + diagonal capture planning, plus en-passant scenarios.
   - **King**: castling puzzles with check-awareness.

### Piece order (additive knowledge, traditional chess-school order)

```
Rook   (straight lines)
   ↓
Bishop (diagonals)
   ↓
Queen  (Rook + Bishop — free composition, no separate tutorial)
   ↓
Knight (L-jump — one new mental model: "1–2–3 steps and land". Pre-computed
        hit-grid in our board reduces cognitive load vs. learning on a blank
        board)
   ↓
King   (one square in any direction, castling, check / mate awareness)
   ↓
Pawn   (boss final: forward move, diagonal capture, first-move 2-square,
        en passant, promotion — most exceptions of any piece)
```

**Design hypothesis**: Queen does not require its own tutorial — mastery of Rook + Bishop unlocks it for free. Knight moves up to position 4 because our pre-computed hit-grid simplifies the L-jump to a visual 1-2-3 exercise. King and Pawn stay deferred to the end because their movement exceptions (castling, check, en passant, promotion) require an existing foundation of trust in the system. Pawn is the boss final.

### Cross-piece mini-games

Triggered after mastering adjacent pieces. Reinforce previous learning + build composite thinking.

- **Rook + Bishop**: "Board Hunt" — maximize captures in *a limited number of moves* (not time), recognizing both movement patterns in combination.
- **Rook + Bishop + Queen**: sliding-pieces orchestration puzzle.
- **+ Pawn / King**: positional puzzles with mixed pieces.
- *(Exact count & design: GDD scope.)*

### Full chess gate

Unlocked only when **all 6 pieces × 3 levels** + the defined set of cross-piece mini-games are complete. This is the replacement for the current "straight to Arena" cliff — Arena becomes the ceremony, not the entry.

---

## 8. Economic model (on-chain vs off-chain)

| Event | Layer | Rationale |
|---|---|---|
| Complete L1 puzzle | Off-chain (local + Supabase) | Too granular for on-chain; builds momentum |
| Complete L2 labyrinth | Off-chain (local + Supabase) | Same |
| Master a piece (3 levels) | **On-chain mint** (soulbound badge) | Proof of mastery, sponsorable |
| Cross-piece mini-game | Off-chain with signed attestation | Batched into weekly on-chain summary |
| Full chess gate unlocked | On-chain certification event | Ceremonial milestone |
| Arena victory | On-chain *(existing Victory NFT)* | Already live |

**Sponsor mechanics — MVP minimum (reuse everything we have)**:

The goal for v1 is to *validate that sponsorship works without reinventing infrastructure*. Everything below is already built or is a thin wrapper over existing components.

- **"Support Chesscito" button on About** — reuses `purchase-confirm-sheet.tsx` to send USDC directly to the prize pool address. Same flow as shop purchases, new destination.
- **Supporters section on About** — curated list of sponsors (name + optional logo + optional on-chain proof link), edited statically in `editorial.ts`. No admin backend.
- **Prize pool balance visible** — already shipped (`usePrizePoolBalance` hook, rendered in Arena entry). Shows live transparency to sponsors.
- **Victory mint 80/20 split** — already in production on Celo mainnet. Each mint contributes to the sponsor pool organically.

**Deferred to v2+** (document now, build later):
- In-app **sponsor-a-player** direct transfer (requires wallet pairing UX, escrow / delegate permissions, recipient confirmation flow).
- **Sponsor-a-path** institutional programs (schools, talent seedbeds, regional cohorts).
- Automated talent detection → sponsorship recommendations.
- Tournament-based prize pool distribution (needs v2 tournament mechanic first).
- Sponsor landing page with logos, thank-you grid, quarterly impact reports.

**Friction principle** (applies now and forever): the player never signs more than once per major milestone. Mid-session play is off-chain, sync is batched, on-chain only fires at mastery events.

---

## 9. Scope — in / out for v1

**In scope for v1**:
- 6 pieces × 3 levels (minimum viable cut: all 6 at L1 + Rook through L3)
- Cross-piece progressive free-play (after Rook+Bishop, free-play with both; expands as more pieces are mastered, until full chess unlocks). See §7 for the gate-as-expansion model.
- Full chess gate mechanic (= the moment the last piece, Pawn, is mastered)
- "Support Chesscito" button + Supporters section (sponsor MVP minimum — see §8)
- **Public pitch / landing page** explaining the product to four audiences (kids, parents, sponsors, institutions). The game communicates value through play, but a dedicated marketing surface is needed for sponsor outreach and parent buy-in. Lives at a stable URL (e.g. `/why` or homepage when unauthenticated).
- Den Labs co-branding on the **About page** (chosen surface, see resolved Q6)
- Session hygiene UI: **The Coach's Pause** ghost card (see §6) + exit-any-time save

**v1 access restrictions**:
- **18+ adults only** via Terms of Service.
- **Wallet-required** — MiniPay (mobile, Celo-native) or Metamask (desktop web). No walletless onboarding in v1.

**Out of scope for v1** (v2 or later):
- Minor players (enabled in v2 through institutional partnerships)
- Walletless onboarding / parent-delegated wallets / guardian escrow
- In-app direct sponsor-a-player / sponsor-a-path flows
- Additional Den Labs cognitive verticals (shogi, memory, spatial, go)
- PvP / async multiplayer
- Real-time multiplayer
- Seasonal tournament brackets
- Localization beyond English
- Formal clinical validation studies *(future research partnership)*

---

## 10. Success criteria (MVP)

Quantitative targets — measured at launch + 90 days:

| Metric | Target |
|---|---|
| Average session length | 10–15 min |
| D1 retention | ≥ 40% |
| D7 retention | ≥ 20% |
| D30 retention | ≥ 10% |
| % players reaching full chess gate | ≥ 15% of active |
| Sponsor-funded badge mints | ≥ 30% of total mints |
| Sessions per week per active player | 3–5 |

Qualitative signals:
- Kid feedback: *"it's fun, not homework."*
- Adult / sponsor feedback: *"I understand what my donation does."*
- Cognitive health researcher feedback: mechanics align with recognized domains.

**Minimum viable cut** (if scope must compress):
- **All 6 pieces at L1** + Rook fully through L3 as "proof of ladder"
- 1 cross-piece mini-game (Rook + Bishop)
- Full chess gate mechanic wired but unlockable only after the 6 L1s
- Sponsor MVP minimum: Support button + Supporters list (see §8)

### Validation approach

**Pedagogical validation (shipping in v1)**:
- **Chess master partnership**: the pedagogical design is being built with a professional chess teacher with 15–20 years of teaching experience. They validate the piece-order, level design, and threshold calibration.
- **In-game learning signals**: repetitions per level, solution paths taken, time-to-solve distribution, threshold pass/fail rates. Captured in Supabase for analysis.
- **Iterative tuning**: thresholds for L3 (e.g., Knight's Tour % coverage) are calibrated from real beginner data, not guessed.

**Cognitive health validation (deferred to v2+)**:
- Formal neurodegenerative-disease-mitigation claims require longitudinal studies (multi-year). Out of MVP scope.
- v1 mechanics are *designed to align with* recognized cognitive domains (spatial reasoning, working memory, planning depth) but we do not make clinical claims.
- Future: partner with research lab or longevity DAO once we have a large anonymized data set.

**Tournament data → Coach feedback loop (future)**:
- Chesscito already has a **Coach agent** built (currently hidden behind `NEXT_PUBLIC_ENABLE_COACH` flag). Its future role: analyze individual player progression across levels + cross-piece games + tournament results to give personalized cognitive-improvement guidance.
- v1 already emits the telemetry (via `track()`) that the Coach will consume in v2.

---

## 11. Open questions

### Resolved (v0.2)

1. ~~**Knight placement**~~ — **RESOLVED**: position 4 (after Queen), following traditional chess-school order. Our pre-computed hit-grid reduces the L-jump to a visible 1-2-3 exercise, removing the main cognitive barrier.
4. ~~**Session cap enforcement**~~ — **RESOLVED**: soft nudge only. No hard cap on accounts in v1.
5. ~~**Sponsor-a-player wiring**~~ — **RESOLVED for v1**: Support button + Supporters list, no in-app direct sponsor-a-player. See §8 for the MVP minimum and the v2+ roadmap.
8. ~~**Content rating & compliance**~~ — **RESOLVED for v1**: 18+ adults only via TOS. Minor players enabled in v2 through institutional partnerships that handle compliance.
9. ~~**Kids without wallets**~~ — **RESOLVED for v1**: v1 requires a wallet (MiniPay or Metamask). Walletless / parent-delegated / guardian escrow patterns deferred to v2.
10. ~~**Research partner**~~ — **RESOLVED**: chess master partner (15–20 yrs experience) validates pedagogy immediately; in-game signals validate learning empirically; formal neurodegeneration studies deferred multi-year; Coach (already built) becomes the per-player analysis layer in v2.

### Resolved (v0.3)

2. ~~**Knight's Tour scaling**~~ — **RESOLVED**: 4×4 starter → 8×8 mastery curve. Threshold calibration still done with chess master + beginner data, but the scaling shape is locked.
3. ~~**Cross-piece mini-game roster**~~ — **RESOLVED**: simplified to **progressive free-play** rather than discrete scripted puzzles. As each new piece is mastered, the free-play board expands its piece roster, until Pawn unlocks full chess. The "gate" becomes an expansion, not a binary unlock.
6. ~~**Den Labs branding surface**~~ — **RESOLVED**: Den Labs context lives on the **About page**. Other surfaces stay focused on player flow.
7. ~~**Anti-addiction visual language**~~ — **RESOLVED**: **The Coach's Pause** ghost card delivered by the Wolf mascot, candy-paper aesthetic, reward-framed copy. Full design in §6.

### Still open (to resolve in next sprint or GDD)

11. **Public pitch / landing page** — structure, copy, and audience-specific tabs. Four target audiences (kids, parents, sponsors, institutions) likely need different messaging emphasis. Layout: single-page tabbed, dedicated routes per audience, or one page with audience selector at top? Owns its own sprint after the L2 Labyrinth POC.

---

## Next artifact

**Game Design Document (GDD)** detailing:
- Per-piece L2 labyrinth design patterns
- Per-piece L3 specialized challenges (full spec)
- Cross-piece mini-game mechanics
- Cognitive-domain mapping per mechanic
- On-chain event model (schema + signing flow)
- Sponsor-a-player UX flow
- Session hygiene UI spec
- Anti-addiction visual language
