# Proposal — SaveScore · Share · Leaderboard · Peones economy

> 2026-06-10. Audit + UX/UI proposal + economy calibration + sliced
> implementation plan. **Proposal only — no code yet.** Builds on the
> completed SaveScore off-chain cluster (Slices 1-6, `08994a74`).
>
> Constraints honored: do NOT break the working off-chain base save · do
> NOT re-introduce on-chain in the exercise base loop · do NOT touch
> Victory / Get Peones / Coach rail unless strictly needed · no large
> architecture changes (UI/logic/economy tweaks only).

---

## 1. Audit (what's broken / inconsistent)

### 1.1 Share after SaveScore shows the wrong art (CONFIRMED, live bug)
- `result-overlay.tsx` (score variant) builds the share card via
  `getCardUrl("score", …)` → **`/api/og/exercise?...&type=piece-complete`**
  (result-overlay.tsx:180-188).
- In `app/api/og/exercise/route.tsx`, `type=piece-complete` renders the
  chip **`${PIECE} Mastered`** (route.tsx:79-84) — i.e. "ROOK MASTERED".
  `TYPE_TITLE` has no score entry; the piece-mastered template is reused.
- `app/share/score/page.tsx:35` also points its OG at `type=piece-complete`.
- `SHARE_COPY.score` text says *"I just saved my Chesscito score on Celo!
  … Kept forever."* (editorial.ts:336) — implies on-chain permanence, but
  the base save is now **off-chain**. Stale.
- **Root cause:** the score share has no dedicated OG template; it borrows
  the piece-mastery one. Cross-wire between templates.

### 1.2 Saved state is too textual + factually stale (CONFIRMED)
- `SavedChip` (`components/exercises/saved-chip.tsx`) renders a soft-green
  text chip: **"Saved · {stars}★"** + hint **"Beat your score to save
  again"** (editorial.ts:542-558). Inline styles, not the candy vocabulary.
- aria + ES copy still say **"saved on chain" / "guardado en cadena"**
  (editorial.ts:553-557, es.ts:1382-1390) and the chip links to a CeloScan
  receipt — both **wrong now** (off-chain save has no tx / no receipt).
- State machine (`exercises-screen.tsx:1240-1252`): `scorePendingNew`
  (new better score → SAVE button), `isSavedAtParity` (current == last
  saved → SavedChip). Sound; only the chip's *presentation + copy* are off.

### 1.3 On-chain Proof CTA was never built (CONFIRMED placeholder-only)
- `LeaderboardProofKindFuture` / `…RequestFuture` exist **only as types**
  in `save-service.ts:141-150`, **zero consumers**. The CTA we agreed to
  move to the leaderboard does not exist anywhere — it was never
  implemented, not lost in the rewire.
- The retained on-chain helpers (`/api/sign-score`, `submitScoreSigned`,
  `Scoreboard`) are intact and still used by `profile-sheet.tsx:179-227`
  (a legacy "claim score" flow).
- Leaderboard UI (`components/exercises/leaderboard-sheet.tsx`) has a
  **hero band** (lines 162-197, golden-crown vitrine) — the natural home
  for a proof CTA. A Passport "verify" banner was **disabled 2026-05-25**
  (cross-chain friction) and sits commented at lines 200-229.
- Verified vs unverified today = a single **emerald check** next to the
  player name when `row.isVerified` (leaderboard-sheet.tsx:301-303),
  sourced from `passport_cache` (not on-chain). No distinction for
  off-chain saves.

### 1.4 Peones economy is too generous (CONFIRMED — structural leak)
Exact current numbers:

| Source | Amount | Daily cap? |
|---|---|---|
| Daily Tactic | +3 | yes (shared 10/day) |
| Daily Streak bonus (7d) | +1 | yes (shared 10/day) |
| **Training exercise** | **+star delta (1-3)** | **NO — uncapped, outside the cap** |
| Welcome pack | +1 (once) | n/a |

| Sink (`SPEND_COST_BY_TARGET`) | Cost | Live |
|---|---|---|
| hint | 1 | yes |
| coach | 1 | yes |
| retry | 2 | yes |
| save_game | 1 | yes (off-chain quota: 5 free, then 1) |

- `PEONES_DAILY_CAP = 10` but `PEONES_DAILY_CAP_SOURCES` covers only the
  `daily_*` sources — **training_exercise earn bypasses the cap entirely**
  (`types.ts:77-86`). Each fresh 3★ exercise = +3, no ceiling.
- **The leak the founder felt:** earn scales linearly with content
  (N exercises → up to 3N Peones), while sinks are small (1-2 each) and the
  save has 5 free. Net ≈ +3/session, ~2:1 earn:spend. Adding more exercises
  widens the gap. Already documented in
  `docs/product/2026-06-08-peones-economy-philosophy-and-future-sinks.md`
  ("la economía se siente abundante").

---

## 2. UX/UI proposal

Reuse existing Chesscito vocabulary (no new design language). References:
[[og-share-card-recipe]], [[theme-system-foundation]], [[hud-chip-family]],
[[vitrine-hero-band]], `globals.css` candy-tray-pill / gem-badge.

### 2.1 Correct share for SaveScore
- Add a dedicated OG type **`score-saved`** to `app/api/og/exercise/route.tsx`:
  headline **"SCORE SAVED"**, chip **"On the leaderboard"** (not
  "Mastered"), reuse the og-share-card-recipe shell + piece sprite + stars,
  swap the avatar to a score/leaderboard motif (e.g. `corona-pro` or the
  leaderboard tile already used in the sheet hero).
- Point `result-overlay.tsx` score variant **and** `share/score/page.tsx`
  at `type=score-saved`.
- Rewrite `SHARE_COPY.score` to leaderboard framing, drop "on Celo / Kept
  forever" (off-chain now). e.g. *"I just landed {stars}★ on the Chesscito
  leaderboard. Can you beat it?"* (anti-AI-prose: no em-dashes).
- Piece-mastered share keeps `type=badge-earned` / `piece-complete` for its
  real surfaces. No more cross-wire.

### 2.2 Saved-state redesign (visual, candy/premium)
- Reskin `SavedChip` onto **`.candy-tray-pill`** (cream-amber, the HUD chip
  family) with a **check/seal** `CandyIcon`, so it reads as a *seal* not a
  toast. Keep "{stars}★" but as a stat-pill, not a sentence.
- Replace the "Beat your score to save again" sentence with a compact
  visual: a subtle "↑ beat to re-save" affordance OR fold it into the pill
  tooltip. Less plain text.
- **Fix stale copy now** (correctness, ships even before reskin): drop
  "on chain" / "en cadena" from aria + ES, remove the CeloScan receipt link
  for off-chain saves (already `savedReceiptUrl=undefined` since txHash="",
  so the link is dead — make the copy match).

### 2.3 On-chain Proof CTA — lives in the leaderboard, never in the exercise
- Add a **"Save your rank on-chain"** CTA in the leaderboard **hero band**
  (leaderboard-sheet.tsx, where the disabled Passport banner is). Narrative:
  *"Immortalize your spot · verify it forever on Celo."* Treasure/gold
  vocabulary (gem-badge gold / PRO-gold), visually a *premium opt-in lane*,
  distinct from the everyday save.
- v1 scope options (pick in plan): (a) **CTA + "coming soon" sheet**
  (cheapest, sets the lane), or (b) **wire it to the retained sign path**
  (`/api/sign-score` + `submitScoreSigned`) as a real opt-in proof — this is
  a follow-on mini-spec, NOT this proposal's build.
- **Off-chain vs verified visual:** off-chain rows = plain. On-chain proof
  rows = a **gold seal** (gem-badge `data-tone` gold) replacing/augmenting
  the emerald check, plus a one-line legend in the hero ("✓ = verified
  on-chain"). Keeps the simple flow untouched; adds prestige signal on top.
- **Hard line:** the exercise base save stays off-chain and simple. The
  on-chain lane is opt-in, leaderboard-only.

---

## 3. Economy calibration proposal

Pattern references (per UX-references rule, library
`docs/design-patterns/game-economy-patterns.md`):
- **Duolingo** — Gems are *daily-capped* (you cannot grind infinite); Streak
  Freeze is a loss-aversion sink. → bound earn + emotional sink.
- **Candy Crush** — lives/boosters are consumable sinks gating progress.
- **Clash Royale** — cosmetic sinks (emotes/skins) decouple currency from
  progression so spending never feels like a learning tax.

### A. Earnings — close the leak (highest impact)
1. **Bring `training_exercise` under the daily cap.** Add it to
   `PEONES_DAILY_CAP_SOURCES` so ALL earn shares one ceiling. This is the
   single change that makes the economy content-growth-proof (more
   exercises no longer means more Peones).
2. **Lower the combined daily cap 10 → 6.** Enough for one save + one
   hint/coach, not a surplus.
3. **Flatten training reward:** first fresh completion of an exercise =
   **+1 Peón** (milestone), not +1 per star delta (max +3). Stars stay the
   *progress* signal; Peones become a *currency* you notice. Decouples
   stars from Peones (the founder's "separate stars from peones").
   - Net effect: a strong session earns ~6 (the cap), not 3N.

### B. SaveScore cost
- **Keep cost = 1 Peón** (simple). Scarcity now comes from the earn cap, so
  1 Peón actually bites. Avoid escalating tiers in v1 (complexity).

### C. Free quota
- **Reduce 5 → 3 free saves/wallet.** With capped earnings, the 4th save
  becomes a real decision without feeling punitive. (Founder call — see §5.)

### D. Sinks — priority order
1. **Deep Hint (3 Peones)** — full optimal path vs the 1-Peón first-move
   hint. Already recommended in the 2026-06-08 philosophy doc. Immediate,
   high value, teaches. **Build first.**
2. **Streak protection / freeze (3-5 Peones)** — recurring loss-aversion
   sink (Duolingo pattern). Strong recurring demand.
3. **SaveScore** (existing, recalibrated per A-C).
4. **Cosmetics / Themes (variable)** — the big long-term sink.
   [[theme-system-foundation]] is built and dormant; Peones → unlock a
   theme variant is the natural first cosmetic. (Clash-Royale pattern.)
5. **Coach analysis** (existing).

### Target net flow (post-calibration)
~6 earned/session cap, typical spend 3-5 (save + hint/deep-hint) → roughly
**1:1**, with real decisions ("save OR deep-hint this session?"). Scales
flat as content grows.

---

## 4. Implementation plan (sliced, value/risk ordered)

> SDD → TDD → granular commits. Each slice independently shippable.

- **Slice A — Fix share image + stale copy (P0, low risk).**
  New `score-saved` OG type + repoint result-overlay & /share/score; rewrite
  `SHARE_COPY.score`; fix SavedChip "on chain" copy (aria + ES) + drop dead
  receipt link. TDD (OG route test) + VR (new OG snapshot). **Highest value:
  fixes a live wrong-image bug. Start here.**
- **Slice B — SavedChip visual reskin (low risk).**
  candy-tray-pill / seal treatment + stat-pill stars. VR refresh.
- **Slice C — Economy calibration (logic + server).**
  Add `training_exercise` to daily-cap sources; cap 10→6; training flat +1;
  free quota 5→3. ⚠️ **Has a server/migration component**: `FREE_SCORE_SAVE_LIMIT`
  is duplicated in `save-service.ts` AND the SQL `c_free_limit` (Slice 1
  migration) — lockstep change needs a new migration + hosted apply (same
  care as the cluster). Daily-cap source change likely touches the earn
  RPC/endpoint. TDD lockstep tests. Founder sign-off on numbers first (§5).
- **Slice D — Deep Hint sink (3 Peones).**
  New spend target + UI affordance in the hint flow. Medium (touches hint
  surface; coordinate with the existing hint at cost 1).
- **Slice E — Leaderboard on-chain Proof lane (mini-spec).**
  Hero-band CTA + gold verified seal + legend. v1 = CTA + sheet; on-chain
  wiring is its own spec. Largest; do last. Reuses retained sign path.

Recommended order: **A → B → C → D → E** (value-first, risk-ascending).

---

## 5. Founder decisions — RESOLVED 2026-06-10

1. **Daily cap**: 10 → **6**. ✅
2. **Training reward**: **flat +1 per fresh exercise** (decoupled from star
   delta; stars stay the progress/mastery signal). ✅
3. **Free save quota**: 5 → **3** (requires migration + hosted apply). ✅
4. **Proof CTA v1 (Slice E)**: **CTA + "coming soon" sheet** — establish the
   visual lane only, NO on-chain wiring (no sign-score / submitScoreSigned /
   tx / approve). Real wiring is a separate spec. ✅

**Start order confirmed: Slice A first.** A/B/D independent; C carries the
economy numbers above; E is the coming-soon lane.

---

## 6. Risks / notes
- Economy numbers are pre-launch (no real users) — safe to retune now.
- `FREE_SCORE_SAVE_LIMIT` lockstep: TS constant + SQL `c_free_limit` +
  schema-guard test all must move together (new migration, hosted apply).
- Proof on-chain lane is a **future spec**, not this build; keep base save
  off-chain and simple.
- Victory / Get Peones / Coach rail untouched by A-D; only E reuses the
  retained sign helpers (read-only opt-in, no base-loop change).
