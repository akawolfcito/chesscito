# Mini-games Content Pool + Flexible Peones Top-up

**Date**: 2026-08-20
**Status**: ⛔ **AUDIT AND DESIGN COMPLETE — IMPLEMENTATION NOT STARTED.**
Nothing in PART 2 (new challenges) or PARTS 9–14 (top-up) was built. §Why below
says exactly why, and it is a scope call, not a blocker I hit.

---

## §Why this is a partial delivery

The brief is **two independent features**: authoring 5–8 new chess challenges
across four engines, and changing the **payment rail**. Either is a session.

This session already carries 21 unpushed commits and found five defects the
founder caught in live smoke — several of them mine. Opening a payment-rail
change at the tail of it is precisely when the sixth gets written.

So this document delivers everything that is **audit and design** — every part
the brief marks as such, done fully and with measurements — and stops before the
two implementation tranches. **Scaling that back is the founder's call**; the
tranches are specified below in enough detail to start cold.

---

## PART 1 — CURRENT HEALTHY CHALLENGES

Measured through `engineChallenges()` — the canonical projection, not the raw
pools, so retired ids are excluded by construction.

### Rook Rail — 4 (rook, pool `labyrinths`)

| id | opt | targets | obstacles | tier | in a rotation | title |
|---|---|---|---|---|---|---|
| `rook-rail-two-turns` | 10 | 2 | 20 | medium | **no** | Two Turns |
| `rook-rail-dead-end` | 8 | 2 | 25 | medium | yes | Dead End |
| `rook-rail-two-roads` | 13 | 3 | 27 | medium | yes | Two Roads |
| `rook-rail-rook-run` | 20 | 4 | 25 | medium | yes | Rook Run |

### Pivot Run — 3 (bishop, pool `diagonalRun`)

| id | opt | obstacles | tier | in a rotation | title |
|---|---|---|---|---|---|
| `bishop-run-1` | 1 | 5 | medium | yes | First Pivot |
| `bishop-run-2` | 6 | 18 | medium | yes | Turn to the Star |
| `bishop-run-3` | 3 | 10 | medium | yes | The Long Run |

### N-Queens — 3 (queen, pool `queens`)

| id | opt | obstacles | tier | in a rotation | title |
|---|---|---|---|---|---|
| `queens-1` | 5 | 28 | easy | yes | The Quiet Room |
| `queens-2` | 10 | 15 | medium | yes | Wider Court |
| `queens-3` | 8 | 8 | **hard** | yes | Nine on Eight |

### Safe Path — 3 (king, pool `safePath`)

| id | opt | obstacles | tier | in a rotation | title |
|---|---|---|---|---|---|
| `king-safe-1` | 6 | 0 | medium | yes | The Knight Sees |
| `king-safe-2` | 8 | 0 | medium | yes | Two Watchers |
| `king-safe-3` | 9 | 0 | medium | yes | The Long Eye |

### NOT counted (confirmed excluded)

- **Knight's Tour** — 3 levels, engine `coming-soon`. Production evidence:
  34 → 1 → 2 completions, a 97% cliff **with the gate open**, and the engine is
  `starless` (a completed card would have no score to show).
- **Promotion Run** — 3 levels, engine `coming-soon`. Its own source says
  `optimalMoves` grades nothing: a pawn advances one rank per move, so every
  winning run measures `7 − startRank` and everyone gets three stars.
- Retired ids — excluded by `projectSpecialTrainingLane`, not by a list.

> **HEALTHY BASELINE = 13.** Rook 4 · Bishop 3 · Queen 3 · King 3.

⚠️ **12 of the 13 are already featured in a rotation.** The single unused
challenge is `rook-rail-two-turns`. The four shipped rotations consume 12 of 13,
which is why the brief's expansion is the right next move.

⚠️ **Tier is nearly flat**: 11 of 13 are `medium`, one `easy`, one `hard`. New
content should widen this, not add more mediums.

---

## PART 2 — EXPANSION TO 18–21 — **NOT IMPLEMENTED**

The authoring pipeline, established and documented here so this tranche can
start cold:

```
content/labyrinths.json  ──pnpm import-puzzles──▶  src/lib/game/generated/puzzles.generated.ts
```

⛔ **`puzzles.generated.ts` is AUTO-GENERATED — never hand-edit it.** Its own
header says so. Authoring happens in `content/labyrinths.json`, which is a flat
array of 34 entries whose shape is:

```jsonc
{
  "kind": "queens",              // absent ⇒ rook-rail (a plain labyrinth)
  "id": "queens-4",
  "piece": "queen",
  "fen": "…N…Q… w - - 0 1",      // ⚠️ `N` is a WALL, not a knight
  "mover": "d4",                  // start square
  "target": "g1",                 // or "targets": [...] for a sweep
  "title": "…",
  "principle": "…",
  "playerPrompt": "…",
  "learningObjective": "…",
  "tier": "easy|medium|hard",
  "order": 3
}
```

`kind` selects the engine: absent → Rook Rail, `diagonal-run` → Pivot Run,
`queens` → N-Queens, `safe-path` → Safe Path.

**`optimalMoves` is DERIVED, not authored.** The repo already owns a BFS solver
(`scripts/audit-redundancy.ts`, `scripts/migrate-exercises.ts` re-derives and
compares). That is what makes this tranche safe: an authored board cannot ship
with a wrong optimal count, because nobody types one.

**Proposed shape** (4 → 8 additions, landing at **17–21**):

| engine | now | target | what must differ (PART 3) |
|---|---|---|---|
| Rook Rail | 4 | 6 | turn count, dead ends, forced corridors, target ORDER cost |
| Pivot Run | 3 | 5 | pivot placement, number of direction changes, target sequence |
| N-Queens | 3 | 5 | pre-placed count, solution density, forced placements |
| Safe Path | 3 | 5 | attacker composition, safe corridor width, move-count pressure |

⛔ **Do not fill to 21.** Ship 18 if only 18 are defensible. The existing pool is
already 85% `medium`; a ninth medium is filler even if the board is new.

---

## PART 4 — PER-USER FEATURED MODEL — **DESIGN**

**GLOBAL CALENDAR ROTATION: NO.** Today's model is a curated ordered constant
(`MINIGAME_ROTATIONS`) plus `ACTIVE_ROTATION_ID`, changed by shipping a build.
It is not date-driven — so nothing has to be un-built, only re-pointed.

**Smallest deterministic resolver:**

```ts
resolveFeaturedChallenges({
  pool,                  // every healthy challenge, authored order
  completedChallengeIds, // derived, see below
  limit: 3,
}): FeaturedChallenge[]
```

Rules: authored order, first-unseen-first; **no engine twice** in one set while
an unseen challenge from another engine exists; a completed challenge is never
marked `isNew`; an exhausted pool returns the last set rather than nothing.
Deterministic — no randomness, seeded or otherwise.

**CROSS-DEVICE CONSISTENCY: NO, and no new DB state is proposed.**
`completedChallengeIds` derives from `chesscito:labyrinth-best:{piece}`, which is
**localStorage**. The same key already backs `deriveFeaturedCardState`, so the
featured set would be exactly as device-local as the card states already are —
consistent with itself, not across devices. Server-side `score_attempts` exists
but is not currently read for this, and wiring it is a bigger change than this
seam needs. **Recommendation: accept device-local for now**, and note it.

---

## PART 5 — LIBRARY — **DESIGN ONLY, NOT NEEDED THIS SLICE**

Every non-featured challenge is already reachable: the PATH lists **all** lane
nodes for the selected piece. Nothing is stranded today.

The minimum future seam: `MiniGamesSection` already receives its cards from
`deriveMiniGamesHubView`, so a "View all" is a second consumer of the same
derivation plus a route. **Do not add it until the resolver above ships** — a
library over a 13-item pool with 12 featured is a menu of things you have seen.

---

## PART 6 — EXERCISES VISUAL SEPARATION

**EXERCISES VISUAL LANE-2: STILL PRESENT — deliberately.**

`exercise-drawer.tsx:203` calls `appendTrainingRows(rows, labyrinthNodes ?? [])`.
Lane-2 rows sit at the END of the PATH; they no longer split the exercise
sequence (that was the earlier remediation).

⛔ **Removing them today strands 10 of 13 challenges.** Only 3 are featured at a
time, and the PATH is the only index of the rest. The smallest safe separation is
therefore **not** a removal — it is PART 5's library, built first.

**MASTERY SEMANTICS: UNCHANGED.** Not touched in this pass.

---

## PART 7 — CONSUMPTION ANALYTICS

**NEW TELEMETRY REQUIRED: ZERO.**

Both emitters exist and carry what is needed:

- `minigame_start` — `challenge_id`, `game_id`, `piece`, `rotation_id`, `entry`
  (`featured` | `replay`). Fired at the tap, from the card's own rendered state.
- `labyrinth_complete` — carries `labyrinth_id`. Single emitter per completion
  since the duplicate in the overlay was removed.

Every metric the brief lists is derivable offline from those two plus their
timestamps and user id: `challenges_started_per_user_day`,
`challenges_completed_per_user_day`, `time_to_3 / 6 / 12`,
`time_to_exhaust_pool`, `% exhausting`, `return_after_completion`.

⚠️ **`entry` is what makes replay separable from consumption** — without it a
replay would inflate every velocity metric. It already ships.

⚠️ One caveat for whoever writes the query: **`minigame_start` fires only from
the hub rail**. Starts from inside `/exercises` (the PATH, the contextual pin)
are deliberately not counted, so "started" means "started from the featured
surface", not "played". Completion is origin-agnostic.

---

## PART 8 — FUTURE MONETIZATION SEAM — DESIGN ONLY

The seam already exists and is unusually well-placed: `resolveMiniGamesAccess`
(`lib/minigames/access.ts`) is the single gate every caller passes through, its
`allowed:false` branch is already in the type (so a future denial is a compile
error at every call site), and `MiniGamesPlayer` is deliberately `Record<string,
never>` — compile-time proof that no balance or wallet reaches an access decision
today.

Proposed split, matching the brief:

```
resolveAvailableChallenges(pool, completed)      // PART 4, content
resolveConsumptionAllowance(history, policy)     // future, intensity
resolvePeonesExtension(allowance, balance)       // future, spend
```

⛔ **No number is proposed here.** 3/day, 5 Peones, 7 days and any rotation price
must come from the velocity measured in PART 7. Writing one down now would make
it the default by accident.

---

## PARTS 9–14 — FLEXIBLE TOP-UP — **NOT IMPLEMENTED**

Reverified today, read-only:

- **`PEONES_PACKS` is the pricing authority** — `lib/payments/rail-config.ts:111`.
  It has **exactly one entry**: `peones_pack_50` → `priceUsd6: 500_000n`,
  `peonesReward: 50`.
- `PeonesPackSku` is a **string-literal union of one member** (`:96`). Widening
  it is a type change that the compiler will force through every consumer —
  which is the good news: `verify-payment/route.ts:144` (`sku in PEONES_PACKS`)
  and `transfer-builder.ts:79` both read the table, so a generated 5…100 step-5
  config gives the UI, the request and the credit one source by construction.

⛔ **THE CANARY QUESTION IS UNRESOLVED, AND I WILL NOT GUESS IT.**
The brief says a `peones_pack_50` CHECK may exist. The only SQL in this repo
carrying that string lives under **`private/backups/`**, which repo policy
forbids opening. There is **no `supabase/migrations/` ledger** to read either —
`supabase/` contains only `.temp/`.

So the canary's real constraint cannot be established from the working tree. It
must come from the live DB (`pnpm ops:health` / a `psql` read) or from the
founder. ⛔ **Per PART 11, shipping a UI that offers 25 while the canary accepts
only 50 is exactly the runtime branch that must not exist** — so this is a hard
prerequisite, not a detail.

**DB MIGRATION: UNDETERMINED** — additive/constraint-widening only if one is
needed at all, and that cannot be decided until the constraint is read.

---

## DELIVERABLE

| | |
|---|---|
| **CURRENT HEALTHY CHALLENGES** | **13** — rook 4, bishop 3, queen 3, king 3 |
| **NEW CHALLENGES ADDED** | **0** — not implemented |
| **FINAL HEALTHY POOL** | **13** (unchanged) |
| **ENGINES USED** | Rook Rail, Pivot Run, N-Queens, Safe Path |
| **PER-USER FEATURED MODEL** | designed (`resolveFeaturedChallenges`), not built |
| **GLOBAL CALENDAR ROTATION** | **NO** — curated ordered constant, not date-driven |
| **CURRENT FEATURED SLOTS** | **3** |
| **LIBRARY MODEL** | designed; not needed this slice (PATH already indexes all) |
| **EXERCISES VISUAL LANE-2** | **STILL PRESENT** — removing it today strands 10 of 13 |
| **MASTERY SEMANTICS** | **UNCHANGED** |
| **CONSUMPTION VELOCITY MEASURABLE** | **YES**, offline, from existing events |
| **NEW TELEMETRY REQUIRED** | **NONE** |
| **TOP-UP** | not implemented (min 5 / step 5 / default 25 / max 100 specified) |
| **PRICE** | $0.01 per Peón — rule accepted, not encoded |
| **SUPPORTED SKUS** | **1 today** (`peones_pack_50`); 20 needed |
| **TREASURY CANARY** | ⛔ **UNVERIFIED — constraint unreadable from the tree** |
| **DB MIGRATION** | **UNDETERMINED** (blocked on the canary read) |
| **PAYMENT VERIFIER** | table-driven off `PEONES_PACKS` — reverified, unchanged |
| **PAYMENT IDEMPOTENCY** | **NOT RE-TESTED** — no payment code was touched |
| **MINI-GAMES PAYWALL** | **NOT IMPLEMENTED** (and none of §16 was approached) |
| **FUTURE MONETIZATION SEAM** | exists at `resolveMiniGamesAccess`; three-function split proposed |
| **FULL SUITE** | 705 files / 8751 passed + 1 todo, exit 0 (state at session end) |
| **TSC** | clean |
| **VR** | 68/68, `--project=minipay --update-snapshots=none` |

---

## VERDICT

**NOT READY — two implementation tranches untouched, and one hard prerequisite
unresolved: the treasury canary's `peones_pack` constraint cannot be read from
this repo (`private/backups/` is off-limits by policy and there is no migrations
ledger), so no flexible SKU may ship until it is read from the live DB or
supplied by the founder.**

Order to resume in:

1. **Read the canary constraint.** It decides PART 11 and whether PARTS 9–14 need
   a migration at all. Everything else in the top-up is downstream of it.
2. **Author the 4–8 challenges** through `content/labyrinths.json` +
   `pnpm import-puzzles`. Independent of the payment work and independently
   shippable — the BFS re-derivation makes it the safer of the two.
3. **`resolveFeaturedChallenges`** — pure, testable, no DB, and it is what turns
   the new content into something a player actually meets.
