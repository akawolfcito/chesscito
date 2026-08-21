# Mini-games — Per-User Queue, Library, and Final Exercises Separation

**Date**: 2026-08-21
**Scope**: personal Featured queue + Library + Exercises separation. No new
challenge content, no paywall, no Peones spend, no daily limit, no top-up
change, no PRO, no P2P, no DB migration, no push, no deploy.

---

## PART 1 · Audit of the model being replaced

### What decided the three featured cards

`MINIGAME_ROTATIONS` — four hand-authored triples in `lib/minigames/rotation.ts`
— plus `ACTIVE_ROTATION_ID`, a single constant. **Everyone on the planet saw the
same three challenges**, and they only changed when someone edited that constant
and shipped a build.

`deriveMiniGamesHubView` read `getActiveRotation()`, resolved it through
`resolveRotation`, and derived per-card state. `isNew` came from
`carriedOverIds(rotationId)` — "was this in the PREVIOUS rotation" — which says
nothing about the player. A returning player who had cleared a level saw it
flagged **New** because the rotation had moved.

### What completion state exists

`chesscito:labyrinth-best:{piece}` → `{ [challengeId]: number }`. Written by
`recordLabyrinthBest` / `recordTourBest`, and — this is the load-bearing part —
**only from inside `if (!run.isComplete) return;`** (`exercises-screen.tsx:3776`).
A key exists ⟺ the player finished that challenge at least once. A replay
rewrites a key that is already there.

### Server-side

`score_attempts` receives an attempt row per run, best-effort. It is **not** a
completion ledger: it records attempts, not "cleared", and the client never
reads it back. There is no server completion table for mini-games.

### Device-local?

**Yes.** Card state, completion and now the queue are all derived from
localStorage. Clearing the browser resets what is featured.

### Is replay distinguishable from first consumption?

**Yes, and it already was** — `labyrinth_complete` carries
`previous_best: previousBest ?? null`, read *before* the write. `null` ⟺ first
completion. This is why PART 12 needed no new event.

---

## PART 2–4 · The resolver

`lib/minigames/queue.ts`, pure — no `Date`, no storage, no IO, no React. A test
reads the file (comments stripped) and fails if `Date.now`, `new Date`,
`ACTIVE_ROTATION_ID` or `MINIGAME_ROTATIONS` appear in the code.

```ts
resolveChallengePool(pools)                    // 13, canonical order
resolveConsumptionPolicy(player)               // the policy seam (PART 13)
resolveFeaturedChallenges({ pool, completedChallengeIds, limit })
resolveLibrary(pools, completedChallengeIds)
```

**Algorithm** — two greedy passes over the pool in canonical order:
1. take unseen challenges, at most one per engine;
2. if still short of the limit, take the remaining unseen in order.

Pass 2 keeps variety a *preference*, not a cap: when one engine is all that is
left, the set still fills instead of starving to one card. Because both passes
walk a fixed order and the only input is a **Set**, the output cannot depend on
the order completions arrived in, on the clock, or on how often a level was
replayed. **Replay is non-consuming by construction** — a set has no "again".

**Consumption unit**: one successful completion. Starting and abandoning writes
nothing, so it consumes nothing. This is exactly the existing labyrinth-best
semantics, reused rather than reinvented.

---

## PART 5 · Exhausted pool

When nothing is unseen, the queue returns the **first three completed
challenges as replays**, `unseen: false`, `exhausted: true`, and the section
renders its all-clear line.

⛔ It does **not** return an empty list. `MiniGamesSection` renders `null` on
zero cards, so an empty exhausted state would delete the whole Mini-games group
from the Learn Home — "you cleared everything" would look identical to
"mini-games were removed". A test pins the card count at exhaustion.

Copy: *"You cleared them all — Replay any of them from the library."* No
countdown, no date, no "more tomorrow". A test asserts the string matches no
time-promise pattern.

---

## PART 6–7 · Library and routing

New route **`/minigames`** (`components/hub/minigames-library.tsx`), grouped by
game, every healthy challenge listed, completed rows marked and still tappable.

It is a **route, not a sheet**, for one product reason: a Library completion must
*return* to the Library, and "return" needs an address. A sheet would leave
`?from=library` with nowhere to go but the home — the origin-collapsing the
brief forbids.

⛔ It instantiates **no engine**. Every row routes through the same
`/exercises` boundary and the same resolver Featured uses. Coming-soon engines
are **absent**, not greyed: a row that cannot be played is a dead end dressed as
content.

### The origin model

`?featured=<rotationId>` is gone. The param is now **`?from=featured|library`**,
and `exercise_path` is the fallback the URL may never assert.

| origin | bypasses progression lock | completion returns to |
|---|---|---|
| `featured` | yes (if healthy) | Learn Home `/` |
| `library` | yes (if healthy) | Library `/minigames` |
| `exercise_path` (default) | no | existing exercise-path continuation |

⛔ **The bypass is still EARNED, and its basis changed deliberately.** It used
to be membership in a curated rotation — only 3 ids. The Library must open all
13, so the bypass is now earned by the challenge being **healthy** (an
`early-access` engine) *and* the player arriving from a Mini-games surface. A
hand-typed `?from=featured` on a retired id, a lane-1 id or a coming-soon engine
still buys nothing: `resolveChallenge` and the engine status decide.

The screen adopts a Mini-games source **only when the route already granted the
bypass**, so trust never moves into the query string.

Copy is per surface *family* (a Library mini-game is still a mini-game, so it
gets the mini-game wording); the *destination* is decided separately. Two
questions, kept apart.

---

## PART 8 · Exercises separation

`showLanePathRows` on `ExercisesScreen`, defaulting to `!CHESSCITO_LITE_MODE`.

```
exercise → exercise → … → badge → mastery      (LEARN)
```

⛔ **Presentation only.** `buildTrainingPath` was not touched. Every unlock,
star, completion count, stored best, the badge chain and the mastery node
compute from exactly the same input. Proven in
`lib/training/__tests__/exercises-lane-separation.test.ts`: removing the lane
*entirely* does not move a single exercise's status, so hiding the rows cannot.

⚠️ **Gated on LEARN, and not out of caution.** `MiniGamesSlot` is mounted only
by `learn-hub-client.tsx`. PLAY has no Mini-games surface at all, so dropping
the rows there would leave lane-2 with **no index anywhere** — orphaning content
instead of relocating it. PLAY keeps its rows.

### Two consequences worth naming

1. **The contextual "Enter Labyrinth" pin was kept.** The brief targets path
   *rows*; the pin is a separate CTA and removing it costs the last in-screen
   exercise-path entry. **Flagged for your call**, not decided unilaterally.
2. **The Season-Pass unlock CTA for lane content lives on a locked lane row**
   (`exercise-drawer.tsx:477`). With no rows in LEARN, a pass-gated mini-game
   would be listed in the Library, refused on tap, and offer nothing — a silent
   dead end. **It cannot happen today**: no healthy challenge carries an
   `access` entitlement, and `lib/minigames/__tests__/entitlement-free.test.ts`
   is the tripwire that turns the suite red the day one does. The fix then is to
   give the Library row the CTA, **not** to re-add lane rows to the path.

---

## PART 9 · Mastery

Unchanged. No threshold moved, no qualification rule changed. The UX
consequence stands and is now visible rather than hidden: **a player can finish
lane-1 Exercises while mini-game practice is incomplete.** No Exercises copy
implies the Library is an exercise row — the word "Mini-games" does not appear
on the Exercises path at all.

---

## PART 10 · Card naming

The tile plate used to read **"Rook Rail"** — the *engine* — while the tile
opened **one level** of it. A player who had just cleared "Two Roads" came back
to a tile still labelled "Rook Rail" and could not tell whether it was the same
thing.

Now: **plate = challenge title**, engine second in the accessible name
(`"Two Roads — Rook Rail — Play"`), engine still on `data-engine`. In the
Library, where a list row has room, the hierarchy is spatial: the challenge is
the line you read, the game is the group it sits under.

⚠️ **Titles are authored content and vary in length** ("Two Roads" vs "Turn to
the Star"). `.hub-minigames-tiles .reward-tile-label` clamps to two lines with
an ellipsis, so the approved 50px rail geometry is held by CSS rather than by
hoping content stays short. The `/dev/learn-hub` VR fixture now carries a
deliberately long title so a photo covers the clamp.

---

## PART 11 · Progress signal

One pill under the featured tiles: **`4/13 completed`**, with
`aria-label="4 of 13 mini-games completed"`. Derived from the same completion
set the queue reads. No stars, no per-engine breakdown, no streak, **no new
telemetry**.

---

## PART 12 · Analytics — no new events

Both existing events already carry everything.

```
minigame_start      challenge_id, game_id, piece, entry ∈ {featured, replay, library}
labyrinth_complete  labyrinth_id, piece, moves, optimal, stars,
                    is_new_best, previous_best
```

**`previous_best IS NULL` ⟺ first-time completion.** That single field is the
replay discriminator, and it was already being sent.

| metric | query |
|---|---|
| distinct challenges started / account / day | `count(distinct challenge_id)` over `minigame_start` |
| distinct challenges completed / account / day | `count(distinct labyrinth_id)` over `labyrinth_complete` |
| first-time completions per session | `labyrinth_complete where previous_best is null`, grouped by session |
| time to 3 / 6 / 12 | `min(ts)` of the 3rd/6th/12th *distinct* `labyrinth_id` with `previous_best is null`, minus the account's first `minigame_start` |
| time to exhaustion | same, at the 13th |
| % completing ≥1/≥3/≥6/≥12/all | histogram of distinct first-time completions per account |
| return after 3+ | accounts with a `minigame_start` dated after their 3rd first-time completion |
| replay rate | `previous_best is not null` ÷ all `labyrinth_complete` |

⛔ **Replay is never counted as consumption**: every consumption metric filters
`previous_best is null`.

⚠️ **One honest caveat**: `previous_best` is read from localStorage, so a
reinstall or a cleared browser makes a replay look like a first completion.
Same limitation as the queue itself (below); it inflates "first-time" slightly
and cannot be fixed without server completion evidence.

`minigames_open` lost `rotation_id` — there is no rotation — and gained
`completed` / `pool_size` / `exhausted`, which is what makes a usage read
comparable across a personal queue. Same event, same ~1/session volume.

---

## PART 13 · Future paywall seam — DESIGN ONLY

```ts
resolveChallengePool(...)        // what content exists
resolveFeaturedChallenges(...)   // takes its limit FROM the policy
resolveConsumptionPolicy(...)    // { policy, featuredLimit, unrestricted }
```

The resolver reads `policy.featuredLimit` rather than the constant, so an
allowance ("your free 6 are used") plugs in by widening the policy's return type
and its one caller — never by rewriting the resolver.

⛔ Nothing encodes 3/day, 5 Peones, a 24h reset or a weekly limit. A test
asserts the policy object has **exactly** three keys, so adding one is a
deliberate, reviewable change. `resolveMiniGamesAccess` remains the separate
ALLOWED/DENIED gate; it lost its `rotation` argument, which it never read.

---

## PART 14 · Tests

| file | cases |
|---|---|
| `lib/minigames/__tests__/queue.test.ts` | 24 — R-1…R-9 + policy |
| `components/hub/__tests__/minigames-library.test.tsx` | 14 — L-1…L-5, R-8 |
| `lib/training/__tests__/exercises-lane-separation.test.ts` | 10 — E-2…E-5 |
| `lib/minigames/__tests__/hub-cards.test.ts` | rewritten onto the queue |
| `components/hub/__tests__/minigames-section.test.tsx` | 25 (9 new) — naming, Library entry, progress, exhaustion |
| `lib/minigames/__tests__/entitlement-free.test.ts` | the pass-gate tripwire |

**E-1** ("no lane-2 rows visually rendered") is asserted at the surface, in
`restore-completed-content.test.tsx` → *"draws no lane row on the path"*, which
mounts the real screen in LEARN.

⚠️ **No test pins an authored title or a hand-written id list.** Expectations
are derived from the pool, so renaming a level in the builder cannot turn the
suite red for a content reason.

### What was deleted, and why

`lib/minigames/rotation.ts` and its test are **gone**. Once the queue landed,
the module's only remaining export in use was a type. Leaving 215 lines of dead
global-rotation constants — with a suite still proving they work — is an
invitation to re-wire them. `FeaturedChallenge` moved to `queue.ts`. This is
what makes **R-9** structural rather than aspirational: there is no rotation
constant left to determine anything.

### Tests changed on purpose

Seven files entered lane content by tapping a lane row in the path drawer. That
entry no longer exists in LEARN. They now ask for `showLanePathRows` explicitly
(they test assemblers, celebrations, quota and pass-gating — not the
separation), or enter through the Library. `restore-completed-content`'s
"finished node is on the path" assertion was **inverted**: the node is now
correctly absent, and the invariant it protected ("the player lands on the path,
not on a re-served labyrinth") is unchanged and still asserted.

---

## PART 16 · Verification

| check | result |
|---|---|
| `pnpm exec tsc --noEmit` | **clean** |
| full Vitest suite | **710 files · 8946 passed · 1 todo · exit 0** |
| file count vs. baseline | 707 → 710 (+4 new, −1 deleted) — no worker dropout |
| DB / migrations / `*.sql` diff | **empty** |
| VR | ⛔ **NOT RUN — and baselines are known-stale, see below** |

### ⛔ VR: not run, and this pass DOES change the photos

`scripts/preflight-disk.ts` refuses below 10 GB free; the machine sits at
10.00 GB even after dropping `.next`. The space is Chrome's (15 GB of cache),
not the repo's. You chose to leave it.

⚠️ **Unlike the flexible-top-up pass, this one is visually load-bearing.** The
`vr18-learn-hub-*` baselines are now **stale by design**: the mini-game tiles
print challenge titles instead of engine names, and a "View all · n/13" pill
was added under them. **Those baselines must be re-recorded — after opening the
`-actual.png` files and confirming the rail still holds at 390px.** Do not
`--update-snapshots` blind: the two-line label clamp is exactly the kind of
thing a blind re-record would bake in broken.

### Manual smoke — NOT run

Flows A–G need a LEARN dev server and a device. Not executed.

---

## DELIVERABLE

**HEALTHY POOL:** 13 (rook-rail 4, pivot-run 3, n-queens 3, safe-path 3)

**FEATURED SLOTS:** 3

**FEATURED MODEL:** **PER-USER**

**CONSUMPTION UNIT:** one successful completion of a challenge — a recorded
best in `chesscito:labyrinth-best:{piece}`, written only inside `run.isComplete`

**QUEUE ADVANCES ON:** a challenge entering the completed set for the first time

**REPLAY ADVANCES QUEUE:** **NO** — by construction; the queue's only input is a
Set of ids

**CROSS-DEVICE:** **NO** — device-local. `score_attempts` is an attempt log, not
a completion ledger, and reading it back would need a new API route, a fetch on
the Learn Home and a hydration pass. Deferred per the brief's own escape clause.
The grant-only merge, when it lands, goes in **one function**:
`completedChallengeIds()` in `hub-cards.ts` — `completed = local OR server`,
never a revocation.

**LIBRARY:** **IMPLEMENTED** — `/minigames`, grouped by game

**ALL HEALTHY CHALLENGES REACHABLE:** **YES** — all 13, asserted id-by-id

**LANE-2 VISIBLE IN EXERCISES:** **NO** in LEARN · **YES** in PLAY (which has no
Library entry; hiding there would orphan, not relocate)

**MASTERY SEMANTICS:** **UNCHANGED**

**FEATURED CARD NAMING:** challenge title primary, engine secondary
(`"Two Roads — Rook Rail — Play"`), with a two-line CSS clamp holding the rail

**NEW TELEMETRY:** **NONE.** `minigame_start` gained the value `library` on its
existing `entry` field; `minigames_open` swapped `rotation_id` for
`completed`/`pool_size`/`exhausted`. No new event family.

**MINI-GAMES PAYWALL:** **NOT IMPLEMENTED**

**FUTURE POLICY SEAM:** `resolveConsumptionPolicy` → `{ policy, featuredLimit,
unrestricted }`, consumed by `resolveFeaturedChallenges`; `resolveMiniGamesAccess`
stays the separate allow/deny gate. No count, price or window encoded.

**FULL SUITE:** 710 files · 8946 passed · 1 todo · exit 0

**TSC:** clean

**VR:** not run — disk floor; **and `vr18-learn-hub-*` baselines are stale by
design and must be re-recorded with the actual images inspected first**

---

## VERDICT

**NOT READY — the Learn Home VR baselines are stale by design and unverified.**

Everything the brief asked for is implemented, type-checked and covered: the
personal queue, the Library, the final Exercises separation, the naming fix, the
progress signal, the policy seam, and R-1…R-9 / L-1…L-5 / E-1…E-5. Mastery,
bests and the badge chain are provably untouched.

What blocks "ready" is not a defect — it is that **this pass changes what the
Learn Home looks like and no photo has confirmed it still holds at 390px.**
Featured tiles now print authored titles of varying length behind a two-line
clamp, and a new pill sits under the rail. That is precisely the class of change
the VR suite exists to catch, and the suite could not run.

**To clear it**: free disk, run
`playwright test visual-regression.spec.ts --project=minipay --update-snapshots=none`,
open the `vr18-*` `-actual.png` files, confirm the rail geometry, then
re-baseline. The manual smoke (Flows A–G) on a LEARN server closes the rest.
