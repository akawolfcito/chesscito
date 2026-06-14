# Red Team Review — save-any-match-collectible (F8)

**Date**: 2026-06-14
**Reviewer mindset**: hostile QA + senior engineer + on-chain skeptic

## Findings

### P0 — Must address before implementation

- **[anti-cheat] Dropping the checkmate check removes the ONLY proof the player
  actually played this game.** Today the signature implies "a real win". After
  the change, `sign-victory` signs ANY legal transcript for ANY address in the
  request body. An attacker can submit a hand-crafted legal sequence for a
  high difficulty and mint a "difficulty 3, 200-move" collectible they never
  played. Why blocking: the spec frames legality-replay as "anti-forgery" but it
  only proves the moves are legal chess, NOT that this user played them against
  the AI. Decide explicitly: is that acceptable (collectible = "a legal game I
  submitted", cosmetic) or must we bind the transcript to a real arena session?
  If cosmetic-only is acceptable, SAY SO in the spec and accept that difficulty
  on the token is unverifiable. (Note: this attack already partially exists for
  wins — you can craft a legal checkmate — so the delta may be acceptable, but
  it must be a conscious decision, not a silent side effect.)

- **[contract] `totalMoves` is `uint16`; legality replay caps at 300 — fine, but
  confirm the contract's other reverts don't gate outcome indirectly.** Verify
  `mintSigned` has NO branch that assumes a win (e.g. a score/result arg in a
  sibling path, or a `Scoreboard` write that requires a win). Spec claims the
  contract is outcome-agnostic — prove it by reading the full `mintSigned` body
  and any post-mint hooks before relying on it. Why blocking: a wrong assumption
  here means losses revert on-chain after the user pays gas.

### P1 — Should address

- **[copy] "Save match" collides with the existing "Save Victory" / treasure
  ribbon vocabulary and the `mintVictory` key.** The viewer Save tile label is
  `saveVictory` (COACH_VIEWER_COPY) used for ALL outcomes once the tile renders
  for non-wins. Spec says win→"Save Victory", non-win→"Save match" but does not
  enumerate WHICH keys change in WHICH of the ~10 files. Risk if ignored: a
  half-migrated copy set where a loss popup still says "Save Victory". Spec must
  list every callsite + the result→label mapping helper (single source of truth).

- **[funnel] `monetization.save_victory_tap` / `save_victory_success` fire on
  win saves (victory-celebration.tsx:153, victory-claim-success.tsx:87).** If
  non-win saves reuse these events, dashboards conflate "victory conversions"
  with "any save". Risk: M1 funnel metrics silently change meaning. Decide:
  neutral event name for non-win saves, or a `result` property on the existing
  event. (Spec Q3 flags this — promote to a decision.)

- **[ui] Adding Save to the `arena-end-state` loss/draw/resign layout competes
  with the Coach primary CTA.** On loss/draw, Coach Review currently owns the
  primary slot (`isCoachPrimaryVariant`). Where does Save go — primary, a
  secondary row, or a 4-tile row like the viewer? Risk if ignored: two primary
  CTAs fighting, or Save buried where users miss it. Spec must define the
  loss/draw/resign popup's button hierarchy explicitly (UI-states HARD RULE).

- **[mint flow] The arena loss/draw/resign popups have NO mint state machine.**
  Win uses `VictoryCelebration` → `claiming/success/error` via arena-end-state's
  claim phases. Loss/draw/resign popups never mint, so they have no
  claiming/success/error UI. Adding Save means wiring the full mint lifecycle
  (progress, error, success/toast) into those popups too. Risk if ignored: a
  loss Save taps into a dead handler or shows no progress. This is bigger than
  "add a button" — scope it.

### P2 — Nice to clarify

- **[og] `/api/og/match` result mapping for `resigned`** — spec Q2. Confirm it
  renders (lose visual) vs 404/blank.
- **[playerColor] Q1** — keeping the now-unused field is fine; just note it is
  intentionally inert so a future reader does not "fix" it by re-adding a check.
- **[i18n] `mintVictory` ("Mint Victory") vs `saveVictory` ("Save Victory")** —
  two existing keys; confirm which surface uses which so the neutral variant
  lands on the right one(s).
- **[tests] sign-victory existing tests assert the checkmate rejection.** They
  must be updated, not deleted — add a non-win success case AND keep illegal-move
  rejection. Verify `route.test.ts` doesn't lock the old behavior.

## Categories audited

### Contract gaps
- `SaveableResult` is a closed union — good, no `any`.
- Signature fields unchanged — no new on-chain surface. Good.
- Failure modes: illegal move (kept), rate limit (kept), origin (kept). No new
  error type needed.

### Behavioral ambiguity
- "Add a Save affordance to loss/draw/resign" — placement/hierarchy undefined
  (P1).
- Mint lifecycle UI for non-win popups undefined (P1).

### Hidden assumptions
- Assumes the contract is fully outcome-agnostic (P0 — verify `mintSigned`).
- Assumes `/api/og/match` handles all results (P2).
- Assumes the off-chain game record is the source of truth for displayed outcome
  (true — the token encodes none).

### Backward compatibility
- Win flow must be unchanged — the only diff is removing two asserts. Regression
  test for a win signing identically is required (in acceptance criteria — good).
- `result?: "win"` widening to a union is additive; existing callers passing
  "win" keep working. Safe.

### Security & data
- Removing the checkmate check WIDENS what gets signed (P0). Rate limit + origin
  + nonce + cooldown remain, so it is not a spam vector beyond today.
- No new PII. Wallet-scoped as before.

### Test coverage gaps
- Every acceptance criterion is testable. Add: non-win sign success, win-still-
  signs regression, illegal-move still rejected, viewer passes real result,
  Save tile renders per outcome, 0-move hides Save.

### Operational readiness
- Rollback: revert the route + UI commits; no migration, no contract change, so
  rollback is clean (no on-chain state to unwind — already-minted non-win tokens
  simply persist, which is harmless).
- Logging: the route already logs errors; add no PII.

## Verdict — UPDATED 2026-06-14 (post-revision)
**READY for /tdd (phase a).** Both P0s resolved in the spec:
1. P0-1 (contract) — verified outcome-agnostic by reading `mintSigned:122-166`;
   recorded in spec "Contract verification".
2. P0-2 (anti-cheat) — founder-approved cosmetic posture + cheap timing
   heuristic (#1); session-binding deferred (no reward tied to the token).

P1s folded into the spec:
- UI hierarchy + mint-lifecycle concern → handled by the **phase split**: phase
  (a) ships via the Match Review viewer (which already owns the full mint
  lifecycle + F7 toast), so no new lifecycle UI is needed for the MVP. Phase (b)
  (arena loss/draw/resign Save) explicitly owns the lifecycle-wiring work.
- Copy → single `saveCtaLabelKey(result)` helper (Behavior 10).
- Funnel → `result` property on existing events (Behavior 11).

**Recommendation:** run `/tdd` on **phase (a)** only. Re-scope/review phase (b)
(arena popup Save + lifecycle) as its own pass after (a) is verified green.

~~NEEDS REVISION~~ (original verdict; superseded above).
