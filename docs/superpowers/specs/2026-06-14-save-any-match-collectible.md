# Spec — save-any-match-collectible (F8)

**Date**: 2026-06-14
**Status**: draft
**Cluster**: coach-analysis review follow-ups (F8 of founder review; F1–F7,F9 shipped to `main`)

## Problem
Save (on-chain mint) is win-only today. A player who draws, loses, or resigns
has no way to keep that game as a collectible — yet the founder wants every
match to be saveable. The restriction is NOT a contract limitation: the
`VictoryNFTUpgradeable` contract signs only `player/difficulty/totalMoves/
timeMs/nonce/deadline` (no outcome field, no on-chain win check). The win gate
lives entirely in the backend `sign-victory` route, which replays the move
transcript and refuses to sign unless it ends in a checkmate delivered by the
player (`route.ts:62-68`).

## Goal
Any legal, non-empty match (win/draw/lose/resign) can be saved as a collectible
with no contract redeploy — by relaxing the backend signing gate and surfacing
a Save affordance across all end-state outcomes.

## Non-goals
- No contract change/redeploy. `VictoryNFTUpgradeable` is used as-is.
- No pricing change (same micro-fee per difficulty for every outcome — founder).
- No renaming the contract or its `VictoryMinted` event (internal, invisible).
- 0-move games stay non-saveable (contract reverts on `totalMoves == 0`).
- No new "match collectible" contract or separate mint path.

## Contract verification (red-team P0 — RESOLVED)
Read `VictoryNFTUpgradeable.mintSigned` (`:122-166`) in full. It is fully
outcome-agnostic: it stores `VictoryData{difficulty, totalMoves, timeMs,
mintedAt}` (no result field), emits `VictoryMinted`, and has NO Scoreboard
write or win branch. Reverts only on: difficulty∉[1,3], `totalMoves==0`,
`timeMs==0`, expired deadline, used nonce, cooldown, token not accepted, price
unset, bad signature. ⇒ Losses/draws/resigns will NOT revert (given
`totalMoves>0`). No contract change needed — confirmed, not assumed.

## Anti-cheat posture (red-team P0 — RESOLVED, founder approved 2026-06-14)
Because the AI/game runs client-side, the server never witnessed the game
(`sign-victory` replays the client-submitted transcript — proof it didn't hold
it). So no save-time check can prove authorship; that needs the server in the
loop DURING play (session-authoritative AI or move-by-move attestation) — a
re-architecture, OUT of scope for F8.

**Approved posture: cosmetic.** The collectible = "a legal game I submitted".
Difficulty/moves/time are self-reported-but-legal; the token encodes no outcome
and is NOT tied to any ranking or reward (the contract stores no score), so
forging one costs the attacker the same micro-fee for pure vanity — no economic
exploit. This delta already exists for wins (a hand-crafted legal checkmate
signs today); non-wins only extend it.

**Cheap red added (heuristic #1):** `sign-victory` rejects implausible cadence —
require `timeMs >= totalMoves * MIN_MS_PER_MOVE` (tune `MIN_MS_PER_MOVE`, e.g.
~250ms) so an instant bulk-submitted transcript is refused. Raises forgery cost
without server-in-the-loop. Session-binding (#2) and move attestation (#3) are
future hardening, reopened ONLY if collectibles ever feed rankings/rewards.

## Phasing (red-team P1 — split to de-risk)
- **Phase (a) — core, small:** backend gate relaxation + timing heuristic +
  Match Review viewer Save for non-wins (`game-actions-bar` Save tile + viewer
  passes real `result`) + copy helper. The viewer ALREADY has the full mint
  lifecycle (`use-mint-victory` + `postMintReceipt` + F7 toast), so this ships a
  complete "save any match" path on its own (any saved game is reachable via the
  redirect / Journal). **This is the F8 MVP.**
- **Phase (b) — reach/convenience, larger:** add Save directly to the arena
  loss/draw/resign popup (`arena-end-state`). These popups have NO mint state
  machine today (only the win `VictoryCelebration` path does), so (b) must wire
  claiming/success/error UI there. Ships after (a) is verified.

## Founder decisions (this session)
| Decision | Choice |
|---|---|
| Anti-cheat for non-wins | Keep transcript legality replay; DROP the checkmate requirement |
| Branding | win → "Save Victory"; draw/lose/resign → neutral "Save match" |
| Cost | Same fee for all outcomes (no pricing change) |

## Contracts (SDD)

```ts
// The match outcome the save flow now accepts (was: "win" only).
type SaveableResult = "win" | "lose" | "draw" | "resigned";

// sign-victory request body — playerColor stays for API compat but is no
// longer asserted (it only fed the mate-by-player check, now removed).
type SignVictoryRequest = {
  player: string;          // 0x address
  difficulty: number;      // 1..3
  moveHistory: string[];   // SAN, 1..300, each ≤12 chars
  playerColor: "w" | "b";
  timeMs: number;          // 1..3_600_000
};

// Unchanged response — signature still covers the same EIP-712 fields.
type SignVictoryResponse = {
  nonce: string;
  deadline: string;
  signature: string;
  totalMoves: string;      // server-derived from the replayed transcript
};

// use-mint-victory input — result widens from the "win" literal.
type UseMintVictoryInput = {
  result?: SaveableResult; // was: "win"
  // ...existing fields unchanged
};
```

### Backend change (the only signing-logic change)
`replayAndValidate(moveHistory, playerColor)` →
`replayForLegality(moveHistory)`:
- Replay every SAN from the standard start; throw `"Illegal move in transcript"`
  on any rejected move (UNCHANGED — anti-forgery).
- REMOVE the `isCheckmate()` assertion (`route.ts:62-64`).
- REMOVE the mate-by-player turn check (`route.ts:65-68`).
- Return `moveHistory.length` (UNCHANGED — never trust client totalMoves).
- `playerColor` is no longer used for validation; keep parsing it (API compat)
  or drop the field — see Open question Q1.

## Behavior

1. Given any saved game with ≥1 legal move, when the player taps Save, then
   `sign-victory` signs the transcript regardless of the board's terminal state
   (checkmate, stalemate, draw, mid-game resign, or a lost position).
2. Given a win, when the Save CTA renders, then its label reads "Save Victory"
   (EN) / "Guardar Victoria" (ES) — unchanged celebratory copy.
3. Given a draw/lose/resign, when the Save CTA renders, then its label reads the
   neutral "Save match" (EN) / "Guardar partida" (ES).
4. Given a draw/lose/resign end-state popup (`arena-end-state` loss/draw/resign
   layout), then a Save affordance is present alongside Play Again · Share ·
   Ask Coach (it was absent — win used the dedicated `VictoryCelebration`).
5. Given the Match Review viewer (`game-actions-bar`) for any non-win outcome,
   then the Save tile renders (today gated behind `isWin`).
6. Given the viewer mints for any outcome, then `use-mint-victory` is called with
   the game's ACTUAL result (the viewer hardcodes `result: "win"` at
   `coach-game-client.tsx:102` — must pass `mappedResult`).
7. Given a successful save of any outcome, then the F7 confirmation toast fires
   ("Saved on-chain · #N") — already outcome-agnostic.
8. Given an OG share card for a saved non-win, then the card renders with the
   correct `result` (the `/api/og/match` route already accepts win/lose/draw;
   confirm `resigned` maps to the lose visual).
9. Given any non-empty transcript, when `sign-victory` runs, then it rejects an
   implausible cadence (`timeMs < totalMoves * MIN_MS_PER_MOVE`) with a 400
   before signing (heuristic #1).
10. Given the Save CTA label across surfaces, then it derives from a single
    helper `saveCtaLabelKey(result)` → `"saveVictory"` on win, `"saveMatch"` on
    non-win — no per-callsite string branching. Phase (a) callsites:
    `game-actions-bar`; phase (b): `arena-end-state` loss/draw/resign.
11. Given a non-win save tap/success, then the existing `monetization.save_
    victory_tap` / `save_victory_success` events fire WITH a `result` property
    (win|lose|draw|resigned) — events keep their names (dashboard continuity),
    gain a dimension. No new event names.

## Edge cases
- **0-move game (instant resign):** Save is HIDDEN (UI `tooShort` gate) and the
  contract would revert (`totalMoves == 0`). Double-blocked. (Ties to F6: a
  0-move close routes to the Journal.)
- **Mid-game position (resign before any terminal state):** legal-replay passes;
  signs fine. The collectible records moves/time, not a board outcome.
- **Forged "win" transcript:** irrelevant on-chain — the NFT encodes no outcome;
  the displayed outcome comes from the off-chain game record, not the token.
- **Re-save / unlimited save:** unchanged — each outcome can be re-saved (Plan 1
  model); the F7 toast re-announces.
- **Draw vs stalemate:** both map to the neutral "Save match" copy.
- **Existing win flows:** must be byte-for-byte unchanged (copy, fee, signature
  fields) — only the checkmate assertion is removed.
- **Offline / sign route 400:** existing failure UI; no new path.

## Acceptance criteria
- [ ] `sign-victory` signs a legal NON-checkmate transcript (draw/lose/resign)
      and still rejects an illegal move with `"Illegal move in transcript"`.
- [ ] `sign-victory` still derives `totalMoves` server-side (ignores client).
- [ ] A win still signs exactly as before (regression test green).
- [ ] `use-mint-victory` accepts `result: "lose" | "draw" | "resigned"` and the
      client guard no longer requires `result === "win"`.
- [ ] Viewer passes the real `mappedResult` into `use-mint-victory` (not "win").
- [ ] `game-actions-bar` renders the Save tile for win/draw/lose/resign.
- [ ] `arena-end-state` loss/draw/resign popups render a Save affordance.
- [ ] Save label is "Save Victory" on win, "Save match" on non-win (EN + ES,
      no em/en-dashes).
- [ ] 0-move games never show Save (UI) — regression test.
- [ ] VR baselines refreshed for the new Save affordance on loss/draw/resign
      popups + viewer non-win slates.
- [ ] `sign-victory` rejects `timeMs < totalMoves * MIN_MS_PER_MOVE` (400) and
      accepts plausible cadence (heuristic #1).
- [ ] A single `saveCtaLabelKey(result)` helper drives every Save label; no
      inline result→string branching at callsites.
- [ ] `monetization.save_victory_tap`/`_success` carry a `result` property on
      non-win saves; event names unchanged.
- [ ] Full unit suite green; em-dash gate green.

## Acceptance criteria — phase split
- **Phase (a):** sign-victory relax + timing heuristic + viewer Save (non-win) +
  real `result` passthrough + `saveCtaLabelKey` helper + copy keys + funnel
  `result` property + tests. Shippable alone.
- **Phase (b):** Save affordance + full mint lifecycle (claiming/success/error)
  on `arena-end-state` loss/draw/resign + VR + tests.

## Out of scope / future
- Per-outcome pricing (kept uniform this round).
- A dedicated non-victory collectible contract / metadata schema.
- OG card copy that explicitly celebrates a "saved loss" (uses existing result art).
- Renaming `VictoryNFT` / `VictoryMinted` on-chain.

## Resolved decisions
- **Q1 (playerColor):** KEEP it in the `sign-victory` body, intentionally inert
  (it only fed the removed mate-by-player check). Add a comment so a future
  reader does not "fix" it by re-adding a result check.
- **Q3 (funnel):** Keep `monetization.save_victory_*` event names; add a
  `result` property (Behavior 11). No new event names.

## Open questions (verify during TDD, non-blocking)
- **Q2:** Confirm `/api/og/match` renders `resigned` (alias to lose visual) vs
  blank — fix in the Save/share path if it 404s.
- **MIN_MS_PER_MOVE** exact value — start ~250ms, tune against real arena timing
  data so legitimate fast games are never rejected (err generous).
