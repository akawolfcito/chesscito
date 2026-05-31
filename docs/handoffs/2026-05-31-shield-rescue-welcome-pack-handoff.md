# Handoff — Shield Rescue + Welcome Pack UX cluster

**Date**: 2026-05-31
**Session lead**: Sally (UX) channeled by Claude + Wolfcito
**Status**: design phase complete, deliverables QUEUED (not yet written)
**Resume command**: `continuamos`

---

## TL;DR

Three connected UX problems surfaced while polishing exercises 1-2 (rook trials). Shield mechanic is invisible at the exact moment it has the most value (post-failure), Shop is a discoverability dead-end, and the post-banner dead-time on the failed board state is actively frustrating. Wolfcito proposed pairing a **failure rescue modal** with a **Welcome Pack** (3 free shields, claimable in Shop) to solve all three at once. Design is aligned; anti-abuse approach decided (server-side ledger keyed by wallet); next session writes the 3 deliverables below.

---

## What shipped in this session (already on main)

| Commit    | Scope                                                           |
| --------- | --------------------------------------------------------------- |
| `400ea859` | `fix(board)`: flip tap-hint placement (top/bottom/left/right + arrow) |
| `11457c5a` | `fix(art)`: threshold piece-sprite alpha → kill rectangular drop-shadow halo |
| `3121a66c` | `feat(exercises)`: PhaseFlash polish — bigger wolf (h-80), banner absolute-positioned above avatar, light cream drop-shadow, scrim z-50→70 to overlay dock, success 2700/3100, failure 1800/2200 |

All tests green (33/33 exercises + 12/12 board). No deferred work from these commits.

---

## The three problems identified

1. **Shield is invisible in HUD**: top-right chip "🛡 9" gives no affordance, no education, no contextual trigger. User has 9 shields and zero understanding of when to spend them.
2. **Failure dead-time**: after `TRY AGAIN` banner clears, the board sits in failed state. No CTA, no auto-reset, no shield prompt. User has to figure out next step in a moment of frustration.
3. **Shop discoverability is dead**: users rarely return to Shop after first visit. Every future SKU (cosmetics, save-packs, labyrinth-packs) will die for the same reason shields are dying — users never see the catalog.

---

## Aligned design — Shield-as-Rescue + Welcome Pack

### Core insight (Sally's reframe)

Shield is modeled today as **passive inventory** (silent HUD chip). It must be reframed as **active rescue** — the shield exists *specifically for the post-failure moment*. If not offered there, it doesn't exist in the user's mental model.

### Fail-flow (new)

```
Failure detected
   ↓
TRY AGAIN banner (1.8s, current)
   ↓
Rescue modal — NO dead-time
   ├─ User HAS shields:
   │    "💔 Casi. Usá 1 Shield para reintentar sin perder tu racha."
   │    [Usar Shield · 8 left] (primary)
   │    [Reintentar sin shield] (ghost — loses star)
   │    [X close]
   │
   └─ User HAS 0 shields:
        First-fail-with-0 (and not yet claimed Welcome Pack):
          "💔 Reintentar te cuesta tu racha. O reclamá tu Welcome Pack
           gratis y rescatás esto."
          [🎁 Claim 3 free shields →] (primary, deep-link to Shop)
          [Reintentar sin shield] (ghost)
        After claiming OR ignoring 3+ times:
          [Get Shields · $0.025] (primary, paid SKU)
          [Reintentar sin shield] (ghost)
   ↓
Shield used → HUD chip animates 9→8 + sparkle + board resets to start
              (streak intact)
Reintentar sin shield → board resets + streak loses 1 star
```

### Welcome Pack (forcing function for Shop discoverability)

- Tile pinned at top of Shop, framed "Welcome gift · solo para nuevos"
- Contents: **3 shields** only (Phase 1 — single-job: teach the Shop-has-things pattern)
- Claim: one-time per **wallet address** (server-side, see anti-abuse below)
- Deep-linked from rescue modal so first visit happens at moment of maximum motivation
- Expected conversion ~70-80% on first-fail-with-0-shields nudge

### Discoverability (first-encounter education)

- First time user fails AND has shields ≥1 → modal includes one-line explainer: "🛡 Esto es un Shield. Te rescata cuando fallás sin romper tu racha."
- Subsequent failures → compact modal (no explainer)
- Long-press on HUD shield chip → tooltip "Shields rescue your streak when you fail"

---

## Anti-abuse — DECIDED

**Approach**: server-side claim ledger keyed by wallet address (NOT localStorage, NOT browser fingerprint).

**Schema**:

```sql
CREATE TABLE welcome_pack_claims (
  wallet_address TEXT PRIMARY KEY,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash TEXT,
  signature TEXT NOT NULL
);
```

**Endpoint**: `POST /api/welcome-pack/claim`

- Validates wallet signature (EIP-191 personal_sign of canonical message)
- `INSERT ... ON CONFLICT (wallet_address) DO NOTHING` (idempotent)
- Returns `{ claimed: true, shields_granted: 3 }` or `{ already_claimed: true }`

**Defense in depth (Phase 2, deferred)**:

- IP-hash rate limit (5 claims/hour per IP) to slow wallet farms
- Hardware attestation via wallet signature already present (signature required in POST, not just address)

**MiniPay coverage**: 100% (wallet intrinsic). **Browser+MetaMask coverage**: 100%. **Browser without wallet**: gate Welcome Pack behind wallet connect — "Connect to claim". Connect = claim trigger.

**Why NOT localStorage-only**: trivial bypass (new browser, clear cache, incognito). Localstorage may still be used as *cache* of the claim status for UI snappiness, but server is source of truth.

**Why NOT browser fingerprint**: false positives on family wifi, NAT, corporate networks. Punishes legit users for marginal abuse-prevention gain.

---

## Phasing (do NOT bundle Phase 2+ into first cluster)

| Phase | Scope                                                                                                              | Est.  |
| ----- | ------------------------------------------------------------------------------------------------------------------ | ----- |
| **1** | Welcome Pack tile in Shop + fail-rescue modal (4 states) + server-side claim ledger + HUD chip pulse animation     | 2-3d  |
| 2     | Hub banner for 3+ ignored nudges + on-chain wallet sync of local shield count + long-press tooltip on HUD chip      | 1-2d  |
| 3     | Daily login bonus, expanded catalog (save-pack, labyrinth-pack), recurring discoverability                          | TBD   |

---

## Binding decisions — CONFIRMED in this session

| Decision               | Choice                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------- |
| Local-first vs server  | **Server-side ledger** keyed by wallet address (per anti-abuse analysis)            |
| Pack contents (Phase 1)| **3 shields only** — single-job, don't devalue future SKUs                          |
| Claim eligibility      | **One-time per wallet** (server-side `ON CONFLICT`)                                 |
| Browser-no-wallet UX   | **Gate behind wallet connect** — connect IS the claim action                        |
| Modal vs auto-rescue   | **Modal** (explicit consent first N times, may add "always use shield" toggle later) |
| Failure modal timing   | Appear immediately as `TRY AGAIN` banner fades (no dead-time)                       |

---

## OPEN — pending user confirmation before code

- Copy for first-fail-with-0-shields nudge: current draft uses "💔 Reintentar te cuesta tu racha. O reclamá tu Welcome Pack gratis y rescatás esto." Confirm vs alternatives?
- Welcome Pack framing in Shop: "Welcome gift · solo para nuevos" — confirm copy?
- Shield count animation: ms duration + style (number tick vs pulse-only)? Defer to design pass during impl.

---

## QUEUED deliverables (to write next session)

The user said `procede` then immediately interrupted to request this handoff. Three files were planned but NOT yet written:

### 1. Memory: UX pattern references (feedback type)

**Path**: `~/.claude/projects/-Users-wolfcito-development-BLCKCHN-GOOD-WOLF-LABS-akawolfcito-celo-chesscito/memory/feedback_ux_pattern_references.md`

**Content**: rule that for UX/economy/onboarding work, default to referencing 2-3 proven patterns from comparable games (Clash Royale, Hearthstone, Genshin, Duolingo, Snapchat, Wordle, Candy Crush) before proposing custom solutions. Explicit vocabulary list: forcing function, loss aversion, FTUX, activation funnel, soft vs hard currency, streak protection, variable reward schedule, sunk cost, habit loop.

**MEMORY.md entry**: 1 line, link + 1-liner hook.

### 2. Pattern library doc

**Path**: `docs/design-patterns/game-economy-patterns.md` (dir does not exist yet, create it)

**Seed content (3 patterns)**:

- **Welcome Pack** (Clash Royale, Hearthstone, Genshin) — free starter inventory claimable in shop forces first shop visit at zero psychological cost. When applies: any shop with future SKUs that need discoverability. Anti-pattern: making the pack too rich (devalues future SKUs).
- **Shield Rescue / Streak Protection** (Duolingo Streak Freeze, Snapchat Streak Restore) — consumable that protects what user already has. Loss aversion > gain framing. When applies: any progression mechanic with breakable continuity. Anti-pattern: silent inventory (the shield must show up at the rescue moment).
- **Forcing function for catalog awareness** (every F2P game) — gate a high-motivation moment (post-fail, post-win, daily) behind a shop visit with a free or low-cost reward. When applies: when shop visits are rare. Anti-pattern: pure paywall — must have free/cheap rescue path.

### 3. Spec doc (unified — rescue + welcome pack + anti-abuse)

**Path**: `_bmad-output/planning-artifacts/ux-shield-rescue-and-welcome-pack-2026-05-31.md`

**Content outline**:

- §0 — TL;DR + status
- §1 — Diagnosis (3 problems, evidence from screenshots in chat)
- §2 — Binding decisions (the 6 in this handoff, frozen)
- §3 — Design — fail flow + 4 modal states (with-shields-first / with-shields-recurring / without-shields-pre-claim / without-shields-post-claim)
- §4 — Welcome Pack tile spec (visual + claim mechanic + copy + idempotency)
- §5 — Anti-abuse architecture (server ledger schema, endpoint contract, signature flow, rate limits, MiniPay vs web wallet coverage)
- §6 — Hub banner spec (Phase 2 — deferred)
- §7 — Red-team checklist (~12-15 findings: race conditions on optimistic shield decrement, wallet swap mid-session, ledger consistency under retries, Shop deep-link from modal mid-fail, etc.)
- §8 — Commit plan (~8-10 atomic commits)
- §9 — Test plan (unit + integration + manual smoke)
- §10 — Estimate: 2-3 days focused

Pattern follows `ux-design-addendum-post-domain-migration-2026-05-20.md` (Sally + Wolfcito addendum precedent in `_bmad-output/planning-artifacts/`).

---

## Resume protocol

When user says `continuamos`:

1. Re-read this handoff (you're reading it now in the future)
2. Write the 3 queued deliverables in this order:
   - Memory + MEMORY.md entry (smallest, sets context for self in future sessions)
   - Pattern library doc (anchors the institutional knowledge)
   - Spec doc (the actionable artifact)
3. Reply in chat with: paths + 3-bullet summary per global rules
4. Ask: confirm open copy decisions (2 listed above), then proceed to implementation Phase 1

Do NOT start implementation before the spec is written and confirmed.

---

## References

- Cluster sibling specs (precedent for tone/structure):
  - `_bmad-output/planning-artifacts/ux-design-addendum-post-domain-migration-2026-05-20.md`
  - `_bmad-output/planning-artifacts/coach-viewer-cluster-c-spec-2026-05-29.md`
- Memory entries already loaded:
  - `[shop-redesign-2026-05-25]` — current shop architecture (Shield 2n at $0.025, pill family, ghost "more coming" tail)
  - `[account-inventory-rows]` — `useShieldsCount()` hook + Shield row in Account
- Screenshots in chat (3 frames showing HUD chip, fail moment, post-banner dead-time on board)
