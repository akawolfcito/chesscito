# Red Team Review — integrated-training-path

**Date**: 2026-06-11
**Reviewer mindset**: hostile QA + senior engineer
**Spec reviewed**: `docs/specs/integrated-training-path.md` (verified against `9961f43b`)

## Findings

### P0 — Must address before implementation

- [dormant-content] **12 of 18 catalog labyrinths have never been playable** (every lab
  except each piece's index 0: rook-lab-2/3, bishop-lab-4, knight-lab-2/3/4/5,
  pawn-lab-3/4/5, queen-lab-2/3)
  (`exercises-screen.tsx:2091` hardcodes `labyrinthList[0]`). They were authored but never
  human-validated: solvability, `optimalMoves` correctness, and obstacle layouts are
  unverified. Exposing them via node taps ships untested content. — Why blocking: a broken
  labyrinth mid-path is a dead end in the core loop. **Mitigation already in spec**: slice 3
  gate "QA-solve every dormant labyrinth". Keep it as a hard gate, plus add a unit test
  that asserts each labyrinth has at least one legal solution path within
  `optimalMoves + 4` (the 1★ ceiling) — solvability becomes CI-checked, not manual-only.

- [steering×labyrinth] Spec B8 asserts steering "is suspended while
  `effectiveLabyrinthMode` is true" — but **current code behavior is unverified**. The
  steering effect (`exercises-screen.tsx:914-927`) mutates the active exercise; whether it
  exits labyrinthMode today is unknown. If implementation assumes B8 already holds, slice 3
  may ship a regression identical in shape to the /arena PLAY timer fragility
  ([arena-play-timer-fragility]). — Why blocking: must be verified (and likely implemented)
  with a failing test FIRST in slice 3, not assumed.

- [badge-node-contradiction] Spec resolves it (B4/B7: milestones unlock by own rule,
  path order is guided not gated) — verify the UI slice actually renders a complete badge
  node above locked lab nodes without implying the user "skipped" anything. If the visual
  reads as linear, users at 10★ with locked labs will report it as a bug. — Why blocking:
  this is the single most likely "it looks broken" report; UI copy for this state must be
  in slice 2's acceptance, not improvised.

### P1 — Should address

- [economy-cap] `labyrinth_completion` daily-cap value is unspecified. Total labyrinth
  supply is ~10 Peones lifetime (one per lab), so farming risk is nil, but the cap table
  entry still needs an explicit number (proposal: reuse the `exercise_completion` cap) and
  the earn must check `bestBefore == null`, not "improved best" — otherwise improving from
  2★→3★ re-triggers earn. Risk if ignored: silent ledger drift, audit pain.
- [first-completion-race] Double-tap / rapid re-complete before `recordLabyrinthBest`
  persists could fire two earn POSTs. Idempotency key `labyrinth_completion:{piece}:{labId}`
  makes the second a no-op server-side — but only if the key truly omits attempt/seq.
  Spec says it does; keep it that way and add a test.
- [threshold-asymmetry] Queen/king: 5 exercises = 15★ max; 6★ lab unlock = 40% of pool vs
  20% for rook. Path "feels" different per piece. Acceptable pre-launch, but the spec's
  open question on threshold value should be decided per-pool-size or accepted explicitly.
- [guest-mastery-flicker] `badgeClaimed` comes from an on-chain read; on wallet connect it
  resolves async. Mastery node may flash locked→complete. Reuse the
  [pro-recognition-pattern] localStorage-cache approach or accept the flicker explicitly.
- [vr-baselines] Slices 2–3 touch MissionPanelCandy + MissionDetailSheet — both have VR
  baselines. Hard rule: refresh in same PR with rationale. Budget it into the slices.
- [monolith-risk] `exercises-screen.tsx` is 2773 LOC with documented effect fragility.
  Slice 3 adds node-tap state. Mitigation: new state lives in a memoized hook
  (`useTrainingPath`) with `useCallback`-stable returns ([hook-ref-stability]).

### P2 — Nice to clarify

- [lab-ordering] Ordering labs by `optimalMoves` is a heuristic; two labs with equal
  optimalMoves have unstable order. Tie-break by catalog index; add explicit `tier` later.
- [telemetry] `training.path_*` event names/payloads unspecified — define in slice 5,
  follow `monetization.*` contract style.
- [stale-comment] `exercises.ts:821` "de 15 estrellas posibles" is wrong for 10-exercise
  pools; fix opportunistically in slice 1.
- [i18n] New copy ("Unlocks at N★", "Connect to claim", mastery strings) needs EN+ES and
  must pass the anti-AI-prose em-dash gate.

## Categories audited

- **Contract gaps**: types complete; `UnlockRule` discriminated union explicit; no `any`.
  `TrainingPathInput.badgeClaimed` conflates "claimed on-chain" vs "claimable locally" —
  fine for v1 since mastery treats them equally for guests (spec open question covers it).
- **Behavioral ambiguity**: B8 was assumption-stated (now P0-2). B4/B7 non-linear
  unlock resolved in spec.
- **Hidden assumptions**: dormant labs validated (P0-1); steering behavior (P0-2);
  on-chain read latency (P1 guest-mastery-flicker).
- **Backward compatibility**: no storage migration, thresholds only loosen, badge contract
  untouched, rotation untouched — clean. Slice 3 deletes `labyrinthAvailable` prop chain;
  grep for stragglers in tests/fixtures.
- **Security & data**: no new endpoints; earn reuses existing authed flow + idempotency +
  daily cap. No PII. Sign-labyrinth untouched.
- **Test coverage**: every behavior maps to a criterion; add the solvability CI test (P0-1).
- **Operational readiness**: earn is fire-and-forget like training-earn (acceptable);
  rollback = revert slice commits, no data migration to unwind.

## Verdict

**READY for /tdd on Slice 1** (pure lib, no P0 touches it), with conditions:

1. P0-1 (dormant-lab QA + solvability test) is a hard gate before Slice 3.
2. P0-2 (steering×labyrinth) starts Slice 3 with a failing test, never an assumption.
3. P0-3 (badge-node visual state) is an explicit acceptance item of Slice 2.

P0: 3 (all converted into slice gates) · P1: 6 · P2: 4
