# Handoff — Progression Unlocks and Celebration Queue

- **Date:** 2026-07-12
- **PR:** [#214](https://github.com/akawolfcito/chesscito/pull/214) — auto-merge enabled, base `main`
- **Branch:** `feat/progression-unlocks-celebration-queue` (24 commits, base `a4e6efda`, head `bbfc47ec`)
- **Suite:** 5003 passing / 420 files (baseline before the branch: 4875). Typecheck clean. VR 51/51, no baseline changes.
- **Spec:** `docs/specs/2026-07-11-progression-unlocks-celebration-queue.md`
- **Plan:** `docs/specs/2026-07-11-progression-unlocks-implementation-plan.md`

## What shipped

Every reward screen in LEARN already existed; none fired at the right moment. This
branch replaces the ad-hoc triggers with one milestone machine: pure condition
derivation → persisted idempotent events → an ordered celebration queue that
renders exactly one dialog per drain.

**The ladder.** Gift at 4★ + 2 exercises (cumulative). First labyrinth at 6★ of the
piece + 3 exercises. Piece badge eligible at 10★. Special Training at 12★ rook.
Mastery = badge *claimed* + every labyrinth. Great Focus Session at 8 net stars
today **or** the quota running out. First Great Session on the first of those.

**The session limit is not on the ladder.** It is a consumption rule, evaluated only
after every pending recognition drains — so the player who struggles, retries and
burns the day's quota gets the celebration, not the paywall.

**Governing rules now enforced in code:** persistence precedes rendering; exactly one
`aria-modal` surface at a time; a NEW dot means "something is available", never "a
feature exists"; recognition never depends on signing.

## The two defects this existed to fix

1. `daily-tactic-slot.tsx:113` granted the First Focus Day badge **and** the welcome
   gift in one `if`, so the reward landed after a single Daily Focus tactic — before
   any investment existed to reward it. Unbundled. `first-focus-day` keeps its id,
   condition and art; it was never inaccurate, only badly packaged.
2. Special Training was correctly gated at 12★ but *materialized in silence* behind a
   permanently-lit `ready` chip. Now it has an unlock overlay and an honest NEW dot
   that clears on first open.

## What the green suite did not catch

Recorded because it is the load-bearing lesson of this cluster. Every one of these
was found by review, with the suite green, because each component was correct *alone*:

- **The Great Focus Session celebrated twice** on the ordinary badge moment.
  `CelebrationStep.absorbed` was `MilestoneId[]` and dropped the piece scope, so
  `dismissCurrent` re-attached the closer's piece to a global event, built a key that
  did not exist, and wrote nothing. The only absorption test used two piece-scoped
  milestones, so the key resolved by luck.
- **The gift's CTA opened the wrong product** — `useWelcomePackClaim` (the server
  shield pack) instead of the Welcome Package gift the overlay had just promised.
- **A stale snapshot silently un-claimed a claimed gift.** Same bug class as the
  shield credited-cache (#213). Closed with `lib/welcome-package/welcome-package-events.ts`.
- **Two stacked modals** on every player's badge moment (legacy `BadgeEarnedPrompt` +
  the new `UnlockOverlay`).
- **A false, permanently-stamped Mastery crown** on a piece whose badge was never
  minted, when the player switched pieces before claiming.
- **A test time-bomb**: the regression test pinning the highest-value fix used the
  real clock and would have gone red the next day.

**Testing gotcha worth keeping:** `LabyrinthCompleteOverlay` uses `role="alert"`, not
`role="dialog"`. A test counting roles passes **green with a visible modal stack**.
Count `[aria-modal="true"]`.

## Architecture

Pure core, no IO, no React (`lib/progression/`):
- `types.ts` — `MilestoneId`, `MilestoneEvent`, `milestoneKey()`, `NAVIGABLE_MILESTONES`
- `stars.ts` — `netStars()` (net improvement only, so replays cannot farm a session)
- `milestones.ts` — `deriveEarnedMilestones()`, the compound conditions
- `celebration-queue.ts` — two phases, exactly one closer, absorption
- `milestone-storage.ts` — persistence, idempotence, daily reset
- `migration.ts` — `seedExistingPlayer()`
- `gather-input.ts` — adapter from persisted progress

React: `use-celebration-queue.ts`, `use-milestone-seeding.ts`,
`components/progression/unlock-overlay.tsx`.

Thresholds are single-sourced: `milestones.ts` imports `LABYRINTH_UNLOCK_THRESHOLD`
and `LABYRINTH_MIN_EXERCISES` from `lib/training/path.ts`, and `legacy-hub-client.tsx`
imports `SPECIAL_TRAINING_ROOK_STARS`. The drawer and the celebration cannot disagree
about when the maze opens.

## Migration

No retroactive celebration fires for a milestone a player already passed. Seeding runs
in `useMilestoneSeeding`, mounted on **both** `exercises-screen.tsx` (load-bearing —
`resolve()` has exactly one production caller, so no path including a deep link to
`/exercises` can bypass it) and `legacy-hub-client.tsx`. It seeds per piece *with
progress*, and a `chesscito:milestones-seeded` marker makes it a genuine one-time
upgrade that can never re-fire after a solve and eat a pending celebration.

## Accepted trade-offs (founder signed off)

1. **Duplicate art.** `first-focus-day` and `first-great-session` share
   `/art/achievements/1day-focus`. Two achievements measuring different things
   (continuity vs depth) render identical icons in the trophies grid. New art was out
   of scope. Revisit when commissioning icons.
2. **Unsupported chain.** A player connected to the wrong chain gets **no** milestone
   celebrations until they switch back. Nothing is lost: history is seeded and new
   milestones re-derive on the next solve. The alternative was seeding their profile
   as badge-less and later firing their real achievements as if new.

## Next steps

1. **MiniPay device pass on a real 12★ profile** — the founder's own profile has a
   minted rook badge, which is exactly the shape that exposed the seeding race
   (`useAccount().status` vs a disabled contract read). Not yet exercised on device.
2. **VR coverage gap.** VR is 51/51, but **no fixture reaches the new overlays, the NEW
   chip, or the fourth trophies tile** — the suite runs anonymous with empty storage.
   Green means "nothing existing broke", not "the new UI is covered". Add fixtures.
3. ~~**`CLAUDE.md` is stale.**~~ **DONE** — PR #216 (`60695ab3`). It routed every new CSS
   class to `apps/web/src/styles/{arena,hub,coach,exercises}.css`, a split that was
   reverted; that directory does not exist and `globals.css` is the only stylesheet.
   Also corrected: all six pieces are playable (`PLAYABLE_PIECES`), not just the rook,
   and the test baseline (1727 → 5003 / 420).
4. Cluster closure protocol: close issues/milestone, README "What's live" sync,
   branch hygiene. (MEMORY.md synced; branches deleted.)

## Open questions

- Should `first-great-session` get its own icon, or is the shared one acceptable
  long-term? (Accepted for now, not decided forever.)
- `first-great-session` and `piece-badge-claimed` are events with no terminal state:
  they persist but `buildCelebrationQueue` never emits them alone, so they can stay
  permanently "pending". Benign today (the trophies grid reads presence, not
  `celebratedAt`), but it is a shape worth watching.

Wolfcito 🐾 @akawolfcito
