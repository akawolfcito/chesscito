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

## Anti-cheat posture (red-team P0 — DECISION NEEDED, founder)
Removing the checkmate assertion means `sign-victory` signs ANY legal transcript
for the requesting address. Legality-replay proves the moves are legal chess,
NOT that the user played them against the AI in a real session. **This delta
already exists for wins** (a hand-crafted legal checkmate would sign today), so
non-wins do not open a new class of forgery — they just extend it. The token
encodes no outcome and difficulty/moves/time are self-reported-but-legal.
**Proposed posture:** accept the collectible as "a legal game I submitted"
(cosmetic; difficulty/moves unverifiable beyond legality). Session-binding
(tying the transcript to a real arena game id) is OUT of scope for F8 and
tracked as future hardening. → Confirm with founder before `/tdd`.

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
- [ ] Full unit suite green; em-dash gate green.

## Out of scope / future
- Per-outcome pricing (kept uniform this round).
- A dedicated non-victory collectible contract / metadata schema.
- OG card copy that explicitly celebrates a "saved loss" (uses existing result art).
- Renaming `VictoryNFT` / `VictoryMinted` on-chain.

## Open questions
- **Q1:** Drop `playerColor` from the `sign-victory` body, or keep it for API
  compat (now unused)? Recommend KEEP (avoids client/caller churn; harmless).
- **Q2:** Does `/api/og/match` already have a `resigned` result mapping, or does
  `resigned` need to alias to the lose visual? (Verify during TDD.)
- **Q3:** Any analytics/funnel events keyed on "victory save" that should now
  fire for non-win saves (e.g. `monetization.save_victory_*`)? Confirm naming
  stays or a neutral event is added.
