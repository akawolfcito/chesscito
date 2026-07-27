# Spec — daily-streak-nudge

**Date**: 2026-07-27
**Status**: READY for `/tdd` (v3 — v2's two P0s resolved)
**Supersedes**: v1 "daily-streak-two-paths", which changed what lights the day. v1 is dead;
its red team is kept as `-redteam.md` because its P0s are why this version exists.

## Problem

The flame (S2, the daily streak) is lit only by the Daily Tactic —
`recordDailyCompletion` (`lib/daily/progress.ts:83`), three call sites, all Daily surfaces.
That is **deliberate and stays**. The defect is not the rule, it is that the rule is
**invisible**: a player can solve ten exercises, feel they trained hard, and end the day
with a dark flame having never been told what the switch was.

v1 tried to fix this by making exercises light the day too. The red team found that it
would overload `lastCompletedDate`, whose nine readers include
`daily-tactic-card.tsx:78` (`disabled={isCompletedToday}`) — so lighting the day with
exercises would have **disabled the Daily button**, deleting the ritual the feature exists
to teach. Founder's call: keep the ritual, teach it instead.

## Goal

Every third exercise, a player who has not solved today's Daily is shown — at most once a
day, at most three times ever — that the Daily is what lights the streak, with a way in.

**Shown on the way out, never on top of a win.** Measured on the code: three clean solves
put `great-focus-session` **and** `first-great-session` on screen at exactly the 3rd
(`dailyStars >= GREAT_SESSION_STARS`, 8, and three 3★ solves make 9 —
`milestones.ts:105-112`), while `first-reward` lands on the 2nd or 3rd (4★ and 2 exercises,
`milestones.ts:11-12,63-69`). The 3rd victory is the busiest celebration instant in LEARN.
A message that has to be *read* cannot be the fourth card in that stack, so the 3rd solve
only **arms** it and the player is shown it when they leave the flow.

## Non-goals

- **Changing what lights the day.** The Daily remains the only writer of the streak.
- **Daily-streak recovery.** Permanent prohibition. Shields rescue a failed exercise (S1),
  never a lost day (S2).
- New fields on `DailyProgress`. Zero migration, zero change to its nine readers.
- The "Day X of 21" counter. It still advances by wall clock (`challenge-day.ts:6`) and
  still disagrees with the flames. Pre-existing, out of scope, back on the backlog.
- Making a hard-training day count toward the streak. Accepted as designed.

## Contracts (SDD)

The entire feature is one pure module plus one screen. Nothing existing changes shape.

```ts
// lib/daily/streak-nudge.ts — NEW

/** Evaluated every Nth fresh solve. */
export const STREAK_NUDGE_EXERCISE_INTERVAL = 3;
/** Lifetime hard cap. After this the screen never renders again. */
export const STREAK_NUDGE_MAX_SHOWS = 3;

export type StreakNudgeState = {
  /** Lifetime appearances. Monotonic, clamped at STREAK_NUDGE_MAX_SHOWS on READ,
   *  so a corrupt record can never buy a 4th appearance. */
  shownCount: number;
  /** UTC "YYYY-MM-DD" of the last appearance. Enforces once-per-day. */
  lastShownDate: string | null;
  /** THE LATCH. The day an appearance was armed and not yet paid. A modulo
   *  test cannot survive being blocked — if the 3rd solve is a bad moment,
   *  `% 3` is false at 4 and 5 and the day teaches nothing. The latch waits. */
  owedForDate: string | null;
  /** Set when the player opened the Daily FROM this screen. The lesson landed;
   *  the screen retires for good instead of spending its remaining slots. */
  retired: boolean;
};

/** Pure. Arms the latch. Called on every fresh solve — never renders anything. */
export function computeNudgeOwed(
  prev: StreakNudgeState,
  input: {
    today: string;
    /** `isCompletedToday()` — the EXISTING answer, not a new concept. */
    dailySolvedToday: boolean;
    /** `getUsedCount(getDailySession())` — the existing per-day ledger. */
    freshSolvesToday: number;
  },
): StreakNudgeState;

/** Pure. Pays the latch. Called when the player LEAVES the exercise flow.
 *  Deliberately blind to solve counts: by here the decision is already made. */
export function shouldShowStreakNudge(input: {
  state: StreakNudgeState;
  today: string;
  dailySolvedToday: boolean;
}): boolean;

/** Pure. Idempotent within a day: returns `prev` by reference when
 *  `lastShownDate === today`, mirroring `computeNextProgress`. */
export function computeNudgeShown(
  prev: StreakNudgeState,
  today: string,
): StreakNudgeState;

export function getStreakNudgeState(): StreakNudgeState;
export function recordStreakNudgeShown(today?: string): StreakNudgeState;
/** Retires the screen permanently. Called when its CTA is taken. */
export function retireStreakNudge(): StreakNudgeState;
```

```ts
// lib/lite-progress-storage.ts — one line, following the existing convention
export function streakNudgeStorageKey(): string; // `${progressPrefix()}streak-nudge`
```

## Behavior

**Two moments, never one.** Arming is silent and happens on a solve; paying is visible and
happens on the way out. Nothing about this feature renders during a celebration.

### Arming (on every fresh solve)

1. `computeNudgeOwed` sets `owedForDate = today` iff **all** hold: `!dailySolvedToday` ·
   `freshSolvesToday > 0` · `freshSolvesToday % STREAK_NUDGE_EXERCISE_INTERVAL === 0` ·
   `shownCount < STREAK_NUDGE_MAX_SHOWS` · `lastShownDate !== today` · `!retired`.
2. Arming renders nothing, blocks nothing, and is idempotent: re-arming a day already
   armed returns `prev` by reference.
3. Replays do not arm. `recordExtraConsumed` (`exercises-screen.tsx:1639`) is idempotent per
   content id per UTC day, so the ledger this reads already refuses them.

### Paying (on leaving the exercise flow)

4. The screen renders when the player **exits the exercise flow** with the latch owed for
   today: tapping back to the hub, or opening the exercise drawer to choose what is next.
   Both are decision moments, so the screen's ask ("do the Daily") is the same kind of thing
   the player is already doing. Neither competes with a reward.
5. The exit that triggered it is **deferred, not cancelled**: dismissing performs the
   navigation the player originally asked for. "Tap to continue" means continue to where
   they were going.
6. Dismissal is by tap anywhere **or** by an explicit ✕. Both are identical: close,
   `recordStreakNudgeShown()`, resume the deferred exit, and mutate no progress — no streak,
   no stars, no quota.
7. A primary action opens today's Daily. **Its region stops propagation**, so the tap that
   takes the CTA can never be eaten by the dismiss-anywhere surface. Taking it counts as an
   appearance AND calls `retireStreakNudge()`: the player learned, so the screen stops.
8. `shouldShowStreakNudge` re-checks `dailySolvedToday` at pay time. A player who armed the
   latch and then solved the Daily before leaving never sees it.
9. Nothing renders while another overlay is open. By construction this is nearly free — the
   celebration chain belongs to the solve moment and has drained before an exit is possible —
   but it is asserted, not assumed.
10. Reaching `STREAK_NUDGE_MAX_SHOWS` retires the screen permanently. Three explanations of
    a one-sentence rule are enough; a fourth is nagging.
11. The whole feature sits behind one build-time flag, so a teaching moment that lands badly
    is turned off without reverting anything else.

## Edge cases

- **The latch expires with its day.** `owedForDate` is compared against today, never merely
  truthy: a debt armed on Monday must not be paid on Tuesday, when the player has a fresh
  chance to do the Daily and the message would be about a day that is already lost.
- **Armed, then the player never leaves** (closes the tab mid-session): the debt dies with
  its day. Accepted — chasing it into the next session is how a teaching moment becomes a
  haunting.
- **Armed at solve 3, blocked, still owed at solve 6**: it pays once. `lastShownDate`
  guards the day, not the solve.
- **UTC rollover mid-session**: the ledger resets (`parseDailySession` returns a fresh state
  when `date !== today`), so the count restarts at 0 and the next appearance is a new day's.
  Same rule the quota has always used.
- **At the free session limit**: the screen still applies — its ask is the Daily, which is
  never quota-gated. This is precisely the moment it is most useful.
- **Scoring frozen**: a frozen replay persists nothing, so it does not advance the ledger.
- **localStorage unavailable**: reads return the default state and the screen may re-appear
  next session. It must never throw; the exercise flow does not depend on it.
- **Corrupt stored state**: parse defensively — non-numeric `shownCount` → 0, invalid date
  → null. A corrupt record must fail toward showing, not toward crashing.
- **Labyrinths / signature games** consume the same ledger, so they advance the count too.
  Intentional: the screen's premise is "you have been training", not "you did exercises".
- **Two tabs**: a second tab could show it the same day. The once-per-day guard is written
  on show; last write wins. Acceptable — worst case is one extra appearance.

## Acceptance criteria

- [ ] The 3rd fresh solve **arms** the latch and renders nothing.
- [ ] The 1st, 2nd, 4th and 5th arm nothing.
- [ ] Leaving the flow with the latch owed shows the screen; leaving without it does not.
- [ ] **Nothing renders during the solve moment** — the 3rd solve of three 3★ exercises
      fires `great-focus-session` + `first-great-session`, and the screen is absent through
      all of it.
- [ ] A latch armed at solve 3 but not paid still pays on the exit after solve 5.
- [ ] A latch armed yesterday never pays today.
- [ ] Never shows when `isCompletedToday()` is true — including when the Daily was solved
      between arming and leaving.
- [ ] Never shows a 4th time, ever, across days and sessions.
- [ ] Tap and ✕ produce identical state; neither touches `DailyProgress`, stars, or quota.
- [ ] Both dismissals **complete the deferred navigation** the player originally asked for.
- [ ] **The primary action navigates to the Daily and does NOT merely dismiss** — the
      dismiss-anywhere handler must not swallow it.
- [ ] Taking the CTA retires the screen: a 2nd appearance never happens afterwards.
- [ ] With the flag off, no state is written and nothing renders.
- [ ] Only one `aria-modal="true"` in the DOM while it is open — count `[aria-modal]`,
      never `role="dialog"` (`LabyrinthCompleteOverlay` uses `role="alert"`).
- [ ] `DailyProgress` and its nine readers are untouched: the Daily CTA stays enabled, the
      hub pulse still fires, `content-loop.ts:337` still sees `daily-pending`.
- [ ] Corrupt or absent stored state yields the default and never throws.

## Out of scope / future

- The "Day X of 21" counter vs the flames.
- Whether a hard-training day should ever count toward the streak.
- Any server-side verification of the streak.

## Open questions

1. **Copy.** Needs an `editorial.ts` entry: no "on-chain"/NFT/mint (language brief), and the
   file has a hard ceiling of **0 em-dashes** enforced by `anti-ai-prose.test.ts`.
   Resolvable during `/tdd`; it blocks no contract.

*(v2's open question about a kill switch is now behavior 11.)*
