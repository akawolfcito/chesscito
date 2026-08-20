# Learn Mini-games — smoke remediation audit

**Date**: 2026-08-19
**Mode**: READ-ONLY / TRACE. No production code changed by this audit.
**Under audit**: A+B Early Access + rotation, local only, not pushed, not deployed.
**Specs**: `docs/specs/2026-08-19-learn-minigames-peones-economy.md` ·
`docs/specs/2026-08-19-learn-ia-minigames-early-access-implementation.md`

---

## 0. Headline

**The featured routing is not the bug.** It was traced with the real rook catalog
and it requests and renders exactly the configured challenge, with and without
stored progress.

**The bug is the post-completion boundary.** `handleLabyrinthContinue` — the
overlay's primary CTA *and* its close button — walks the EXERCISE path:
`next 0★ exercise → next lane level → "All Exercises Complete!"`. It has no idea
the player arrived from Mini-games, because until A+B nobody could.

Everything the founder saw after finishing the featured challenge is the exercise
path behaving exactly as designed, reached from an entry that did not exist when
it was designed.

---

## PART 2 — Content identity, proved from the catalog

Matched on **all three** authored fields (target, target count, title), never on
appearance:

| observed on screen | content id | pool | kind | board | source of title |
|---|---|---|---|---|---|
| "Move to e1 · **0/3** · Plan the whole tour" | **`rook-7`** | `exercises` | **EXERCISE (lane 1)** | standard exercise board | `content/exercises.json` `title` |
| "Two Turns · **0/2** · 10 moves" | **`rook-rail-two-turns`** | `labyrinths` | **MINI-GAME (lane 2), level 1** | labyrinth board (walls/blockers) | `content/labyrinths.json` `title` |
| the featured card | **`rook-rail-two-roads`** | `labyrinths` | **MINI-GAME (lane 2), level 3** | labyrinth board | `content/labyrinths.json` `title` |

Full rook inventory (`target` / `targets` / `title`):

```
exercises   rook-1              h4  —                       "Move along the rank"
exercises   rook-2              e8  [e8,b8,b4]              "Sweep the file"
exercises   rook-distance-1     b3  [b3,g3,g7,b7]           "Every distance counts"
exercises   rook-4              b2  [b2,b7,g2]              "Turn around the walls"
exercises   rook-no-diagonal-1  e5  [e5,f6]                 "Not a bishop"
exercises   rook-6              g2  [g2,d6,h5]              "The long way round"
exercises   rook-7              e1  [e1,f6,h4]              "Plan the whole tour"   ← the rocks/stars board
exercises   rook-8              h3  [h3,g7,c7]              "The boxed star"
exercises   rook-9              h8  [h8,h1]                 "Your own piece blocks the way"
exercises   rook-10             d4  —                       "The file is closed"
labyrinths  rook-rail-two-turns e1  [e1,b7]                 "Two Turns"
labyrinths  rook-rail-dead-end  e4  [e4,h8]                 "Dead End"
labyrinths  rook-rail-two-roads b7  [b7,f7,a2]              "Two Roads"             ← the featured card
labyrinths  rook-rail-rook-run  e5  [e5,b2,c7,f4]           "Rook Run"
```

⚠️ **Why "rocks + stars" is genuinely confusable, and it is not the founder's
misreading.** `rook-7` is a **Star Sweep**: 3 targets, obstacles on the board,
`0/3` counter. Lane-2 `rook-rail-two-roads` is *also* 3 targets with a `0/3`
counter. Seven of the ten rook exercises are multi-target sweeps. **The visual
grammar of a hard lane-1 exercise and a lane-2 mini-game is already almost
identical** — the only reliable differentiator on screen is the authored title.
That is a pre-existing content-design issue that A+B makes matter, because now a
player can arrive at one expecting the other.

---

## PART 1 + PART 3 — Featured routing trace

Method: rendered `ExercisesScreen` against the **real rook catalog** at the two
states that matter, and read the mounted board's own DOM (`mission-band`,
`mission-optimal-moves`) rather than a title string.

```
FEATURED CARD:              Rook Rail (engine "rook-rail")
REQUESTED CHALLENGE ID:     rook-rail-two-roads
ROUTE:                      /exercises?content=rook-rail-two-roads&featured=early-access-1
REQUEST SOURCE:             featured
```

| trace | state | mounted |
|---|---|---|
| **A** | fresh player, zero progress, `featured=true` | `labyrinthMounted: true`, band **`"Two Roads 0 / 3 · 13 moves"`** |
| **B** | smoke-like: 9 of 10 rook exercises at 3★, `featured=true` | `labyrinthMounted: true`, band **`"Two Roads 0 / 3 · 13 moves"`** |
| **C** | same state, `featured=false` (control) | `labyrinthMounted: **false**`, band `"Move to h4 · Move along the rank"` (= `rook-1`) |

```
REQUEST TRAINING CONTENT RESULT:  { action: "start" }
ACTIVE CONTENT ID AFTER RESTORE:  rook-rail-two-roads   (unchanged, both states)
BOARD COMPONENT:                  labyrinth board (Board + labyrinthMode)
```

### **FEATURED ROUTING: CORRECT.**

No restore, hydration or progression logic replaces the requested id. Trace C is
the control that proves the featured branch is doing the work: with the flag off,
the same id is refused and the player lands on the exercise board **underneath**
— which is the pre-existing `?content=` hydration race already recorded in the
implementation spec §1.3, and is *also* what a player would see if they somehow
reached a lane deep link without the flag.

⚠️ **Trace C is the second explanation for a rocks/stars board**, and it matters:
the underlying exercise board is *always mounted* and `labyrinthMode` merely
overlays it. Any path that settles to `missing` shows an exercise, silently.

---

## PART 4 — "Rook Ascendant Earned" root cause

**Traced to exactly one trigger.** The string is `BADGE_EARNED_COPY.title`
(`editorial.ts:392`, `` `${piece} Ascendant Earned` ``), rendered only by
`<BadgeEarnedPrompt>` (`result-overlay.tsx:628`), mounted only at
`exercises-screen.tsx:4692` under `showBadgeEarned`.

`setShowBadgeEarned(true)` has **one** call site — `exercises-screen.tsx:1978`:

```
completeExercise → isLastExercise && !isReplay
                 → badgeEarnedNow = isBadgeEarned(completed+1, pool)
                 → && !hasClaimedBadge
                 → holdForTap(() => setShowBadgeEarned(true))
                 → autoReset.schedule(() => { setShowBadgeEarned(false);
                                              setShowPieceComplete(true) }, 13_500)
```

### Did featured Mini-games legitimately satisfy an existing mastery requirement? — **NO.**

The founder's hypothesis (mini-game completion → mastery resolver → crown
overlay) is **falsified**:

- Milestones read `progressByPiece`, i.e. **lane-1 exercise stars only**
  (`gather-input.ts`). A lane best never enters `pieceStars` or
  `pieceCompletedExercises`.
- The only milestone a mini-game completion can newly earn is `mastery`, and that
  requires `badgeClaimed && allLabyrinthsComplete` (`milestones.ts:101`).
- `mastery`'s modal copy is **"Piece Mastered"**, and `piece-badge-eligible`'s is
  **"Badge Ready to Claim"** (`editorial.ts:4022-4035`). Neither is *"Rook
  Ascendant Earned"*.

**So the overlay fired because the player completed the last lane-1 rook
exercise** — which they reached through `handleLabyrinthContinue`. Cause **D**:
another reason — not persistence, not presentation context, not overlay
source-blindness. The player was genuinely on the exercise path by then.

⚠️ Mini-game completion *does* legitimately feed `allLabyrinthsComplete` and
therefore the mastery crown. That state semantic is correct and should stay.

---

## PART 5 — "All Exercises Complete!" root cause

`PIECE_COMPLETE_COPY.title` (`editorial.ts:344`), rendered by
`<PieceCompletePrompt>` under `showPieceComplete`. Three call sites set it:

1. the badge path's 13.5 s hand-off (above) — **this is the one the founder hit**,
   which is why it appeared *"shortly after"* the badge prompt;
2. `completeExercise`'s last-exercise branch when the badge is not newly earned;
3. **`handleLabyrinthContinue`'s `piece-complete` branch** — reachable directly
   from a mini-game.

Semantics: the title is a misnomer. It does not mean "all exercises complete" —
it is the piece-complete MENU, and its subtitle forks on badge state
(`subtitleWithNext` / `subtitleKeepPracticing` / earned-not-claimed). The CTA says
**"Start Bishop"** because `subtitleWithNext(next)` names the next piece in the
progression, which is a property of the **piece**, not of how the player arrived.

### **Logically correct, contextually wrong.**

It is not firing incorrectly for the exercise path. It is firing on a surface the
player entered from Mini-games, where "Start Bishop" is a non-sequitur — and,
worse, it points at content behind the on-chain badge chain the Mini-games
surface deliberately does not consult.

---

## PART 6 + PART 7 — The post-completion boundary, and why the return is confusing

`handleLabyrinthContinue` (`exercises-screen.tsx:3597`):

```ts
handleExitLabyrinth();
const nextIdx = pool.findIndex(ex => (progress.stars[ex.id] ?? 0) === 0 && visible);
const route = resolvePostLabContinue(trainingPath, nextIdx >= 0);
next-exercise   → handleExerciseNavigate(nextIdx)          // LANE 1
next-labyrinth  → requestTrainingContent(id, "automatic")  // getNextChallenge → FIRST available lane node
piece-complete  → setShowPieceComplete(true)
```

**Both boards the founder reported fall out of this one function:**

| priority | condition | result | matches smoke |
|---|---|---|---|
| 1 `next-exercise` | any 0★ exercise remains | opens that exercise | **`rook-7`** — rocks/stars, "Move to e1 0/3 · Plan the whole tour" |
| 2 `next-labyrinth` | none remain | `getNextChallenge` → **first available lane node** | **`rook-rail-two-turns`** — "Two Turns 0/2 · 10 moves" |
| 3 `piece-complete` | neither | "All Exercises Complete! / Start Bishop" | ✅ |

⛔ **And the close button does the same thing.** `labyrinth-complete-overlay.tsx:122`:
`onClose={() => handleAction(onContinue)}`. There is **no exit that returns to the
origin** — X and Continue are the same action. That is the whole of the
"return flow is confusing" observation.

`onRetry` (replay the same challenge) is correct and needs no change.

### Recommended mental model — same state, different completion UX

State semantics stay **identical**: write the best, keep the score, feed
`allLabyrinthsComplete`, unlock the chained level. Only the *presentation* forks.

**The cleanest existing seam is the one already in the file.** The screen already
carries `initialContentFeatured` and already threads a `TrainingContentRequestSource`
through the single request boundary. The minimal shape is a piece of state set
where `source === "featured"` is already handled — e.g. a
`featuredEntryRef`/`completionContext` set alongside `setSelectedLabyrinthId` —
read by `handleLabyrinthContinue` and by the overlay's `onClose` to choose
between the existing exercise-path routing and a "back to Mini-games" exit.

No fork of progression state. No new route. No new overlay.

### PART 7 — deterministic return destinations for a featured entry

| action | today | recommended |
|---|---|---|
| COMPLETE | overlay with Continue/Retry | unchanged (overlay stays) |
| CLOSE RESULT | runs `handleLabyrinthContinue` | **return to Learn Home**, Mini-games section |
| CONTINUE | next exercise / next lab / piece-complete | **return to Learn Home**, Mini-games section |
| PLAY AGAIN (`onRetry`) | replays the same challenge | unchanged — correct |
| BACK (header) | back to hub | unchanged — already correct |
| EXIT TRAINING | n/a | unchanged |

Routing primitive already available: `router.push("/")` — the Learn hub *is* `/`
(`/hub` redirects to it), and the Mini-games section is on it. **No separate
Mini-games route is necessary.**

---

## PART 8 — Learn hub viewport audit (measured, not eyeballed)

Measured with `getBoundingClientRect` on `/dev/learn-hub?variant=active`. A 390×844
screenshot cannot resolve a 20 px block, so pixels were never the instrument.

### At the canonical VR viewport — **390 × 844: FITS, overflow 0 px**

```
HUD              top=   6  h=  44  bottom=  50
hero/avatar      top=  56  h= 209  bottom= 265
challenge card   top= 279  h= 266  bottom= 545
mini-games       top= 551  h= 137  bottom= 687
training path    top= 748  h=  80  bottom= 828
document scrollHeight=844  clientHeight=844  overflow=0px
```

### At the MiniPay store minimum — **360 × 640: FAILS, overflow 138 px**

```
HUD              top=   6  h=  44  bottom=  50
hero/avatar      top=  56  h= 197  bottom= 253
challenge card   top= 267  h= 266  bottom= 533
mini-games       top= 539  h= 137  bottom= 676   ⚠ BELOW FOLD
training path    top= 682  h=  80  bottom= 762   ⚠ BELOW FOLD
document scrollHeight=778  clientHeight=640  overflow=138px
```

**Attribution is exact**: content was 641 px before Mini-games — it *just* fit at
640. The 137 px section is what pushed it over at the documented minimum.

### LEARN vs PLAY — the hero is NOT the difference

PLAY's mascot is the **same element** (`hub-lite-mascot play-hub-mascot`), same
197–209 px. PLAY simply has no 266 px challenge card and no 80 px training path.
So "delete the avatar" would remove the one block LEARN and PLAY share, and would
not be the cheapest 138 px on the page.

### Where the 138 px actually is — challenge card internals (360 px wide)

```
challenge-card               h=266
  challenge-card-top         h= 98   (of which challenge-card-icon h=72)
  passport-head              h= 26
  challenge-card-passport    h= 44   (the 7-day flame row)
  challenge-card-bottom      h= 92   ← the Season Pass offer block
```

Mini-games internals: header 14 + sub 12 + rail ≈ 79 + coming-soon ≈ 20 + gaps.

### Options, priced

| option | block | recovers | verdict |
|---|---|---:|---|
| **C** move Season Pass detail behind its CTA | `challenge-card-bottom` 92 | **~60–92** | **best value, no identity loss** |
| **B** compact the card's top (icon 72 → 48) | `challenge-card-top` 98 | ~24 | cheap, keeps the card legible |
| **E** drop the `hub-minigames-sub` line ("Featured challenges", redundant beside the header) | mini-games | ~12 | cheap |
| **D** compact Training Path (80 → 64) | training path | ~16 | cheap |
| **A** reduce hero/avatar | hero 197 | ~50–77 | **not recommended** — shared with PLAY, and the founder values it |

**C + B + E + D ≈ 112–144 px** — clears the 138 px deficit without touching the
mascot and without a redesign.

---

## PART 9 — Proposed hub product rule

### RECOMMEND: **MODIFIED**

> **Primary hub destinations must be reachable without scrolling at the MiniPay
> store-minimum viewport (360 × 640).** A destination counts as reachable when its
> tap target is fully within the first viewport. Secondary/detail content
> (progress readouts, offers, history) may live below the fold.
>
> "Primary destinations" for LEARN today: the Continue/primary CTA, the Daily
> affordance, and **at least one Mini-games card**. The Training Path roster is a
> progress readout, not a destination, and may sit below the fold.

Why modified rather than the literal proposal: the original wording ("primary hub
navigation should not require scroll") does not say *at which viewport*, and the
two the repo uses disagree — 390 × 844 passes today, 360 × 640 does not. Pinning
the rule to the **documented store minimum** is the only version that is testable
and that matches an obligation the product already has. It also declines to
promise that *everything* fits, which is not achievable and not needed.

⚠️ Not applied globally in this pass, per the brief.

---

## PART 8b — Which behaviours are pre-existing / introduced / exposed

| behaviour | classification | evidence |
|---|---|---|
| featured card opens the wrong content | **DOES NOT OCCUR** | traces A and B render `Two Roads` |
| `handleLabyrinthContinue` walks the exercise path | **PRE-EXISTING**, untouched by A+B | `resolvePostLabContinue` and its caller are unmodified in the branch |
| …reached from a hub entry, so it now crosses the boundary | **EXPOSED by A+B** | before A+B, lane content was only reachable from inside the exercise path |
| overlay close == Continue (no origin return) | **PRE-EXISTING** | `labyrinth-complete-overlay.tsx:122` |
| "Rook Ascendant Earned" | **PRE-EXISTING**, correct for its own path | single trigger at `exercises-screen.tsx:1978` |
| "All Exercises Complete! / Start Bishop" | **PRE-EXISTING**, contextually wrong here | 13.5 s hand-off from the badge prompt |
| lane-1 sweeps look like lane-2 mini-games | **PRE-EXISTING content design**, newly consequential | 7 of 10 rook exercises are multi-target sweeps |
| Learn hub overflows 360 × 640 | **INTRODUCED by A+B** (137 px section over a 641 px budget) | measured |
| `?content=` dropped when progress hydrates late | **PRE-EXISTING**, already documented | trace C; implementation spec §1.3 |

---

## PART 10 — Regression risk of the proposed remediation

The remediation is **presentation-only routing + a layout budget**. It writes no
new state.

| area | impact | why |
|---|---|---|
| exercise progression | **none** | `completeExercise`, `progress.stars`, `visibleExerciseIds` untouched |
| mastery | **none** | `allLabyrinthsComplete` still fed by the same best write |
| badge claims | **none** | `showBadgeEarned` trigger untouched |
| special training / lane chain | **none** | node statuses unchanged |
| stored bests | **none** | `recordLabyrinthBest` untouched; keyed by challenge id |
| restore | **low** — must not clear `writeLastTrainingContentId` differently | keep the existing write |
| deep links | **none** | `resolveMiniGameDeepLink` untouched |
| training pass | **none** — must stay refused | AC-8 pins it |
| Daily | **none** | separate surface |
| Peones / payments / PRO | **NONE** | no file in `lib/peones`, `lib/payments`, `app/api` is touched |
| telemetry | **low** | no new event needed; `minigame_start` already carries the entry. ⚠️ do not emit a second completion event |
| VR | **medium** | any layout change re-reds the four `vr18-learn-hub-*` baselines. Inspect `-actual.png` before re-recording; chips/flags must be pinned by DOM, not pixels (`hub-clean` tolerance ≈ 1.646 px ≈ 3.7× a chip) |

Explicitly must not happen: grant Exercises access, revoke mastery, lose a lane
best, bypass `training_pass`, double-write telemetry.

---

## PART 11 — Tests required before any fix (designed, not yet written)

| AC | assertion | shape |
|---|---|---|
| **AC-1** | featured Rook card requests **and renders** `rook-rail-two-roads` | integration on the REAL catalog, assert the mounted band names the challenge — the trace above, promoted to a permanent test |
| **AC-2** | stored rook progress cannot replace a featured challenge with a lane-1 exercise | trace B, promoted; assert `labyrinthMounted === true` **and** the band is not an exercise title |
| **AC-3** | featured completion still writes best/completion | assert `chesscito:labyrinth-best:rook` gains the id after completion |
| **AC-4** | featured completion may update mastery state but must NOT show `BadgeEarnedPrompt` / `PieceCompletePrompt` | assert both testids absent after a featured completion; assert the best was still written (state ≠ UX) |
| **AC-5** | featured completion never auto-selects a lane-1 exercise | assert no exercise board becomes active; `handleExerciseNavigate` not reached |
| **AC-6** | closing the featured result returns deterministically to the Mini-games origin | assert `router.push` called with `/` (or the agreed origin), and NOT with a content id |
| **AC-7** | exercise-path completion still shows its current mastery / all-exercises UX | regression guard: last-exercise completion still yields `BadgeEarnedPrompt` |
| **AC-8** | `training_pass` featured content stays inaccessible | already exists in `featured-minigame-open.test.tsx`; keep |
| **AC-9** | no badge-chain semantics change | `isPieceUnlocked` untouched; existing drawer AC-3 test |
| **AC-10** | Learn hub primary navigation fits 360 × 640 | **DOM/layout assertion, not VR**: Playwright at `minipay-360`, assert `documentElement.scrollHeight <= clientHeight`, and that the first Mini-games card's box is fully within the viewport. VR tolerance is far too broad for this |

⚠️ AC-10 must be a **measurement**, not a screenshot: `hub-clean`-class tolerances
ignore ~1.646 px, which is larger than several of the blocks being budgeted.

---

## MINIMUM REMEDIATION (not implemented — for review)

1. **Make the completion boundary entry-aware.** Record that the active lane
   content was entered as `featured` (set where `source === "featured"` is already
   handled, cleared by `handleExitLabyrinth`). `handleLabyrinthContinue` and the
   overlay's `onClose` then branch: featured entry → return to Learn Home;
   exercise-path entry → today's behaviour, byte-identical. **No state fork, no
   new route, no new overlay.**
2. **Suppress the exercise-path celebrations on a featured completion.** The badge
   prompt cannot fire from a mini-game today, but `piece-complete` can (priority 3)
   — gate that branch on the same entry context. State (best, mastery, chain
   unlock) is written exactly as now.
3. **Recover 138 px on the Learn hub: option C + B (+E, +D if needed).** Move the
   Season Pass detail behind its CTA (~92 px) and compact the card's icon block
   (~24 px). **Do not touch the mascot** — it is shared with PLAY and is not the
   cheapest space on the page.

Ordering: 1 and 2 are one change to one function pair and should land together;
3 is independent and can land in the same PR or after.

---

## DELIVERABLE

**SMOKE REPRODUCED:** PARTIAL — the content identities, the post-completion
routing and the viewport overflow are all reproduced and measured. The exact
overlay sequence was reproduced *by trace of its single trigger*, not by driving
a board to completion in jsdom.

**FEATURED ROOK REQUESTED ID:** `rook-rail-two-roads`

**FEATURED ROOK RENDERED ID:** `rook-rail-two-roads` — verified fresh and with 9/10
rook exercises solved (band reads `"Two Roads 0 / 3 · 13 moves"` in both)

**ROCKS/STARS CONTENT:** `rook-7` — lane-1 EXERCISE, Star Sweep, target e1, 3
targets, authored title "Plan the whole tour"

**EXPECTED ROOK RAIL CONTENT:** `rook-rail-two-roads` — lane-2 mini-game, target
b7, 3 targets, "Two Roads", 13 optimal moves. (The later "Two Turns 0/2 · 10
moves" is `rook-rail-two-turns`, lane level 1, opened by post-completion routing.)

**FEATURED ROUTING BUG:** **NO**

**ROOK ASCENDANT ROOT CAUSE:** `<BadgeEarnedPrompt>` via the single
`setShowBadgeEarned(true)` at `exercises-screen.tsx:1978` — `completeExercise`,
last lane-1 exercise, badge newly earned, unclaimed. The player reached that
exercise through `handleLabyrinthContinue`'s `next-exercise` priority. **Mini-game
completion cannot trigger it**; milestones read lane-1 stars only.

**ALL EXERCISES COMPLETE ROOT CAUSE:** `<PieceCompletePrompt>`, set by the badge
path's 13.5 s hand-off (`autoReset.schedule`). Also directly reachable from
`handleLabyrinthContinue`'s `piece-complete` branch. "Start Bishop" comes from
`subtitleWithNext(next)`, a property of the piece, not of the entry. **Logically
correct, contextually wrong.**

**POST-COMPLETION MIXING:** **PRE-EXISTING · EXPOSED by A+B** (not introduced —
`resolvePostLabContinue` and `handleLabyrinthContinue` are unmodified)

**RETURN NAVIGATION BUG:** YES — the overlay's close is wired to `onContinue`
(`labyrinth-complete-overlay.tsx:122`), so there is **no** exit that returns to
the origin. X and Continue both advance the exercise path.

**STATE SEMANTICS SHOULD CHANGE:** **NO** — mini-game completion should keep
writing its best and keep feeding `allLabyrinthsComplete` / mastery.

**COMPLETION UX SHOULD CHANGE:** **YES** — entry-source-aware presentation only.

**LEARN HUB FIRST-VIEWPORT FIT:** **PASS at 390 × 844 (overflow 0 px) · FAIL at
360 × 640 (overflow 138 px)**

**PRIMARY VIEWPORT RULE:** Primary hub destinations must be fully reachable
without scrolling at the MiniPay store-minimum viewport **360 × 640**. Progress
readouts (Training Path) and offer detail may sit below the fold. Pinned by a
layout assertion, never by VR tolerance.

**MINIMUM REMEDIATION:**
1. Entry-source-aware completion boundary (`handleLabyrinthContinue` + overlay
   `onClose`): featured entry returns to Learn Home; exercise entry unchanged.
2. Gate the `piece-complete` branch on the same entry context; keep every state
   write identical.
3. Recover ~138 px: Season Pass detail behind its CTA (~92) + compact card icon
   (~24) + the redundant "Featured challenges" line (~12) + Training Path (~16).
   Mascot untouched.

**TESTS REQUIRED BEFORE FIX:** AC-1 … AC-10 above; AC-1/AC-2 are the traces in
this audit promoted to permanent tests, AC-10 is a `minipay-360` layout
measurement, not a screenshot.

**PAYMENT IMPACT:** NONE

**PEONES IMPACT:** NONE

**DB MIGRATION:** NONE EXPECTED

---

## VERDICT

**READY FOR TARGETED REMEDIATION**

The diagnosis is complete and the featured routing — the thing that would have
been expensive to be wrong about — is proven correct. The remaining work is one
presentation-only branch in a single function pair, plus a measured 138 px layout
budget. No production code was modified by this audit; the two trace probes used
to produce it were deleted.
