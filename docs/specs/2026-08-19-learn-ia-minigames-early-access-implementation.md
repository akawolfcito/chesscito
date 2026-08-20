# Learn IA separation · Mini-games Early Access · Rotation — Implementation

**Date**: 2026-08-19
**Status**: IMPLEMENTED, not pushed
**Base**: `main` @ `9ff0434f`
**Source of truth for evidence**: `docs/specs/2026-08-19-learn-minigames-peones-economy.md`
**Scope shipped**: SLICE A · SLICE B · SLICE B.1 · SLICE B.2

---

## PART 1 — Red-team of the previous spec

### 1.1 What is now DEFERRED and was NOT built

Every section of the source spec that assumed a paid model is superseded. None of
it exists in this branch:

| Superseded section | Assumption | Status |
|---|---|---|
| §PART 6 EARLY ACCESS | "spend Peones to bypass the gate" | **DEFERRED** |
| §PART 7 | `PERMANENT_UNLOCK`, 5 Peones flat | **DEFERRED / no longer the preferred hypothesis** |
| §PART 8 | flexible top-up 5…100 | **NOT BUILT** |
| §PART 9 | contextual top-up | **NOT BUILT** |
| §PART 12 | `minigame_unlock` ledger source + migration | **NOT BUILT — no migration exists** |
| §PART 14 | `EARLY_UNLOCK_AVAILABLE`, `PROGRESSION_LOCKED` with a price | **REMOVED from the type** |
| §PART 15 | `minigame_unlock_prompt/_spent`, `topup_*` | **NOT BUILT** |
| §PART 17/18 | What's New, Weekly Top 3 | **NOT BUILT** |

Verified by grep over the diff: no `peones` import, no `spend`, no `rail-config`,
no `verify-payment`, no `supabase/migrations` change. `FeaturedCardState` has
three members and none of them can express a price.

### 1.2 Can A+B ship independently? — **Yes.** Audit of the twelve named functions

| function | touched? | finding |
|---|---|---|
| `interleaveTrainingRows` | **no** | kept + still tested. It had ONE presentation caller (`exercise-drawer.tsx:200`), now replaced. Its own docstring already scoped it: *"this orders rows, it never gates them."* |
| `buildTrainingPath` | **no** | untouched. Still returns exercise + labyrinth + badge + mastery nodes with identical statuses. Pinned by a new test that rebuilds the path around a reorder and asserts deep equality. |
| `selectPrimaryPiece` | **no** | untouched. ⚠️ It walks `PLAYABLE_PIECES` (R B N P Q K) while `deriveRewardTiles` walks `REWARD_TILE_ORDER` (R B Q N P K). The two orders **disagree** — pre-existing, harmless today, and the Mini-games surface deliberately derives its order from neither (it uses the rotation). |
| `deriveRewardTiles` | **no** | untouched. |
| `meetsFirstLabGate` | **no** | untouched. Still `totalStars ≥ 6 AND completedExercises ≥ 3`. |
| `isPieceUnlocked` | **no** | untouched. The badge chain (previous piece claimed **on-chain**) still gates the `/exercises` piece switcher — invariant 1. The Mini-games surface simply never calls it. |
| `nextPendingLabyrinthAfterExercise` | **no** | kept + tested, now **unwired**. |
| `getLabyrinthForAutoAdvance` | **no** | kept + tested, now **unwired** (see PART 4). |
| `resolvePostLabContinue` | **no** | untouched and still wired — it decides what happens AFTER a mini-game, which is not the interleave. |
| `requestTrainingContent` | **yes, additively** | one new branch: `source === "featured"` skips the progression lock. Everything else byte-identical. |
| `pieceForContent` | **replaced** | it searched the Knight's Tour pool alone. Now `resolveMiniGameDeepLink` over every projected lane (PART 11). |
| `projectSpecialTrainingLane` | **no** | untouched, and it is now the single authority for "is this a real challenge?" — retired ids fall out of it for free. |

**Does separating presentation change progression semantics?** No, and it is
pinned rather than argued: `interleave.test.ts` builds a path, reorders its rows,
rebuilds, and asserts the two paths are deeply equal, with badge and mastery
nodes present.

### 1.3 ⛔ One PRE-EXISTING defect found while doing this — reported, not fixed

A plain `?content=<id>` deep link to a lane level that **is** available can be
dropped when the player has stored progress:

`useExerciseProgress` hydrates from `localStorage` in an effect, so the restore
effect's first run sees an empty progress map → `meetsFirstLabGate` is false →
the node reads `locked` → the request settles to the path — and the outer effect
then clears `initialContentRequestRef`, so it is **never retried** after
hydration lands.

- **Not introduced here.** The non-featured branch is byte-identical to before.
- **Does not affect the Mini-games surface.** Verified with a test: the same
  scenario with `featured: true` OPENS, because the featured source skips exactly
  the lock the un-hydrated path reports. A returning player's card works.
- **Affects** hand-typed or shared `?content=` URLs.
- Recorded as `it.todo` in `featured-minigame-open.test.tsx` rather than asserted
  — asserting today's behaviour would freeze the bug in.
- Out of scope: the fix changes when the restore effect consumes its request,
  which is the boundary `restore-completed-content.test.tsx` pins.

---

## PART 17 — THE EXPERIMENT VERDICT (answered first, everything depends on it)

**During FREE EARLY ACCESS, should featured Mini-games require 3 exercises + 6
stars in the corresponding piece?**

### VERDICT: **B — NO piece-local prerequisite. REMOVE the gate for featured content.**

The previous spec recommended keeping it. That recommendation does not survive
contact with the production numbers.

**1. Keeping the local gate re-imports the badge chain through the back door.**
This is the decisive argument. The two gates are not independent in practice: to
accumulate 3 exercises + 6 stars in the queen you must be able to *switch to* the
queen, and `isPieceUnlocked` requires the previous piece's badge to be **claimed
on chain**. Removing the chain while keeping the local gate removes nothing.

**2. It would make H1 unmeasurable, which is the "say so explicitly" clause.**
Accounts that have ≥3 completed exercises in each piece:

| piece | rook | bishop | knight | queen | pawn | king |
|---|---:|---:|---:|---:|---:|---:|
| accounts | 602 | 72 | 37 | 22 | 16 | 15 |

With the gate, a featured N-Queens challenge is playable by **22 accounts**; Safe
Path by **15**. Against ~306 weekly actives, the experiment would relaunch with
the same population that already failed to produce a signal. Without it, every
card is playable by everyone who opens Learn Home.

**3. Pedagogy survives — because rotation is CURATED, not random.** The gate was
protecting against "a player who has never seen a queen move opens N-Queens".
But these are *pre-chess* puzzles: N-Queens teaches the attack rule as its
content, Safe Path teaches king safety. And the author picks which level is
featured, so the pedagogical sequencing moves from a numeric gate to an editorial
decision — which is strictly more precise.

**4. It costs nothing to reverse.** The bypass is one branch keyed on one source.

### Consequence: the intra-lane chain is bypassed too, and it has to be

`rook-rail-two-roads` is level 4 of the rook lane and level *k* requires *k−1*.
Featuring any mid-lane level while honouring the chain would make the card bounce
straight back to the path — a dead surface. So **a featured challenge opens
regardless of both the entry gate and the chain**.

Safe by construction: completing a featured level writes the same best it always
did, which can only **grant** (it unlocks the next chained level and can only
help mastery). Nothing is revoked — invariant 6.

⛔ **What the bypass does NOT cross**: the commercial gate. A featured request for
`access: "training_pass"` content is still refused. Pinned by two tests.

⛔ **And the bypass is not forgeable.** `?featured=<rotationId>` is honoured only
when the id is genuinely inside that shipped rotation, so the surface it opens is
bounded by curation, not by trust in a query string.

---

## PART 4 — Auto-advance verdict

**VERDICT: B — REMOVE IT ENTIRELY.**

`getLabyrinthForAutoAdvance` fired on every exercise completion and dropped the
player straight into the next available lane level.

1. **It is the interleave, invisible until it fires.** PART 4's target
   presentation is `Ex → Ex → Ex → Badge → Mastery`. An auto-jump is a splice.
2. **It would contaminate H1.** The hypothesis is *"do users start mini-games
   when they are VISIBLE"*. An auto-jump starts them without visibility.
3. **It is worth 547 rook accounts — which is exactly the number the new surface
   must be measured against.** Keeping it makes that comparison impossible.
4. **Discovery is not deleted, only de-automated.** The contextual `nextChallenge`
   pin inside `/exercises` stays: the player *taps* it. So the in-path route
   survives as a user-initiated action.
5. **Reversal is one line.** The helpers and their 24 tests are kept, with an
   explicit note in `lib/training/path.ts` saying they are unwired, why, and that
   re-wiring requires moving the telemetry first.

**Risk accepted and stated**: rook mini-game starts may fall. That fall IS the
measurement.

---

## PART 7 — Rotation granularity verdict

**VERDICT: B — rotate individual CHALLENGES, not engines.**

| model | rotatable units | verdict |
|---|---:|---|
| A — whole engines | 4 | A rotation of 3 engines is 9–10 of the 13 challenges. There is almost nothing left to rotate to. |
| **B — individual challenges** | **13** | Lowest maintenance: the config is a flat id list validated against the canonical catalog. No per-engine metadata to keep in sync. |
| C — hybrid | — | Two rules where one works. |

The distinction is load-bearing and is kept in the types: an **ENGINE** is the
game (telemetry `game_id`, 6 of them); a **CHALLENGE** is one of its levels
(rotation unit, 13 of them).

---

## PART 3 / PART 13 — Learn Home IA, as shipped

```
LEARN  (hub-lite-scaffold.tsx)
  HUD                     unchanged
  mascot + mode switch    unchanged
  CONTINUE LEARNING       unchanged (ChallengeCard + content-loop CTA)
  MINI-GAMES              ← NEW, above the roster
      [Early Access]
      "Featured challenges"
      3 cards, horizontal scroller
      Coming Soon strip
  DAILY                   unchanged (corner trigger + passport)
  TRAINING PATH           unchanged (6-piece roster)
```

Mini-games sits **above** the piece roster deliberately: the roster is a
progression readout, this is the second destination, and burying a discovery
surface under the thing it complements is how the lane got buried in the first
place.

The six piece tiles were **kept**, contrary to the previous spec's "collapse them
to a strip". Reason: that change has real VR and behavioural surface of its own,
it is not required by any AC here, and mixing it into this slice would make the
H1 read impossible to attribute. Recorded as follow-up.

---

## SLICE B.2 — Rotation model (PART 6)

### Source of truth: `apps/web/src/lib/minigames/rotation.ts` — versioned CODE

Not a CMS, not Redis, not a table. Changing the rotation ships with a build, and
`validateRotation` runs in the suite — a typo'd or retired id fails CI, never a
player's screen. The cadence this surface can sustain is measured in weeks.

```ts
export const MINIGAME_ROTATIONS = [
  { id: "early-access-1", items: ["rook-rail-two-roads", "bishop-run-2", "queens-1"] },
  { id: "early-access-2", items: ["king-safe-1", "rook-rail-dead-end", "bishop-run-3"] },
  { id: "early-access-3", items: ["queens-2", "king-safe-2", "rook-rail-rook-run"] },
  { id: "early-access-4", items: ["bishop-run-1", "queens-3", "king-safe-3"] },
];
export const ACTIVE_ROTATION_ID = "early-access-1";
```

Every PART 6 requirement, and where it is enforced:

| requirement | enforcement |
|---|---|
| one rotation id | `MiniGameRotation.id`; unique-id test |
| ordered challenge ids | `resolveRotation` preserves authored order; test |
| validated against the canonical catalog | `validateRotation` → `resolveChallenge` over the **projected** lane |
| no duplicate ids | `{code:"duplicate_challenge"}`; test |
| Coming Soon cannot enter rotation | `{code:"coming_soon_engine"}`; test per engine |
| retired ids rejected | falls out of the projection → `unknown_challenge`; test per retired id |
| rotation changes without touching progress storage | this module never reads or writes storage; AC-10/11 test |
| completion survives leaving rotation | bests are keyed by challenge id; AC-11 test |

Two authoring rules beyond the brief, both tested: **no engine twice in one
rotation**, and **no challenge reused across rotations** while unseen content
remains.

### Freshness with ZERO storage

`carriedOverIds(rotationId)` returns the ids the *previous* rotation also
featured, derived from the ordered constant. So "New" needs no localStorage, no
server and no per-player state.

---

## PART 15 — Static content capacity

**13 healthy challenges**: Rook Rail 4 · Pivot Run 3 · N-Queens 3 · Safe Path 3.

Not a combinatorial count — a count under the rules that make a rotation feel
authored:

1. 3 featured per rotation;
2. one engine at most per rotation;
3. no challenge repeats while unseen content remains;
4. an engine should not lead two consecutive rotations.

**Four rotations before anything repeats** (12 of 13 used). The four above satisfy
all four rules; each drops a different engine (R1 no king, R2 no queen, R3 no
bishop, R4 no rook), so no engine dominates consecutive sets.

**Recommended cadence: fortnightly.** Weekly burns the catalog in four weeks and
promises a pace the product has not shown it can sustain; monthly makes the
surface feel static. At a fortnightly turn:

| rotation | approx. window |
|---|---|
| early-access-1 | 2026-08-19 → 2026-09-02 |
| early-access-2 | 2026-09-02 → 2026-09-16 |
| early-access-3 | 2026-09-16 → 2026-09-30 |
| early-access-4 | 2026-09-30 → 2026-10-14 |

**NEW CONTENT IS REQUIRED AROUND 2026-10-14.** Before then, the two cheapest
sources are already identified and need no new engine: **fixing the Knight's Tour
level-2 cliff** (+3 challenges) and **making Promotion Run gradeable**
(+3) would take the pool from 13 to 19 and buy two more rotations.

---

## PART 8 / PART 9 — Freshness and Early Access copy

`MINIGAMES_COPY` (editorial.ts) carries three rules as a docstring, and the ES
override honours them:

1. no price, no currency, no "unlock";
2. **no cadence promise** — "Featured challenges", never "new every week";
3. no end date, no countdown — Early Access has no announced end, so
   *"free until…"* would be a promise nobody authorized.

What the player sees:

| situation | rendering |
|---|---|
| new this rotation | corner `New` flag |
| carried over from the previous rotation | no flag |
| completed previously | `Play again` (never reset) |
| all featured completed | *"You cleared them all. Featured challenges change from time to time."* |

Pinned by tests that scan the rendered text for `/free until/`, `/days? left/`,
`/every week|weekly|cada semana|semanal/` and a clock pattern, and assert none
appear.

ES: "Early Access" and every game name stay in English — they are product names,
same rule the bundle already applies to "Knight's Tour", "Season Pass", "PRO".
⚠️ They had to be inserted **above `"PRO"`** in the parity guard's
`IDENTICAL_TOKENS`: `PRO` matches the first three letters of `PROmotion Run` and
leaves `"motion Run"` behind, which reads as untranslated copy. That is the
longest-first ordering the file documents, and it cost one red run to find.

---

## PART 10 — Future monetization seam

`apps/web/src/lib/minigames/access.ts`:

```ts
export function resolveMiniGamesAccess(
  _rotation: MiniGameRotation,
  _player: MiniGamesPlayer,
): MiniGamesAccess {
  return { allowed: true, policy: EARLY_ACCESS_POLICY };
}
```

- **Signature is `(rotation, player)` on purpose** — every candidate model is
  rotation- or period-scoped ("5 Peones per rotation", "5 Peones for 7 days"),
  never per-game-forever.
- **`MiniGamesPlayer` is `Record<string, never>`** — an empty object is the
  compile-time proof that no caller passes a balance or an entitlement into an
  access decision that does not have one.
- **The `allowed: false` branch already exists in the type**, so the day a policy
  lands the compiler forces every consumer to handle a denial.
- **One call site**: `deriveMiniGamesHubView` returns no cards when it denies. A
  future policy changes one function body; no card, no route, no test changes.
- No wallet read, no ledger read, no `Date`, no `expiresAt`, no DB state.

---

## PART 11 — Deep link resolution

`pieceForContent()` is gone. `resolveMiniGameDeepLink` resolves against the
**projected lane of all six engines** via the same `resolveChallenge` that
rotation validation uses — so a rule proven in one is true in the other by
construction.

Exhaustively tested: all 13 early-access challenges resolve, plus `knight-tour-1`
and `pawn-promotion-2` (real content, reachable by URL, never featurable); empty
string, `undefined`, unknown ids, five retired ids and a lane-1 exercise id are
all refused.

---

## PART 14 / PART 16 — Card states

`FeaturedCardState = "FEATURED_AVAILABLE" | "FEATURED_IN_PROGRESS" | "FEATURED_COMPLETED"`

**The union is the product decision.** There is no `PROGRESSION_LOCKED` and no
`EARLY_UNLOCK_AVAILABLE` member, so a card *cannot* render a price or a lock —
not by policy, by types. `NOT_FEATURED` needs no member: it is absence from the
rotation.

`FEATURED_IN_PROGRESS` is reachable only through the ENGINE (a sibling level of
the same game is done, this one is not) — at per-challenge granularity a level is
done or it is not, and "Continue" is then the honest verb.

`COMING_SOON` renders as an inert `<li>`, never a `<button>`, and shows no price.

---

## PART 13 — Telemetry

**Removed (net reduction):** the duplicate `labyrinth_complete` in
`labyrinth-complete-overlay.tsx`. In production, 2.229 of 4.364 rows (**51 %**)
carried no `labyrinth_id` and were unattributable; any count that did not filter
on `props ? 'labyrinth_id'` was inflated ~2×. Completion telemetry now has one
emitter and it names the challenge. `modal_open` stays — it is the overlay's own
impression, not a duplicate.

**Added — two events.**

`minigames_open { rotation_id }` — the H1 denominator.
⚠️ **Not a render event and not an impression.** Fires **once per session**,
latched in `sessionStorage` keyed by rotation id, so a session that bounces
between hub and exercises twenty times writes one row (~1/session, ~300/week).
`peones_balance_viewed` reached 9 % of all telemetry by firing per render — that
is the failure the "no event on render" rule exists to prevent, and this does not
have it. It is not redundant with `hub_view`: only this carries `rotation_id`,
which is what makes a usage change attributable to a rotation change.

`minigame_start { challenge_id, game_id, piece, rotation_id, entry }` — the only
start signal this product has ever had. `entry` is `"featured" | "replay"`,
decided **at the tap from the state the card rendered**, so the funnel cannot
disagree with what the player saw. A completed card is the only replay; an
unplayed level of a familiar game is still a first start of that challenge.

⚠️ **Deliberate scope limit**: starts from inside `/exercises` (drawer, pin) do
NOT emit `minigame_start`. H1 asks about starts *from this surface*. Completions
from every origin remain covered by `labyrinth_complete`.

`minigame_rotation_completed` was **not** added: `isRotationComplete` is already
derivable from the bests the client holds, and no decision hangs on the event
that the next rotation's `minigames_open` does not already answer.

**AC-12** — first start / replay / return, without render-driven telemetry:
`entry:"featured"` / `entry:"replay"` / a later session's `minigames_open`.

---

## PART 2 / PART 18 — Acceptance criteria and verification

| AC | where | status |
|---|---|---|
| AC-1 no visual interleave | `exercise-drawer.test.tsx` — last exercise row precedes first lane row; `interleave.test.ts` | ✅ |
| AC-2 lane content still in path/mastery | `interleave.test.ts` — reorder ⇒ deep-equal path, badge + mastery present | ✅ |
| AC-3 badge chain unchanged | `isPieceUnlocked` untouched; drawer gate test; `path.test.ts` untouched | ✅ |
| AC-4 surface ignores the chain | `hub-cards.test.ts` reads no badge state; `featured-minigame-open.test.tsx` opens with zero progress | ✅ |
| AC-5 every playable game FREE | 3 tests scanning for `/pe[oó]n/`, `/\$\d/`, `/unlock/`, `/desbloque/`, `/buy|purchase|top up|comprar|recarga/`; type has no paid member | ✅ |
| AC-6 existing completion visible | `card-state.test.ts`, `hub-cards.test.ts` | ✅ |
| AC-7 deep links for all lanes | `deep-link.test.ts`, 13 + 2 ids | ✅ |
| AC-8 unknown/retired fail safely | `deep-link.test.ts`, `catalog.test.ts`, `rotation.test.ts` | ✅ |
| AC-9 Knight + Pawn Coming Soon | `catalog.test.ts`, `rotation.test.ts`, `minigames-section.test.tsx`, `hub-cards.test.ts` | ✅ |
| AC-10 rotation changes featured set, not progression data | `hub-cards.test.ts` | ✅ |
| AC-11 rotation change revokes nothing | `hub-cards.test.ts`, `card-state.test.ts` | ✅ |
| AC-12 first/replay/return distinguishable, no render telemetry | `minigames-section.test.tsx` (entry at tap), session-latched `minigames_open` | ✅ |

**Invalid rotation ids fail the build**: `rotation.test.ts` validates every
shipped rotation against the canonical catalog.

---

## DELIVERABLE

**EXERCISES / MINI-GAMES SEPARATION:**
`interleaveTrainingRows` replaced by `appendTrainingRows` at the drawer's single
presentation call site. The exercise sequence is `Ex → Ex → Ex → … → Badge →
Mastery` with nothing spliced in; the piece's lane levels sit together at the end
of the path. Auto-advance into a lane level removed. Mini-games are a parallel
section on Learn Home. **`buildTrainingPath` and every unlock rule untouched.**

⚠️ Lane rows were **not deleted** from the drawer. Only 3 of 13 challenges are
featured at a time; deleting them would orphan the other 10 with no route back.

**EARLY ACCESS:** FREE

**MONETIZATION:** DEFERRED

**PERMANENT UNLOCK:** DEFERRED / NOT RECOMMENDED CURRENTLY

**ROTATION MODEL:** Per-CHALLENGE featured rotation (13 units across 4 engines).
Ordered, validated id list. Engine = telemetry identity; challenge = rotation unit.

**ROTATION SOURCE OF TRUTH:** `apps/web/src/lib/minigames/rotation.ts` —
versioned code constant `MINIGAME_ROTATIONS` + `ACTIVE_ROTATION_ID`. No CMS, no
Redis, no table, no remote service.

**INITIAL FEATURED ROTATION** (`early-access-1`):
1. `rook-rail-two-roads` — Rook Rail
2. `bishop-run-2` — Pivot Run
3. `queens-1` — N-Queens

**EXAMPLE ROTATION 2** (`early-access-2`): `king-safe-1` · `rook-rail-dead-end` · `bishop-run-3`

**EXAMPLE ROTATION 3** (`early-access-3`): `queens-2` · `king-safe-2` · `rook-rail-rook-run`

*(A fourth ships too — `early-access-4`: `bishop-run-1` · `queens-3` · `king-safe-3` — which exhausts 12 of the 13.)*

**HEALTHY CONTENT CAPACITY:** 13 challenges (Rook Rail 4, Pivot Run 3, N-Queens 3,
Safe Path 3) → **4 non-repeating rotations** of 3 under the authoring rules.

**EXPECTED TIME BEFORE NEW CONTENT IS NEEDED:** ~8 weeks at a fortnightly
cadence → **around 2026-10-14**. Cheapest extensions, no new engine: fix the
Knight's Tour level-2 cliff (+3) and make Promotion Run gradeable (+3) → 19
challenges, two more rotations.

**EARLY ACCESS LOCAL GATE:** **REMOVE**

**WHY:** Keeping it would re-import the on-chain badge chain through the back
door (you cannot earn 3 exercises + 6 stars in a piece you cannot switch to), and
it would cap the measurable audience at 72/37/22/16/15 accounts per non-rook
piece against ~306 weekly actives — i.e. it would make H1 unmeasurable, which is
the brief's own "say so explicitly" condition. Curated rotation replaces the
numeric gate with an editorial one, which is more precise. The commercial gate is
untouched.

**INITIAL GAME ENGINES:** Rook Rail · Pivot Run · N-Queens · Safe Path

**COMING SOON:** Knight's Tour · Promotion Run

**DEEP LINKS:** PASS — all six projected lanes resolve; unknown, retired and
lane-1 ids refused; `featured` granted only when the rotation genuinely holds the id.

**DUPLICATE TELEMETRY REMOVED:** YES — `labyrinth_complete` in
`labyrinth-complete-overlay.tsx` (51 % of that event's volume, unattributable).

**NEW TELEMETRY:** `minigames_open { rotation_id }` (session-latched) ·
`minigame_start { challenge_id, game_id, piece, rotation_id, entry }`. Net: **+2, −1**.

**PAYMENT CODE TOUCHED:** NO

**PEONES CODE TOUCHED:** NO

**DATABASE MIGRATION:** NONE

**FUTURE MONETIZATION SEAM:** `resolveMiniGamesAccess(rotation, player)` in
`lib/minigames/access.ts`. One call site (`deriveMiniGamesHubView`), an
`allowed:false` branch already in the type, and an intentionally empty
`MiniGamesPlayer`. A future policy replaces one function body.

**FULL SUITE:** **702 files / 8726 passed + 1 todo (8727), EXIT 0, 144 s.**
Baseline measured on this machine on the same tree before starting:
**694 files / 8607 passed, EXIT 0, 155 s.** File count **rose by 8**, never fell.

**TSC:** clean (`pnpm exec tsc --noEmit`, exit 0). `pnpm content:audit` reports
zero findings for `MINIGAMES_COPY`.

**VR:** **67/67 passed, `--project=minipay --update-snapshots=none`** — `none`
cannot write, so that green genuinely compared. Baseline count unchanged at 81:
no PNG was created, **4 were deliberately re-recorded** (`vr18-learn-hub-*`)
after inspecting the `-actual.png`.

⚠️ **What that inspection caught, which no test would have**: the card title was
rendering *on top of* the piece sprite. `ThemeAssetPicture` needs **both**
`pictureClassName` (sizes the `<picture>`) and `className` (sizes the inner
`<img>`); with only the first, the img keeps its natural size and overflows.
Fixed, re-shot, re-verified.

⚠️ **`hub-clean` does NOT photograph Learn Home** — it navigates to
`/exercises`. And `vr18-learn-hub-*` shoot the `/dev/learn-hub` fixture, which
did not pass `miniGamesSlot`, so the new section had **zero** VR coverage until
it was wired into that fixture here. The fixture receives the presenter with
literal cards (never `<MiniGamesSlot/>`), so the baseline cannot depend on a
browser profile or fire telemetry from a screenshot run.

---

## TOP 3 ACTIONS

1. **Ship and measure H1 alone.** Everything here is free and reversible: no
   payment, no migration, no new content. The one number that decides the slice
   is **distinct accounts starting a non-rook challenge per week**. Baseline from
   the audit: bishop 70, knight 34, queen 17, king 14 accounts in **15 weeks**.
   Anything above ~5 non-rook accounts *per week* is a real move.
2. **Watch the guardrail, not just the win.** `exercise_complete` per active
   learner must not fall. Auto-advance was removed, so rook mini-game starts are
   expected to drop — that fall is the measurement, but a fall in *exercise*
   completions would mean the section is cannibalising learning, and the revert
   is one line (`getLabyrinthForAutoAdvance`, kept and tested for exactly this).
3. **Decide the fortnightly rotation owner before 2026-09-02.** The surface
   promises change in its copy; a rotation that never turns makes that copy the
   lie the wording was written to avoid. Turning it is a one-constant edit plus a
   build, and CI refuses an invalid set.

---

## VERDICT

**READY TO DEPLOY FREE EARLY ACCESS A+B**

Not pushed. `main` is untouched; nothing was deployed.

Two things the reviewer should carry forward, neither blocking:
- the pre-existing `?content=` hydration race (§1.3) — does not affect this
  surface, does affect shared URLs;
- the six piece tiles were kept as-is; collapsing them to a strip is a separate
  change with its own VR surface, and mixing it in would make the H1 read
  impossible to attribute.
