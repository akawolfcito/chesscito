# Mini-games — Personal Daily Allowance + Compact Status

**Date**: 2026-08-21
**Scope**: daily replenishment, compact status row, Library gating, pin audit.
No new content, no Peones spend, no payment/top-up/PRO/P2P change, no DB
migration, no server entitlement, no global rotation, no push, no deploy.

---

## PART 1 · Sally's review

Her framing changed the rest of the pass: **the three tiles already say what is
playable**. Three tiles = three things. So the footer row must not re-encode
availability — it must carry the only thing the tiles cannot: *where today ends
and when more arrives*. That is why `4/13` was misheard as "nine more are
available somewhere" and why the explanatory sentence went unnoticed: neither
did a job the tiles weren't already doing.

| variant | verdict |
|---|---|
| **A** `1/3 today · 18h` (founder) | **recommended**, with one correction |
| B pips `●●○ · 18h` | 6px between full and empty at 390px — lost at a glance |
| C adaptive (`3 new today` → `2 left · 18h` → `Back in 18h`) | three grammars; the player re-learns the row every day |

**The correction: the timer appears only once a slot is consumed.** At `0/3`
nothing is charging, and a countdown there is the same noise as the sentence it
replaced. Its *appearance* on the first completion gives the player an event.

⛔ **Sally's addition, not on the brief's list**: with the healthy pool
exhausted the timer must also be absent — nothing will refill, and promising
hours for content that does not exist is the one way this row could lie.

**Layout**: same row, separated by **form**, not words. `VIEW ALL` stays a pill
(bordered, filled, tappable); the status sits *outside* it as flat text. `4/13`
lived *inside* the button, and a number inside a control reads as part of what
the control does.

**Peones seam (design only)**: sprite-then-number `[♙] 5` using the existing
`peones.piece` asset — the Unicode `♙` renders inconsistently in Android
WebViews, which is all of MiniPay. No `+3`: the badge is an affordance, the
confirm sheet is the contract. Only at `3/3`: a price badge beside available
free content reads as if the free content costs money. Anchored to the **tile
group's top-right corner** — the slot the NEW flags vacate at `3/3`, so it costs
zero height and the eye already looks there. Never in the status row: that row
is information, and an action buried in an information row is how you get
something tappable that nobody taps.

---

## PART 2–4 · The window

`lib/minigames/daily-window.ts`, pure — no storage, no React, no ambient clock.

```ts
currentWindowId(now)        // the UTC calendar day, "YYYY-MM-DD"
hoursUntilNextWindow(now)   // display only; nothing else consumes it
resolveWindowAssignment({ stored, windowId, pool, completedChallengeIds })
```

**Timezone**: the **UTC calendar day**, reusing `todayUtc` from
`lib/daily/progress.ts`. Deliberate: the streak, the focus-day ledger and the
server's `p_day_utc` already draw the day there, and a second definition of
"day" would drift from the streak the player sees on the same screen.
⚠️ Consequence to know: for LatAm (UTC−3…−6) replenishment lands in the evening,
not at local midnight.

**Same window** → the assignment is returned as-is. A consumed slot is *not*
refilled. **New window** → carry over every assigned challenge the player has
not completed, then top up the freed slots via `pickUnseen` — the same picker
Featured uses, so engine variety applies to a top-up exactly as to a fresh set.

⛔ **"Consumed" is DERIVED, never stored.** A slot is consumed iff its id is in
the existing per-piece best map. A second copy could disagree with the first,
and the disagreement would surface as a slot finished on the board but still
open in the queue.

⛔ **The timer is a distance to a boundary, not a stopwatch.** It does not start
on a completion and never resets on a later one — completions are not even an
argument to `hoursUntilNextWindow`. Two players who completed one and three
challenges see the same number.

**Queue correctness never depends on a render or an interval.** The container
reads the window id once at mount; the hours are display-only at hour precision.

### State (PART 3)

One new key, versioned:

```
chesscito:minigames-window:v1  →  { "windowId": "2026-08-21", "assigned": ["id", …] }
```

`parseStoredAssignment` refuses anything it does not fully recognise — bad JSON,
wrong shape, non-string ids, a malformed date — so an old or corrupt payload
degrades to "fresh window", never to a broken slot. A shape change bumps `:v2`
rather than migrating: worst-case loss is one window of assignment, and a silent
mis-parse would be worse than a clean reset. Ids that left the catalogue are
dropped so they cannot hold a slot.

**No DB table.** Nothing here needs one: FREE Early Access, device-local, and
the brief's own escape clause applies.

### PART 4 · anti-abuse

Not built, on purpose. Clearing localStorage resets the free daily experience.
That is acceptable for a measurement phase, and hardening it is the *economic*
problem that belongs to server authority when Peones acceleration is real.

---

## PART 5–6 · The status row

```
[ VIEW ALL ]   1/3 today · 18h
```

`0/3 today` (no timer) · `1/3` · `2/3` · `3/3 today · 18h` · exhausted pool →
`3/3 today` with no timer.

⚠️ **No clock glyph.** Sally's sketch had `⏱ 18h`; the shipped row is `18h`.
Same reasoning that rejected the `♙` glyph: emoji rendering in Android WebViews
is inconsistent, and the row reads unambiguously without it. Reversible in one
line if you want the icon.

Hours, never `18:42:13`. A test asserts the string matches no `\d+:\d+`.

---

## PART 7 · Library

Regrouped **by availability, not by game family** — the grouping *is* the gate.

| section | playable | rendering |
|---|---|---|
| Available today | yes | rows |
| Completed | yes (replay) | rows, marked, never dimmed |
| Everything else | **no** | one line: *"More challenges ahead"* |

⛔ The upcoming line is a `<p>`, **not** a disabled button — a
disabled-looking control invites taps that go nowhere — and carries **no
number**, because naming it would re-introduce the catalogue size the Home just
stopped showing.

⚠️ The Library resolves the window **read-only and never writes it**. The Home's
`MiniGamesSlot` is the single writer; two writers would race across a midnight
boundary and hand the player two different assignments. Pinned by a test.

---

## PART 9–10 · Future seams — DESIGN ONLY

**Peones badge**: nothing renders it. `U-7` asserts no price, no Peones glyph,
no unlock CTA at `3/3`. Placement and notation are Sally's recommendation above.

**Server entitlement**, when acceleration is real:

```
(wallet, window_id, extra_batches_purchased)
base allowance = 3
paid extension = extra_batches * 3
```

The server authorises only the *number* of extra challenges; the client keeps
deciding *which* ids. That boundary matters: the concrete ids are content, and
content must stay shippable without a migration. `resolveConsumptionPolicy`
already owns the allowance and is the one function that widens.

---

## PART 11 · Measurement

Existing events answer most of it:

| question | query |
|---|---|
| users starting ≥1 | distinct accounts with `minigame_start` |
| reaching 1/3, 3/3 | `minigames_open` grouped by `completed_today` |
| distinct first-time completions / account / day | `labyrinth_complete where previous_best is null` |
| consecutive days at 3/3 | `minigames_open where completed_today = slots`, by `window_id` |
| next-day return among 3/3 | the same, joined to the following `window_id` |
| replay rate | `previous_best is not null` ÷ all `labyrinth_complete` |

`minigames_open` swapped its old fields for `window_id`, `completed_today`,
`slots`, `pool_exhausted`, and its session latch is now keyed by window id, so
crossing midnight re-arms it exactly once.

### One new event, and the exact decision it enables

```
minigames_library_open  { window_id, completed_today, slots, upcoming }
```

**The signal the whole 5-day period exists for is "a player used up today's
allowance and went looking for more the same day", and nothing answered it.**
`minigames_open` is latched once per session on the Home; `minigame_start`
requires a tap, and a capped player has nothing new to tap. Opening the Library
*is* the intent.

Volume: one row per Library visit on a secondary surface, fired once per mount
after hydration — never on a re-render. That is the failure mode
`peones_balance_viewed` had when it reached 9% of all telemetry, and this event
does not have it.

---

## PART 12–14

**Copy**: *"You cleared them all — Featured challenges change from time to
time"* was **deleted, not reworded**. It is false twice over (no global
rotation; content does not change "from time to time" for everyone), and the
founder never noticed it in smoke — which is the evidence that prose under the
rail does no work. Its test went with it.

**Separation**: unchanged. Exercises is lane-1 only in LEARN; mastery, bests and
the badge chain are untouched.

### PART 14 · the "Enter Labyrinth" pin → **HIDE IN LEARN**

⛔ **By the time this pass landed it was no longer a taxonomy question.** The pin
opens `nextChallenge` — the first unlocked, uncompleted lane node — with source
`automatic`, which is **not the daily assignment**. A player who cleared their
three could tap it and walk straight into a fourth, from inside Exercises, past
the window. The allowance turned a cross-surface smell into a hole in the model.

Hidden on the same `showLanePathRows` flag that hides the lane rows: one flag,
one product rule.

⚠️ **PLAY keeps it, and must.** PLAY mounts no Mini-games surface and no
Library, so the pin plus the path rows are the only way lane-2 is reachable
there. Reachability traced before changing it.

---

## Verification

| check | result |
|---|---|
| `pnpm exec tsc --noEmit` | **clean** |
| full Vitest suite | **711 files · 8988 passed · 1 todo · exit 0** |
| new/changed tests | D-1…D-12 (27) · U-1…U-7 (36 in the section file) · L-1…L-5 (14) |
| VR `--project=minipay --update-snapshots=none` | **68/68**, 82 baselines before and after |
| driven smoke, LEARN production build | **7/7** (Flows A–F, H; MiniPay 390px = flow I) |
| prior separation smoke | **4/4**, unbroken |
| DB / migrations / `*.sql` diff | **empty** |

File count moved 710 → 711 (the daily-window suite). No worker dropout.

### VR: inspected, then re-baselined deliberately

Four shots failed, exactly the four predicted: `vr18-learn-hub-{guest,active,completed,pro}`.
The `-actual.png` and `-diff.png` were opened before touching a baseline.

The diff is confined to the LEARN PATH rail, and comparing against the old
baseline explains the vertical shift: **that baseline predates the previous pass
too** — it still showed engine names (`Rook Rail`, `Pivot Run`, `N-Queens`) and
had no footer row at all. Both passes' visual changes landed in one re-baseline.

Checked at 390px: one status row (no second or third), `VIEW ALL` legible and
tappable, no horizontal overflow, tiles uniform height, `3/3 · 18h` no wider
than `1/3 · 18h`. Re-recorded only those four; a follow-up
`--update-snapshots=none` run returned 68/68 with the baseline count unchanged
at 82, which is what proves the run compared rather than recorded.

### ⚠️ One finding the photos surfaced, outside this pass's scope

**Most real challenge titles truncate on the 50px tile.** The fixture's long
title renders as `A Very Lon…` — roughly a 10-character budget. Of the 13
authored titles, `Two Roads` (9) and `Dead End` (8) fit; `Turn to the Star` (16),
`The Knight Sees` (15), `The Quiet Room` (14) and `Nine on Eight` (13) will not.

This came in with the previous pass's naming change (plate = challenge, not
engine), which was approved without a photo. The full title is still in the
accessible name and in the Library, and the geometry is sound — but the tile is
now showing a clipped name where it used to show a whole one. **Flagged for your
call**; fixing it means either shorter authored titles or accepting a taller
tile, and both are product decisions, not implementation ones.

---

## DELIVERABLE

**HEALTHY POOL:** 13

**DAILY NEW SLOT CAP:** 3

**QUEUE MODEL:** PERSONAL + TIME-BOUNDED

**GLOBAL ROTATION:** NO

**REPLENISHMENT:** at the next **UTC calendar day**, reusing the day boundary the
streak and `p_day_utc` already use. Only consumed slots refill; each refills
with the next unseen challenge, engine-variety preferred.

**UNCONSUMED SLOTS PERSIST:** **YES** — across any number of idle windows.

**REPLAY CONSUMES:** **NO** — by construction. The only input is a Set of
completed ids, and a Set has no "again". Holds for Home replays and Library
replays alike.

**STATE AUTHORITY V0:** **LOCAL** — `chesscito:minigames-window:v1` plus the
existing per-piece best map. No new table, no API.

**CROSS-DEVICE V0:** **NO.** Clearing storage resets the free daily experience.
Accepted for the measurement phase; the economic entitlement becomes
server-authoritative separately when Peones acceleration is real.

**HUB STATUS:** `[ VIEW ALL ]   n/3 today · 18h` — one row, pill and status
separated by form. Timer hidden at `0/3` and when the pool is exhausted.

**TOTAL CATALOGUE COUNT ON HUB:** **NO** — asserted by U-1.

**LIBRARY FUTURE CONTENT:** **HIDDEN** — one line, no titles, no count, not a
control.

**VIEW ALL:** a tappable pill, alone, carrying no number.

**SALLY RECOMMENDATION:** founder variant A (`n/3 today · 18h`), with the timer
conditional on consumption — plus her addition that an exhausted pool shows no
timer either; status outside the pill on the same row; Peones badge as
`[♙sprite] 5`, no `+3`, only at `3/3`, top-right of the tile group, hidden until
enabled.

**PEONES ACCELERATION:** **NOT IMPLEMENTED**

**FUTURE PEONES BADGE:** designed, not rendered. Existing `peones.piece` sprite
+ `5`, tile-group top-right corner (the slot NEW flags vacate at `3/3`).

**FUTURE SERVER ENTITLEMENT:** `(wallet, window_id, extra_batches_purchased)`;
server authorises the COUNT, client keeps choosing the ids. Documented only.

**NEW TELEMETRY:** **ONE** — `minigames_library_open`. It is the only thing that
can answer "did a capped player go looking for more the same day", which is the
monetization signal this measurement period exists to produce.

**ENTER LABYRINTH PIN:** **HIDE IN LEARN.** It bypassed the daily assignment
(source `automatic`, not the assigned set) and would have let a capped player
reach a fourth challenge from inside Exercises. PLAY keeps it — it is lane-2's
only entry there.

**FULL SUITE:** 711 files · 8988 passed · 1 todo · exit 0

**TSC:** clean

**VR:** 68/68 with `--update-snapshots=none`; four `vr18-learn-hub-*` baselines
inspected and re-recorded deliberately; baseline count unchanged at 82.

**MANUAL SMOKE:** 7/7 driven against a LEARN production build (Flows A–F, H;
run at MiniPay 390px, which is flow I). Prior separation smoke 4/4.

---

## VERDICT

**READY TO DEPLOY DAILY MINI-GAMES EARLY ACCESS**

The allowance is personal and time-bounded, unconsumed slots survive, replay
cannot consume, the Library cannot outrun the window, the Home shows today and
never the catalogue, and the one cross-entry that could have bypassed the model
is closed. Verified end to end: types, 8988 tests, a green VR run whose four
changed photos were looked at before they were re-recorded, and seven driven
flows against a real production build.

⚠️ Two things to carry, neither blocking:
- **title truncation on the tile** — a live legibility cost from the previous
  pass, now visible in a baseline and awaiting your call;
- **nothing is server-authoritative** — which is correct while this is free, and
  is the first thing that must change on the day Peones acceleration ships.
