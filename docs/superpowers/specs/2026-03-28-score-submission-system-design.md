# Score Submission System — Design Spec

**Date:** 2026-03-28
**Status:** Draft
**Scope:** Score model, CTA rules, submission UX, leaderboard aggregation
**Driver:** Score architecture has no system-level place — submission timing, progression, and leaderboard reflection are confusing

---

## Problem

Submit Score exists as a button but not as a system. The player has no clear mental model for: what their score represents, when to submit, whether re-submission is normal, or how their score relates to the leaderboard. The result is a disconnected CTA that feels like bookkeeping rather than metagame progression.

## Design Principle

**Internally per-piece, externally global.** The on-chain model stays per-piece (`levelId` 1-6) to match Chesscito's piece-based progression and generate granular onchain signals. The player sees one accumulated total score. The leaderboard ranks by global total. The player never needs to think about six separate score systems.

---

## 1. Recommended Score Model

**Accumulated Global Score, Per-Piece Submits (B-Hybrid)**

Each piece has its own `levelId` (1-6), submitted independently via the existing `ScoreboardUpgradeable` contract. The player sees ONE total score equal to the sum of their best per-piece scores.

**Max possible score:** 6 pieces x 15 stars x 100 points = **9,000 points**

### Why This Model Wins

- Matches the actual piece-based progression of Chesscito
- Generates more onchain life signals (one submit per piece improved, not one global blob)
- Preserves granular progression without fragmenting the visible competition
- Avoids prematurely collapsing the system into a single `levelId=0` model
- Uses the existing contract as-is — no upgrades needed

---

## 2. State Definitions

### Piece-Level States

```
┌──────────────────┐   complete all 5    ┌──────────────┐
│ NOT_YET_SUBMITTABLE│ ────────────────► │  SUBMITTABLE  │
│  (< 5 done)       │                    │  (pI > 0)     │
└──────────────────┘                     └──────┬───────┘
                                                │ submit
                                                v
                                         ┌──────────────┐
                                         │  SUBMITTED    │
                                         │  (pI = 0)     │
                                         └──────┬───────┘
                                                │ improve stars
                                                v
                                         ┌──────────────┐
                                         │  IMPROVABLE   │
                                         │  (pI > 0)     │
                                         └──────────────┘
                                                │ submit
                                                v
                                           (back to SUBMITTED)
```

| State | Condition | CTA Slot |
|-------|-----------|----------|
| `NOT_YET_SUBMITTABLE` | < 5 exercises attempted for selected piece | No Submit CTA |
| `SUBMITTABLE` | All 5 done + `pendingImprovement > 0` + never submitted this piece | Submit Score (primary) |
| `SUBMITTED` | On-chain score exists + `pendingImprovement = 0` | No Submit CTA |
| `IMPROVABLE` | On-chain score exists + `pendingImprovement > 0` (replayed & improved) | Submit Score (primary) |

`SUBMITTABLE` and `IMPROVABLE` behave identically from the CTA perspective. The distinction exists for analytics and future copy differentiation ("Record your score" vs "Update your score" — P1).

**Submission gate (v1):** all 5 exercises for the selected piece must be attempted before Submit Score appears. This is the initial submission gate, not a permanent rule. Future iterations may allow milestone-based or significant-improvement submissions if product goals justify it.

### Score Concepts

| Concept | Definition |
|---------|-----------|
| **Current piece score** | `totalStars x 100` for the selected piece (from localStorage) |
| **Submitted piece score** | Best on-chain score for this `levelId` (0 if never submitted) |
| **Submittable score** | The current piece score, when it exceeds the submitted piece score. This is exactly what would be sent if the player submits now. |
| **Pending improvement** | `currentPieceScore - submittedPieceScore`. Positive = Submit CTA visible. Zero or negative = hidden. |

### Global Derived States

| Value | Derivation | Used For |
|-------|-----------|----------|
| `globalCurrentTotal` | Sum of `currentPieceScore` across all pieces | Display in success overlay (player-visible total for v1, computed from localStorage — not a cross-device authoritative total) |
| `globalSubmittedTotal` | Sum of `submittedPieceScore` across all pieces | Leaderboard ranking |

### Wallet-Level States (overlay on piece states)

Wallet states apply only when the piece state would otherwise show Submit Score (`SUBMITTABLE` or `IMPROVABLE`). If the piece is `NOT_YET_SUBMITTABLE` or `SUBMITTED`, the CTA slot is empty regardless of wallet state.

| Wallet State | Effect on CTA Slot |
|-------------|-------------------|
| Connected + correct chain | Normal piece-state CTA |
| Not connected | "Connect Wallet" replaces Submit CTA |
| Wrong chain | "Switch Network" replaces Submit CTA |

---

## 3. CTA Rules

### Priority Stack (highest to lowest)

```
1. Failure recovery (useShield / retry)     — blocking state
2. Claim Badge (if threshold reached)       — immediate emotional reward
3. Submit Score (pendingImprovement > 0)     — metagame progression
4. (no action)                              — continue playing
```

Claim Badge takes priority over Submit Score when both are available. The badge is the more immediate emotional reward — collect the prize first, then record the score.

### Visibility Rules

| Condition | Submit Score CTA | Notes |
|-----------|-----------------|-------|
| `pendingImprovement > 0` + all 5 exercises attempted | **Visible** (primary when no badge claimable, secondary when badge is claimable) | |
| `pendingImprovement > 0` + < 5 exercises attempted | **Hidden** | Player hasn't finished the piece yet |
| `pendingImprovement <= 0` | **Hidden** | Nothing to submit. No ghost, no "already submitted" text. Clean. |
| Wallet not connected (with pending improvement) | **"Connect Wallet"** in CTA slot | Resolutive action, not a dead end |
| Wrong chain (with pending improvement) | **"Switch Network"** in CTA slot | Same pattern |
| Failure state | **Hidden** | Shield/retry takes priority |

### Coexistence with Other Systems

| Screen | Submit Score presence |
|--------|---------------------|
| Play Hub (mission panel) | CTA slot — only location |
| Arena end-state | Never — Arena has its own flow (Claim Victory) |
| Coach screens | Never — post-game analysis |
| Leaderboard | Never — read-only view |

Submit Score lives exclusively in the Play Hub. It is a play-hub metagame action.

---

## 4. Player-Visible UX Flow

### Before Submission

Player completes all 5 exercises for a piece. The CTA slot transitions:

- **CTA:** "Submit Score" (cyan gradient, star icon)
- **Context line above CTA:** `"X,XXX pts ready"` — the submittable score
- **First-time hint:** On first-ever submission, a one-line subtitle: `"Record your score on the blockchain"`. Shown once, dismissed via localStorage flag.
- **Badge overlap:** If badge is claimable at the same time, Claim Badge takes the primary slot. Submit Score appears as a ghost button below, or takes the slot after the badge is claimed.
- **Wallet guard:** If wallet not connected, CTA shows "Connect Wallet". If wrong chain, "Switch Network".

### During Submission

1. **CTA enters busy state:** spinner replaces icon, text changes to `"Submitting..."`
2. **Wallet prompt:** MiniPay shows the transaction signing sheet
3. **Waiting for confirmation:** CTA stays busy. No modal, no overlay — player stays in Play Hub context.
4. **User cancels wallet:** CTA returns to ready state. Light toast: `"Submission canceled"` (2s, fade).
5. **Transaction fails:** Toast: `"Submission failed — try again"` (3s, fade). CTA returns to ready state.

### After Submission — Success Overlay

On success, the existing `result-overlay.tsx` appears with `variant="score"`:

- **Image:** `/art/score-chesscito.png`
- **Title:** `"SCORE RECORDED"`
- **Subtitle:** `"Your score is now recorded on the blockchain."`
- **Piece score:** `"1,200 pts"` (primary display)
- **Global total hint:** `"Total: 2,400 pts"` (secondary, below piece score). This is the player-visible accumulated total for v1, computed from localStorage. It is not a cross-device authoritative total — it reflects the current device's knowledge of all pieces.
- **CeloScan link:** View transaction
- **Share button:** Copy challenge text
- **Dismiss:** Close overlay

### Post-Overlay Priority

After dismissing the success overlay, the CTA slot resolves to:

1. **Claim Badge** — if claimable for this piece (threshold reached after submitting)
2. **Next piece / progression action** — if relevant (e.g., new piece unlocked)
3. **Continue improving current piece** — replay exercises for more stars
4. **Clean base state** — no CTA in slot

### Re-submission Flow

Player replays exercises and improves stars:
- localStorage updates with new star values
- `pendingImprovement` becomes positive again
- Submit Score CTA reappears in the slot
- Same flow as first submission — no special "re-submit" variant
- Success overlay shows updated piece score and new global total

---

## 5. Leaderboard Implications

### New Ranking Formula

```
globalScore(player) = Sum of max(score per levelId) for levelId 1..6
```

The indexer reads all `ScoreSubmitted` events, builds a per-piece best map per player, then sums.

### What Changes

| Aspect | Before | After |
|--------|--------|-------|
| Ranking formula | `max(score)` across all events | `Sum of max(score per levelId)` |
| Max possible score | 1,500 (one piece) | 9,000 (six pieces) |
| Displayed score | Single number | Single number (the global total) |
| Per-piece breakdown | Not shown | Not shown in v1 |
| Indexer logic | `best.set(player, Math.max(prev, score))` | `bestPerLevel[player][levelId] = Math.max(prev, score)` then sum |

### Player-Facing Display

Leaderboard row stays the same structure:

```
#1  0x1234...5678  2,400 pts  (verified badge)
```

No per-piece breakdown in v1. The total is the competition number. Future: tap-to-expand showing per-piece contributions.

### Tie Handling

- Tied players receive the same rank number (e.g., two players at #3)
- The next rank skips accordingly (next player is #5, not #4)
- Row order among tied players: deterministic by address (lexicographic sort)
- No tiebreaker in v1. Future: sum of `timeMs` across best submissions as secondary sort.

### Refresh Latency

Leaderboard is server-rendered with `revalidate: 60s`. After submission, the player's new score may take up to 60 seconds to appear on the public leaderboard. This is a v1 constraint, not the desired UX target. The success overlay provides immediate local confirmation of the new global total, so the player knows the submission succeeded regardless of leaderboard refresh timing.

---

## 6. Risks / Technical Checks

### Contract Compatibility

The existing `ScoreboardUpgradeable` works as-is. `submitScoreSigned(levelId, score, timeMs, ...)` already accepts per-piece levelId. Multiple submits per levelId are allowed. No contract upgrade needed.

### maxSubmissionsPerDay Audit (P0 — Required)

**Must verify before shipping:** check the current `maxSubmissionsPerDay` value on mainnet. Cooldown and daily limits are per-player, not per-levelId. If the cap is low (e.g., 3), a player improving multiple pieces in one session will be blocked. If the current value is too restrictive for the global-accumulated model, an admin call to raise it is needed before rollout.

### Indexer Rewrite

Changing from `max(score)` to `Sum of max(score per levelId)` is a breaking change to rankings. Existing players' displayed scores will change — scores only go up or stay the same (positive change), but worth announcing. The indexer must extract `levelId` from event `topics[2]` (second indexed parameter). **Technical check:** verify historical events include `levelId` in topics. They should — it's defined as `indexed uint256` in the contract.

### localStorage as Source of Truth

Current piece scores live in localStorage (`chesscito:progress:{piece}`). Clearing browser data resets local progress (but on-chain scores survive). A player on a new device sees `pendingImprovement` based only on local state, which starts at 0. Acceptable for v1 — MiniPay is single-device by nature.

### Rate Limit Interaction

Backend rate limit: 5 req/IP/60s + 3 req/address/60s. On-chain: `submitCooldown` + `maxSubmissionsPerDay`. If a player rapidly improves 3 pieces and submits all 3, the backend rate limit (3/address/min) could block the third request. The UX only shows Submit for the currently selected piece, and the player must switch pieces manually, which naturally spaces out requests. Likely acceptable in v1, but should be monitored after rollout.

### Global Total Calculation

For the success overlay, `globalCurrentTotal` is computable from localStorage — sum of all pieces' `totalStars x 100`. No new API endpoint needed for v1. Future: a `/api/player-score?address=0x...` endpoint for cross-device or profile views.

---

## 7. P0 Implementation Recommendation

### P0 Must-Ship

These are the core functional changes. Without them, the score system remains disconnected.

1. **Leaderboard indexer rewrite** — change from `max(score)` to `Sum of max(score per levelId)`. Read `levelId` from event topics. Explicit tie handling (same rank, skip next, deterministic order among ties).
2. **maxSubmissionsPerDay audit** — read current value from mainnet contract. If too low for multi-piece sessions, raise via admin call.
3. **CTA priority fix** — Claim Badge > Submit Score when both available.
4. **Wallet-state CTA slot** — show "Connect Wallet" / "Switch Network" when submission would otherwise be available but wallet blocks it.
5. **Submission feedback toasts** — cancel: `"Submission canceled"` (2s). Failure: `"Submission failed — try again"` (3s).
6. **Global total in success overlay** — after submission, show `"Total: X,XXX pts"` below the piece score, computed from localStorage.
7. **Editorial constants** — updated success subtitle, cancel toast, failure toast, global total label.

### P0 Good-to-Ship

These improve the experience meaningfully but are not blocking.

8. **First-time submission hint** — one-line subtitle on first Submit CTA appearance, dismissed via localStorage.

### P1 — Next Iteration

- `SUBMITTABLE` vs `IMPROVABLE` copy differentiation ("Record your score" vs "Update your score")
- Immediate leaderboard refresh after own submission (optimistic update or short polling)
- Player profile / score breakdown page
- Submission gate flexibility (milestone-based triggers beyond all-5-complete)

### Out of Scope

- Per-piece leaderboard tabs
- Time-based tiebreaker
- Cross-device score sync
- Global "sync all pieces" CTA
- Motion / animation on score update (PNG-first, Lottie-ready slots preserved)
- Contract changes

---

## Validation Criteria

The score submission system must satisfy:

1. **Single global score** — player sees one number, leaderboard ranks by one number
2. **Per-piece granularity** — on-chain submits are per levelId, indexer aggregates
3. **Natural submission moments** — Submit appears only when meaningful (piece complete + improvement)
4. **No confusion** — player always knows: current score, what would be submitted, and what the leaderboard shows
5. **Retention-friendly** — Submit feels like progression, not bookkeeping
6. **Wallet-aware** — CTA slot shows resolutive action (Connect/Switch), never a dead end
7. **Badge > Score** — rewards before records when both available
8. **Clean when idle** — no Submit CTA when nothing to submit
