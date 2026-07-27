# Red Team Review — daily-streak-nudge (v2)

**Date**: 2026-07-27
**Reviewer mindset**: hostile QA + senior engineer
**Spec reviewed**: `docs/specs/2026-07-27-daily-streak-two-paths.md` (v2)

> **v1 is dead and its review is not reproduced here.** v1 made exercises light the day; the
> review found that overloading `lastCompletedDate` would have disabled the Daily CTA
> (`daily-tactic-card.tsx:78`). The founder cut the scope instead. Every v1 P0 is gone by
> construction: this version writes no field that any existing surface reads.

## Findings

### P0 — Must address before implementation

- **[Interaction] Behaviors 4 and 5 fight each other, and the CTA loses.**
  Behavior 4: "dismissal is by tap anywhere or ✕". Behavior 5: "a primary action opens
  today's Daily". On a full-screen overlay whose backdrop swallows taps, the CTA is a child
  of the dismiss target. Failure scenario: the player taps **Open Daily**, the backdrop
  handler fires first, the screen closes, no navigation happens, and `shownCount` burns one
  of three. The player did the right thing and the product answered by doing nothing and
  spending a teaching slot. Since the CTA is the entire difference between "guidance" and
  "a notice", this is blocking. The spec must state that the action region stops
  propagation, and an acceptance criterion must assert that the CTA navigates and does NOT
  merely dismiss.

- **[Integration] Behavior 6 states a requirement with no owner.**
  "Renders only after the celebration chain has drained" — the spec never names what
  signals drained. `exercises-screen.tsx` already arbitrates this space: the success
  overlay, `resolveMilestones`, the celebration queue, and an explicit
  `badgeMomentOwnedByQueue` guard (~line 1649) that exists because *the badge moment has
  exactly one owner*. Dropping a fourth overlay in without naming its slot in that order
  produces two modals on screen — the precise bug class the `[aria-modal]` counting rule was
  written for, and one that a `role="dialog"` count would pass in green. Name the hook and
  the position in the queue before `/tdd`.

### P1 — Should address

- **[Design] The cap cannot tell a learner from an ignorer.** `shownCount` increments the
  same whether the player took the CTA and solved the Daily or swatted the screen away.
  Someone who learned on day one is taught twice more. The founder chose the hard cap over
  "until they do the Daily", so this is not a reversal — but adding "retire on a Daily
  solved from this screen" costs one boolean and turns the cap from *3 interruptions* into
  *3 chances to learn*, which is what it is for.
- **[Trigger] A modulo is the wrong shape for a gated event.** If the screen cannot render
  at solve 3 (queue busy, per P0-2), `freshSolvesToday % 3 === 0` is false at 4 and 5, and
  the next chance is solve 6. A player who stops at 5 is taught nothing that day, silently.
  A latch ("owed an appearance") survives being blocked; a modulo does not.
- **[Cadence] "Every 3" is not a constant amount of effort.** The ledger counts labyrinths
  and signature games as one unit each (spec calls this intentional), so three solves can be
  90 seconds or a full Promotion Run. The trigger is less predictable than the copy will
  imply. Acceptable, but do not describe it to the player as a count of anything.
- **[Ops] No kill switch.** Open question 2 is correct and under-ranked. A teaching moment is
  a UX judgement that only survives contact with players; without a flag, turning it off
  means reverting code.

### P2 — Nice to clarify

- **[Parse] "Fail toward showing" must not mean "show forever".** A corrupt `shownCount`
  parsing to 0 is right; make sure the clamp is applied on read, so a hostile record cannot
  produce a 4th, 40th appearance.
- **[Mode] `recordExtraConsumed` is gated on `CHESSCITO_LITE_MODE`** (which IS
  `mode === "learn"`, the principal mode — not a stripped variant). In FULL the ledger never
  fills and the screen never appears. Correct, but write it down so it is not later
  diagnosed as a bug from a dev build.

## Verified non-issues

Audited and clean — recorded so nobody spends the hour again:

- **Storage reset.** The new key rides `progressPrefix()`, so it is namespaced by
  `NEXT_PUBLIC_LITE_PROGRESS_VERSION` like every sibling, and `/dev/reset` sweeps every key
  matching `chesscito*` (`app/dev/reset/page.tsx:26`) — the nudge state is cleared by the
  existing QA flow with no change.
- **Migration.** No stored record changes shape or meaning. `DailyProgress` is untouched.
- **Replays.** The ledger is idempotent per content id per UTC day
  (`exercises-screen.tsx:1639`), so the grind loophole closed in 2026-05-31 stays closed
  without this feature restating the rule.
- **Security/PII.** Local-only, one integer and one date string. No network surface, no
  entitlement, nothing to leak.

## Categories audited

**Contract gaps** — Complete for the size. `computeNudgeShown` returning `prev` by reference
matches `computeNextProgress`'s convention (`progress.ts:86`), so a `===` no-op guard keeps
working. No `any`, no optionals that hide a third state.

**Behavioral ambiguity** — Two found, both P0 above. The rest of the behavior list is
mechanically testable.

**Hidden assumptions** — One: that the celebration chain exposes a "drained" moment. Verify
it exists before writing the screen; if it does not, that hook is the first task.

**Backward compatibility** — Nothing to break. This is the whole point of the v2 scope cut.

**Test coverage gaps** — Two criteria missing: the CTA navigates rather than dismisses
(P0-1), and nothing renders while another overlay is open (P0-2).

**Operational readiness** — No flag (P1). Otherwise trivially reversible: the feature is
additive and deleting the module removes it.

## Verdict

**READY for `/tdd`** (spec v3). Verdict raised from NEEDS REVISION after every P0 and three
of four P1s were resolved in the spec. Resolutions below; findings above are left as
written, because a review that edits itself to match the answer records nothing.

### Resolution log — spec v3

| Finding | Resolution |
|---|---|
| **P0-1** CTA swallowed by dismiss-anywhere | Behavior 7: the action region stops propagation. Criterion: *the primary action navigates and does NOT merely dismiss*. |
| **P0-2** "after the chain drains" had no owner | **Dissolved, not patched.** The feature was split into arm (on solve, renders nothing) and pay (on leaving the flow). It no longer shares the celebration moment, so there is no queue position to negotiate. Behavior 9 still asserts no overlap rather than assuming it. |
| **P1** cap cannot tell a learner from an ignorer | Behavior 7: taking the CTA calls `retireStreakNudge()`. The cap now means *3 chances to learn*. |
| **P1** modulo is the wrong shape | Replaced by `owedForDate`, a latch that survives being blocked. New edge cases: it expires with its day, and pays once. |
| **P1** no kill switch | Behavior 11: one build-time flag; criterion asserts nothing is written when off. |
| **P1** "every 3" is not constant effort | **Accepted, unfixed.** Real, cosmetic, and the mitigation is copy: the screen must not describe itself as a count. |
| **P2** clamp on read | Contract: `shownCount` is clamped at read. |
| **P2** LEARN-only ledger | Recorded in the spec's non-goals and edge cases. |

### What the founder's instinct caught that this review did not

The review flagged the *ordering* problem and asked for a queue position. The founder asked
a better question — whether the message belongs in that queue at all — and the measurement
proved him right: three clean solves fire `great-focus-session` **and**
`first-great-session` at exactly the 3rd (`milestones.ts:105-112`, 8-star threshold, three
3★ solves make 9), with `first-reward` landing on the 2nd or 3rd. The 3rd victory is the
single busiest celebration instant in LEARN. A correctly-queued 4th card there is still a
card nobody reads.

P0: 2 (both resolved) · P1: 4 (3 resolved, 1 accepted) · P2: 2 (both resolved)
