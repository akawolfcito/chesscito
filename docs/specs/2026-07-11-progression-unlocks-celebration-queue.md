# Progression Unlocks and Celebration Queue

- **Date:** 2026-07-11
- **Status:** Approved for planning
- **Surface:** LEARN (Lite + full), hub action rail, exercises screen
- **Baseline:** `main` @ `6f4d4060`

## Problem

Chesscito already owns every screen this design needs: the welcome gift, the
labyrinth path, the daily-limit card, the piece badge, the mastery crown, the
Special Training mini-arena. What it does not own is **when** they fire.

Two concrete defects drive this spec.

**1. The gift and the First Focus Day badge are the same event.**
`daily-tactic-slot.tsx:113` reads:

```ts
if (CHESSCITO_LITE_MODE && prev.totalCompleted === 0) {
  firstFocusDayJustEarned.current = true;
  welcomePackage.unlock();
}
```

One `if` grants a continuity badge and a reward. A player who has done nothing
but open the app and solve one Daily Focus tactic already carries a pending-gift
indicator. The reward arrives before any investment exists to reward.

**2. Special Training appears in silence.**
`hub-arena-tile.tsx:38` hides the tile until `starsPerPiece.rook >= 12`
(`legacy-hub-client.tsx:426`), so the gate is real — but the unlock has no
moment. The tile simply materializes, carrying a permanently-lit
`HubTileStatusChip kind="ready"` (`hub-arena-tile.tsx:51-53`, commented as *"no
invented logic"*). The dot means "this button exists", not "something new is
here".

The through-line: **nothing important should simply appear. It is earned, then
celebrated, then made accessible.**

## Governing rules

1. **Earn → celebrate → open.** Every milestone persists an event, shows an
   overlay, offers a CTA, and only then leaves a NEW marker in navigation.
2. **A NEW dot means "something is available", never "a feature exists".** It is
   set when the unlock persists and cleared the first time the player opens that
   content.
3. **The wall never arrives before the praise.** The session limit is a
   consumption rule, not a progression milestone. It is evaluated only after all
   pending recognitions are processed.
4. **Quality accelerates the ladder.** Progress is measured in stars, not in
   exercise count — with a floor of completed activities so a single perfect
   solve cannot skip the arc.
5. **Replays do not inflate progress.** Stars count as **net improvement over
   the previous best**, never as a fresh grant.

## Star accounting

Two counters, deliberately different windows.

```
netStars(exerciseId, newStars) = max(0, newStars - previousBest(exerciseId))
```

| Counter | Definition | Window |
|---|---|---|
| `lifetimeStars` | Sum of best stars across all exercises (already `progress.stars`) | Cumulative, never resets |
| `pieceStars(piece)` | Sum of best exercise stars for that piece (already `totalStars` in `path.ts:74`) | Cumulative, never resets |
| `dailyStars` | Sum of `netStars` earned today, exercises **and** labyrinths | Resets at UTC midnight |

`dailyStars` is the only daily counter. It is the sole input to Great Focus
Session.

**Labyrinth stars count toward `dailyStars` but never toward `pieceStars`.**
Letting a labyrinth's stars feed the threshold that unlocked that labyrinth is a
circular dependency. `path.ts:74` already excludes them; this spec makes the
exclusion deliberate rather than incidental.

**Examples of `netStars`:**

| Previous best | New result | `dailyStars` delta |
|---|---|---|
| 1★ | 3★ | +2 |
| 3★ | 3★ | 0 |
| none (new exercise) | 2★ | +2 |

This makes Great Focus Session measure real progress, not repetition, and it
composes with `shouldFreezeScoring` (`session-quota.ts:124`), which already
voids replay scoring once the session is over.

## The ladder

| Milestone | Condition | Window |
|---|---|---|
| **First Reward** (gift) | `lifetimeStars >= 4` AND `completedExercises >= 2` | Cumulative |
| **First Labyrinth** | `pieceStars(piece) >= 6` AND `completedExercises(piece) >= 3` | Cumulative, per piece |
| **Piece Badge eligible** | `pieceStars(piece) >= 10` | Cumulative, per piece |
| **Piece Badge claimed** | Claim transaction confirmed on-chain | Cumulative, per piece |
| **Special Training** | `pieceStars(rook) >= 12` | Cumulative |
| **Mastery** | Piece Badge **claimed** AND all labyrinths of that piece complete | Cumulative, per piece |
| **Great Focus Session** | `dailyStars >= 8` OR session quota exhausted | **Daily, repeatable** |
| **First Great Session** | First time Great Focus Session fires | Once, ever |

Outside the ladder:

| Rule | Condition |
|---|---|
| **Session Limit** | 10 activities consumed (`SESSION_EXERCISE_LIMIT`) |

### Why the gift is cumulative, not daily

A daily threshold silently strands players. Someone who earns 3★ on Monday and
1★ on Tuesday never reaches "4★ in a day" — the counter resets at UTC midnight
and the gift is unreachable forever. The gift is a once-ever onboarding event,
so it reads a once-ever counter.

### Why the compound conditions

A pure star threshold reintroduces the defect it was meant to fix: a player who
opens with a perfect 3★ solve would take the gift on interaction one. The
`completedExercises` floor guarantees the arc exists before the reward lands.

Worked example, perfect player (3★ every solve):

```
Exercise 1 → 3★  (lifetime 3★, 1 done)  → nothing
Exercise 2 → 3★  (lifetime 6★, 2 done)  → First Reward   (4★ ✓, 2 done ✓)
Exercise 3 → 3★  (piece 9★,   3 done)   → First Labyrinth (6★ ✓, 3 done ✓)
```

Without the exercise floor on the labyrinth, the gift and the labyrinth would
both fire on exercise 2 and neither would feel earned.

Worked example, struggling player (1★ every solve):

```
Exercises 1-4 → First Reward   (4★ ✓, 4 done ✓)
Exercises 5-6 → First Labyrinth (6★ ✓, 6 done ✓)
```

### The 10★ / 12★ anomaly

Piece Badge unlocks at 10★; Special Training at 12★. This is **deliberate**:
Special Training is post-badge content, a coordination test that follows the
proof of single-piece competence. It is recorded here so the gap is not
"corrected" by a future reader, and it must be covered by a test asserting the
ordering.

This spec does **not** raise Special Training to a "Rook + King" requirement.
All six pieces have exercises in the catalog, so a compound requirement is
buildable later; v1 keeps the existing `rookStars >= 12` gate and adds only the
missing moment.

## Great Focus Session and the session limit

```
greatSession = dailyStars >= 8 OR sessionQuotaExhausted
```

The `OR` is a floor, not a convenience. Without it, the weakest player — the one
who fails, retries, and burns all 10 activity slots with only 7★ — receives the
paywall *instead of* the celebration. That inverts the intent. If the quota runs
out and the session was never recognized, it is recognized then.

Evaluation order after every solved activity:

```text
1. Record the activity (stars, bests, consumed slot)
2. Evaluate every milestone condition
3. PERSIST every fired event + its idempotency key
4. Build and drain the celebration queue
5. Render
6. Return the player to the experience
7. Only then, on the next attempt to start an activity, evaluate the session limit
```

**Persistence precedes rendering, never follows it.** If the app is killed while
an overlay is on screen, the event must already be on disk — otherwise it is
either lost or ambiguously re-derived on the next launch. Showing a celebration
is a consequence of having recorded it, not the other way round. Marking
`celebratedAt` is a second, separate write once the overlay has actually been
shown.

The celebration and the limit are never two consecutive modals. The player
returns to the board in between; the wall appears when they reach for the next
activity.

## Two layers of "day"

The naming collision is resolved by keeping the two behaviors separate.

| System | Measures | Condition | Grants |
|---|---|---|---|
| **Daily Focus** | Continuity — did they show up? | 1 Daily Focus solved | Stamps the Focus Passport, advances the streak, grants `first-focus-day` |
| **Great Focus Session** | Depth — was the session substantial? | `dailyStars >= 8` OR quota exhausted | Session celebration, grants `first-great-session` |

Great Focus Session is **not** required to keep the streak. Requiring 8★ daily
to hold a streak — with streak recovery permanently off the table — converts a
motivating mechanic into an abandonment driver.

### `first-focus-day` is kept, not renamed

Once the gift is unbundled from it, `first-focus-day` stops being wrong. It was
never an inaccurate badge; it was a badly packaged one. It keeps its id, its
condition (`totalCompleted >= 1`, `achievements/lite.ts:11`), and its art
(`/art/achievements/1day-focus`).

`first-great-session` is a **new, fourth** Lite achievement. Renaming
`first-focus-day` instead would force a re-derivation from a counter existing
players do not have, silently revoking a badge they already earned.

## The unlock machine

One state shape for every milestone. Conditions are pure derivations from
already-persisted progress; only acknowledgement is new state.

```ts
export type MilestoneId =
  | "first-reward"
  | "first-labyrinth"
  | "special-training"
  | "piece-badge-eligible"
  | "piece-badge-claimed"
  | "mastery"
  | "great-focus-session"
  | "first-great-session";

export type MilestoneEvent = {
  id: MilestoneId;
  /** Scopes per-piece milestones. Absent for global ones. */
  piece?: PieceId;
  /** ISO timestamp the condition first became true. */
  earnedAt: string;
  /** Set when the celebration overlay has been shown. */
  celebratedAt?: string;
  /** Set when the player first opens the unlocked content. Clears the NEW
   *  dot. Present ONLY on navigable milestones — `first-reward`,
   *  `first-labyrinth`, `special-training`. A Great Focus Session, a claimed
   *  badge and a mastery crown have no destination to open, so `openedAt` is
   *  meaningless for them and must never be written. */
  openedAt?: string;
};
```

### Eligible is not claimed

At 10★ the player earns **the right to claim**. The badge does not exist
on-chain until a transaction confirms. Collapsing both into one milestone makes
the machine lie about wallet state, so they are two events:

| Event | Meaning | Navigable |
|---|---|---|
| `piece-badge-eligible` | 10★ reached. Opens the claim flow. | No |
| `piece-badge-claimed` | Transaction confirmed. The badge exists. | No |

`mastery` depends on **`piece-badge-claimed`**, never on eligibility — the crown
cannot rest on a badge that was never minted.

This also makes cancellation precise: **cancelling a claim preserves
eligibility** and releases any absorbed recognition. The player keeps the right
to claim, keeps the Great Focus Session, and loses nothing but the transaction.

**Idempotence key:** `${id}` for global milestones, `${id}:${piece}` for
per-piece ones. A milestone is celebrated exactly once. Re-deriving a condition
that is already `celebrated` is a no-op.

**Persistence:** localStorage, alongside the existing progress stores. Survives
app close — a reward earned but not claimed is still waiting on return, and a
celebration already consumed never replays.

**Daily milestones:** `great-focus-session` is keyed by UTC date and resets with
it. `first-great-session` never resets.

### Celebration queue

This is **not** an absolute "always show everything" order. It is a priority for
events that fire in the **same resolution**. Most solves fire nothing.

Three rules govern a drain:

1. **Incremental unlocks first.**
2. **The highest-hierarchy event closes.**
3. **Never two major celebrations back to back.**

**Phase 1 — incremental unlocks.** Each gets its own overlay, in this order,
because each carries a CTA to different content. None of them concludes
anything; they all invite action.

```
first-reward → first-labyrinth → special-training
```

Special Training gates at 12★, past the 10★ badge, so when it collides with a
closer the intensity escalates naturally: "a new mode is open" → "and you
mastered the rook."

**Phase 2 — exactly one closer.** The highest tier that fired renders. Every
lower-tier major that also fired is **absorbed as a line inside it**, never as a
second modal.

```text
mastery  >  piece-badge-eligible  >  great-focus-session
```

Showing `MASTERY!` and then `GREAT FOCUS SESSION!` drops the intensity after the
climax. The closer swallows the rest:

> **Rook Mastered**
> Every exercise, every labyrinth.
> Great Focus Session recognized.
> **Badge unlocked: First Great Session**

`first-great-session` persists as an independent achievement but always renders
as a line inside whichever closer contains the Great Focus Session — never on
its own.

In practice, `mastery` and `first-great-session` colliding is near-impossible:
mastery requires a claimed badge and every labyrinth, so a first great session
would have happened long before. The rule holds anyway.

### The closer can be a transaction, and it can be cancelled

`piece-badge-eligible` is **not an overlay — it opens an interactive on-chain
claim flow** (signature + transaction). If it absorbs a Great Focus Session and
the player cancels or defers the claim, an earned recognition would vanish with
the cancelled transaction.

Contract: **an absorbed event is already persisted before the claim flow opens**
(step 3 of the evaluation order). If the claim is cancelled, deferred, or fails:

- `piece-badge-eligible` **survives** — the player keeps the right to claim.
- `piece-badge-claimed` never fires — nothing was minted.
- The absorbed Great Focus Session is **released to its own overlay**.

Recognition is never contingent on signing a transaction. This mirrors the
existing victory-claim cancellation behavior (#206), where cancelling is a no-op
rather than a loss.

### Overlay contract

Every unlock overlay uses the existing correct-exercise celebration shell, with
the earned artifact replacing the wolf as the central icon.

| Field | Value |
|---|---|
| Icon | The artifact earned (gift, labyrinth, training shield, badge, crown) |
| Title | What was unlocked, ≤ 5 words |
| Body | One line, what it is for |
| Primary CTA | Enter the content |
| Secondary CTA | "Later" — dismisses, sets the NEW dot |

Special Training example:

> **Special Training Unlocked**
> Coordinate the Rook and the King.
> `Start Training` / `Later`

### NEW indicator

The static `HubTileStatusChip kind="ready"` on the Special Training tile
(`hub-arena-tile.tsx:53`) is replaced by a NEW chip driven by
`openedAt === undefined`. Set when the unlock persists; cleared the first time
the player opens the content. The same rule governs the gift indicator.

`openedAt` only exists on the three **navigable** milestones — `first-reward`,
`first-labyrinth`, `special-training`. There is nothing to "open" about a Great
Focus Session, a claimed badge or a mastery crown; they are recognitions, not
destinations. Writing `openedAt` on them would be inventing a state with no
meaning.

## Special Training combinations (model only)

The schema is defined now; only `rook-king` ships.

| Combination | Requirement | Status |
|---|---|---|
| Rook & King Coordination | `rookStars >= 12` | **v1 — ships** |
| Queen & King Coordination | TBD | Model only |
| Bishop & King Coordination | TBD | Model only |
| Rook Battery | TBD | Model only |
| Knight Defense | TBD | Model only |

Each entry carries: explicit requirement, locked state, unlock event, overlay
copy, NEW indicator, entry content, completion condition. No further combination
is authored in this cluster.

## What changes in code

| File | Change |
|---|---|
| `daily-tactic-slot.tsx:113` | Unbundle. `first-focus-day` stays; `welcomePackage.unlock()` moves to the milestone machine. |
| `hub-daily-tile.tsx:155` | Same unbundling. |
| `lib/welcome-package/use-welcome-package.ts:38` | Retroactive init (`totalCompleted >= 1`) is replaced by the `first-reward` condition. |
| `lib/training/path.ts:66` | `LABYRINTH_UNLOCK_THRESHOLD` gains the `completedExercises >= 3` companion condition. |
| `hub-arena-tile.tsx:53` | Static `ready` chip → NEW chip driven by `opened`. |
| `lib/achievements/lite.ts` | Add `first-great-session`. Three achievements become four. |
| New: `lib/progression/milestones.ts` | Pure condition derivation. No IO, no React. |
| New: `lib/progression/milestone-storage.ts` | Persistence + idempotence. |
| New: `lib/progression/use-celebration-queue.ts` | Ordered drain. |
| New: `components/progression/unlock-overlay.tsx` | Shared overlay shell. |

Untouched: the on-chain Piece Badge (soulbound, already minted on mainnet) and
the Mastery node in `path.ts`. Their semantics are correct; future growth builds
on top of them, never by reinterpreting a badge already in players' wallets.

## Migration

Existing players must not regress.

| Case | Behavior |
|---|---|
| Already claimed the gift | `first-reward` seeds with `celebratedAt` and `openedAt` set. No replay. |
| Gift unlocked, unclaimed | `first-reward` seeds with `celebratedAt` set, `openedAt` unset. NEW dot persists; no surprise overlay. |
| Already earned `first-focus-day` | Untouched. Keeps the badge. |
| Already past 12★ rook | `special-training` seeds with `celebratedAt` and `openedAt` set. The tile stays visible, no retroactive overlay. |
| Already past 10★, badge unclaimed | `piece-badge-eligible` seeds with `celebratedAt` set. Claim stays available, no overlay. |
| Already claimed a Piece Badge | Both `piece-badge-eligible` and `piece-badge-claimed` seed with `celebratedAt` set. |

The rule: **no retroactive celebration fires for a milestone a player already
passed.** Seeding suppresses the overlay while preserving the state.

## Test matrix

| Scenario | Expected |
|---|---|
| 1 perfect exercise (3★) | No gift. Floor of 2 exercises not met. |
| 2 exercises, 4★ total | Gift fires. |
| 1★ × 4 exercises | Gift fires on the fourth. |
| 3★ on Monday, 1★ on Tuesday | Gift fires Tuesday (cumulative, not daily). |
| 6★ piece, 2 exercises | No labyrinth. Floor of 3 not met. |
| 6★ piece, 3 exercises | Labyrinth unlocks. |
| Replay a 3★ exercise at 3★ | `dailyStars` += 0. |
| Replay a 1★ exercise at 3★ | `dailyStars` += 2. |
| 8★ earned today | Great Focus Session fires. |
| Quota exhausted at 7★ | Great Focus Session fires anyway (floor). |
| First Great Focus Session | `first-great-session` granted, rendered inside the same overlay. |
| Second Great Focus Session | Celebration fires, `first-great-session` does not re-grant. |
| Session limit reached | Never shown before a pending recognition drains. |
| Gift + labyrinth same solve | Gift overlay first, then labyrinth. Never stacked. |
| Badge eligible + Great Session same solve | One closer: the claim flow, Great Session absorbed as a line. |
| Mastery + Great Session same solve | One closer: Mastery. Great Session absorbed, no second overlay. |
| Special Training + Mastery same solve | Special Training overlay (incremental) first, Mastery closes. |
| Badge claim **cancelled** with Great Session absorbed | `piece-badge-eligible` survives, `piece-badge-claimed` never fires, Great Session released to its own overlay. |
| 10★ reached, claim never made | `piece-badge-eligible` persists. `mastery` stays locked even with every labyrinth done. |
| App killed while an overlay is on screen | The event is already persisted. It does not replay and is not lost. |
| Two majors in one drain | Exactly one overlay renders. Never two back to back. |
| Close app before claiming | Reward persists, still claimable on return. |
| Reopen app after celebrating | Celebration does not replay. |
| Existing player past every gate | No retroactive overlays. |
| 12★ rook | Special Training overlay, then NEW chip until opened. |
| Open Special Training | NEW chip clears. |

## Open questions

1. **Special Training copy** says "Coordinate the Rook and the King" while the
   gate is rook-only. Accepted for v1; revisit if the requirement becomes
   compound.
2. **Analytics.** Each milestone should emit an event. Naming not specified here.
3. **`dailyStars` display.** Whether to surface "6/8 Focus" in the HUD is a
   separate design call. The counter exists either way.

---

Wolfcito 🐾 @akawolfcito
