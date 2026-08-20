# Learn / Mini-games separation — final pre-production remediation

**Date**: 2026-08-19
**Status**: implemented and verified locally. **Not pushed. Not deployed.**
**Predecessor**: `docs/audits/2026-08-19-learn-minigames-smoke-remediation-implementation.md`
**Founder correction applied**: milestones are treated as *earned rewards*. Their
presentation became context-aware; **nothing was suppressed**.

---

## 1. The finding that reframed the whole pass

`rook-7` — the board the smoke described as *"Move to e1 0/3 · Plan the whole tour"*,
with the rocks — **is lane-1 exercise-path content**. It lives in
`puzzles.generated.ts:523`, carries `obstacles` and three `targets`, and is the
**last** rook exercise. So *"All Exercises Complete! / Start Bishop"* after it was
the exercise path behaving **correctly**.

The featured mini-games are different ids entirely — `rook-rail-two-roads`,
`bishop-run-2`, `queens-1` — drawn from the projected Special Training lane.

⛔ **And the two look nearly identical.** `rook-rail-two-roads` is *also* a
3-target sweep with obstacles. That is why the surfaces felt intertwined: the
player could not tell which lane a board belonged to, because **nothing on the
board said so**.

**Verdict for PART 4: no content moves.** The remediation is labelling and
hierarchy, not catalog surgery.

---

## 2. What changed

### PART 1 — Learn Home: one door per surface

The 6-piece Training Path roster left the Learn Home. `LearnPathEntry`
(`components/hub/learn-path-entry.tsx`) replaces it.

⚠️ **Its FORM was superseded the same day — see PART 1b.** It shipped first as a
full-width row; the founder's second smoke rejected that and it is now a
`HubActionTile` in the shared rail. The hierarchy below is what survived both
passes; the row is not.

The home is now three tiers, in order: **season pass / daily → Mini-games →
Exercises**.

- The per-piece progression **did not move or disappear** — it lives inside
  `/exercises` (dock badge tab owns the piece switcher, drawer owns the path).
- `rewardTiles` stays the prop; the entry counts mastery off the same array,
  so nothing new is derived.
- ⚠️ **The Hub Tour's third step was re-anchored.** It resolves
  `[data-tour-target="rook"]` from the document, and that attribute lived on the
  rook TILE. Without moving it, the last onboarding step would have spotlighted
  nothing. It is now on the entry, asserted unique.
- `trainingPathLabel` became orphaned and was deleted from **both** bundles.

### PART 2 — Mini-games separation, as CONTEXT-AWARE COPY

`consequenceMessage(consequence, surface)` gained a surface argument
(`"exercise_path"` default | `"featured_minigame"`).

| rung | exercise path | mini-game |
|---|---|---|
| `mastery` | Crown earned · **pick your next piece** | Crown earned |
| `challenge_unlocked` | New challenge unlocked · **it is on your path now** | New challenge unlocked |
| `lane_progress` | {n} of {m} challenges · the crown is at the end | {n} of {m} challenges cleared |
| `laneComplete` | Every challenge cleared · **your badge is waiting in Exercises** | Every challenge cleared · your badge is ready |

**Every rung still renders on both surfaces.** Only the tail that points *into
Exercises* is dropped. `badge_progress` has no variant and needs none — the
resolver emits it only for `completed.kind === "exercise"`, unreachable from a
featured card, and its copy names no destination.

**The milestone machine was NOT touched, and does not need to be** — verified by
reading, not assumed. `PROGRESSION_COPY["piece-badge-eligible"]` is *"Badge Ready
to Claim / Enough exercises cleared. The badge is yours."* with a `Claim Badge`
CTA that **claims in place** (`handleCelebrationPrimary`, no navigation).
`mastery` is *"Piece Mastered / Every exercise, every maze."* Neither pushes the
player anywhere. The founder's rule was already satisfied there.

### The surface kicker

`LabyrinthCompleteOverlay` gained `surface` and `challengeTitle`:

```
MINI-GAME                    EXERCISE
Training Complete!           Training Complete!
Two Roads                    …
★2/3  ♟4  🏆6                ★2/3  ♟4  🏆6
Every challenge cleared      Every challenge cleared ·
· your badge is ready        your badge is waiting in Exercises
```

Wired from `completionOriginRef` — **the same ref `handleLabyrinthContinue`
branches on**, so the label the player reads and the destination Continue takes
cannot drift apart.

### PART 3 — the `0/3` counter

The mission band counter now carries a star icon and
`aria-label="{n} of {total} stars on this board"`.

⛔ **"on this board" is the entire fix.** A bare `0 / 3` beside a level title
reads as *level 0 of 3*. The star ties the number to the three stars **drawn on
the squares in front of the player**. Verified live: the band reads
`Two Roads ★ 0 / 3 · 13 moves` over a board with exactly three stars.

⚠️ Deliberately **not** touched: the completion overlay's `★ 2/3` pill. That is
the run's GRADE, a different number from the sweep counter. Relabelling both the
same way would have introduced the confusion this pass removes.

### Contrast fix (INTRODUCED by this remediation, found and fixed in smoke)

Removing `margin-top: auto` from the entry (to close a ~100 px mid-page hole)
detached the bottom `.hub-home-scaffold::after` readability veil from the
content. On the **real** hub's bright forest wallpaper, the translucent panels
(`rgba(60,120,40,0.32)`) left cream text on sunlit grass.

⚠️ **The VR could not have caught this**: `/dev/learn-hub` paints those panels on
flat dark navy. Only opening the real app showed it. Both panels now carry an
opaque fill, and the two unpanelled headings (`MINI-GAMES`, the coming-soon row)
carry a shadow. A panel whose contrast depends on its Y position is not a panel.

---

### PART 1b — the rail (second smoke, same day)

The full-width Exercises row was the right hierarchy in the wrong FORM. Founder,
on seeing it: *"aquí estamos recurriendo al scroll cuando realmente no debería;
mira como PLAY sí lo resuelve bien."*

Both surfaces now render through **`HubActionTile`** — the exact component
PLAY's `RUTA DE JUEGO` rail uses — in one rail:

```
                LEARN PATH
 ┌────┐  │  ┌────┐ ┌────┐ ┌────┐
 │ 📖 │  │  │ ♜  │ │ ♝  │ │ ♛  │
 └────┘  │  └────┘ └────┘ └────┘
Exercises│  Rook    Pivot   N-Qns
         │   EARLY ACCESS · COMING SOON · …
```

| | before | after |
|---|---|---|
| bottom block (mini-games + exercise entry) | 185 px | **100 px** |
| 360×640 document overflow | 106 px | **15 px** |
| 360×640 Exercises entry bottom | 724 (84 px below fold) | **607 — inside the fold** |
| 390×844 overflow | 0 | **0** |

### The alignment pass (third smoke)

The first rail shipped visibly crooked. Founder: *"no sé por qué la parte de
abajo de shortcuts se ve tan desalineada."* Three defects, ONE structural cause,
all measured rather than eyeballed:

| symptom | measurement |
|---|---|
| mini-game tiles sat lower than Exercises | tops `575` vs `583` — the 8px `padding-top` added for the NEW badge |
| dead gap beside the divider | group box `248px` wide against `170px` of tiles → tiles centred inside it, 51px of nothing |
| the tag row was off-centre | footnote centre `233` vs the rail's `195` |

**Cause:** the tiles and the footnote lived inside one column box, so the box
was as wide as its WIDEST child — the footnote — and the tiles were centred
inside that width instead of sitting against the divider.

**Fix:** `MiniGamesSection` returns a **fragment**. The tile group and the
footnote became siblings in the rail row, so the group is exactly as wide as
its tiles, every tile is a direct child on ONE baseline, and the footnote takes
its own line (`flex: 0 0 100%`) centred on the rail. Badge clearance moved to
the row, where it shifts every tile equally.

After: tops `581`/`581`, gaps `12px`/`12px`, footnote centre `195` = rail centre.

⚠️ **And the word "Mini-games" had vanished from the home.** Once the cards
became tiles it survived only in an `aria-label` — the separation signal this
pass exists to create was gone from the screen, and a bare "EARLY ACCESS" pill
sitting on a centred line next to the Exercises tile read as if it labelled
Exercises too. The pill now names its own subject: **`MINI-GAMES · EARLY
ACCESS`**. Copy, not an alignment trick — it cannot drift out of position.

⛔ **ONE RAIL IS NOT ONE SURFACE.** The divider and the EARLY ACCESS tag are
structure, not decoration: they are the only things keeping "Exercises" and
"Mini-games" legible as two destinations now that they stopped being two blocks.
Their ORDER is pinned by a test and by the driven smoke, because dropping the
divider would break nothing visible — every tile would still work.

**Icons are BUILDER SLOTS, per the founder's note** ("con su espacio en el
builder para actualizarlos de manera sencilla"). Seven new
`ThemeAssetKey`s — `hub.learn-entry` plus one `hub.minigame.*` per engine,
**including the two coming-soon ones**, so an engine that ships later needs no
registry change to get an icon. Swapping any icon is now a `default` path edit
in `theme-registry.ts`, never a code edit.

⚠️ Defaults today: `hub.learn-entry` → the existing `learning.png` (open book
with a check seal); the six mini-games → the piece sprites, because the piece IS
each game's identity and they are the only art that tells the three tiles apart.
**Bespoke mini-game icons remain an open ART REQUEST** — three at correct
resolution (never upscaled). When they land, only the slot defaults move.

⚠️ Adding slots moved **FOUR** pinned counts, not the three memory recorded:
`theme-registry.test.ts` (learn 37→44), `runtime-coverage.test.ts`
(totalSlots 186→193, initial B 90→97, connectedSlots 173→180), the
`audit-theme-runtime-coverage.mjs` guard itself, and the regenerated
`2026-07-18-theme-runtime-inventory.json`.

Two defects the rail introduced, both found by opening the real app and fixed:
- **the divider was invisible** — a 1px hairline at 0.45 alpha vanished on the
  sunlit wallpaper, so the rail read as four undifferentiated tiles. Now 2px,
  0.85, with a dark halo.
- **the NEW badges were clipped** — `overflow-x: auto` makes the tile row a
  scroll container, and a scroll container clips the OTHER axis too; the badge's
  own `overflow: visible` cannot escape it. Fixed with top clearance.

---

### The finishing pass (fourth smoke)

Four changes, all founder-directed except the last two, which are defects the
smoke exposed:

1. **Exercises icon → `/art/hub/train-pieces`.** ⛔ ONE LINE — the slot's
   `default` in `theme-registry.ts`. `learn-path-entry.tsx` was not touched,
   which is exactly what the builder slots were added for. It briefly shipped
   as a book (`new-icons-chesscito/learning`), which named nothing the player
   had seen before. The new art is the same face the TRAINING side of the mode
   switch wears, and that repetition is ACCEPTED: the chrome differs completely
   (segmented pill + text vs square tile + caption plate), they sit ~316 px
   apart, and TRAINING is genuinely the mode that contains Exercises. Against
   three bare piece sprites, a piece **on a board with a completion seal** is
   what marks the rail's primary as "the structured path".

2. **The tile keeps the name `Exercises`, not `Learn`.** Sally's call, and the
   reason is not "five other strings say it". *Learn* names a PLACE; *Exercises*
   names an ACT, and a 50 px tile in a shortcut rail is a door to doing
   something. PLAY can repeat its word because *Play* is both mode and verb;
   *Learn* is only the mode the player is already standing in, so the tile would
   say "you are here" under a heading that already says LEARN PATH — and in ES
   it degrades further: *Ruta de aprendizaje → Aprender*.

3. **The whole footnote row was removed** (`MINI-GAMES · EARLY ACCESS` + the
   coming-soon roster). Founder: the pill was mis-placed and *"el minigames
   estaba apuntando a exercises y no aportaba lo que se esperaba"* — on a
   centred line whose left neighbour is the Exercises tile, it read as if it
   labelled Exercises. ⚠️ Two things went with it: the word "Mini-games" is now
   only this group's accessible name, and the EARLY ACCESS framing is off the
   surface. `MINIGAMES_COPY` and the `comingSoon` prop are untouched, so
   restoring the label is a render change.

4. **The rail is pinned to the floor again** — `margin-top: auto`, the same one
   line `.play-hub-path` uses. Removing it was right while the entry was a
   full-width 64 px row (it opened a ~100 px hole mid-page); it is wrong for a
   100 px rail that reads as the baseboard. On a tall screen the space between
   card and rail is now the forest wallpaper and the winding path — verified
   against the REAL app, because the `/dev/learn-hub` fixture paints flat navy
   there and makes the same layout look empty.

⛔ **A JSX COMMENT THAT WASN'T ONE, SHIPPED TO THE SCREEN.** The rationale for
removing the footnote was written as `/* … */` between JSX children — where it
is **literal text**, not a comment. It type-checked, all 8 744 tests stayed
green, and the whole paragraph painted itself across the Learn home. Only
opening the real app caught it.

Fixed with `{/* … */}`, and pinned by a new guard that was **proved red first**:
re-introducing the bug fails with
`'Rook RailNewPivot RunN-QueensNew/* ⛔ …'`. The guard asserts SHAPE, not one
string — no `/*`, `*/`, `⛔`, `⚠️`, `founder` or `TODO` may reach the DOM.

⚠️ **`next build` catches what `tsc` and Vitest do not.** An
`eslint-disable-next-line @typescript-eslint/no-unused-vars` naming a rule this
project does not configure failed the production build only. `comingSoon` is now
simply left out of the destructuring — a binding nobody names needs no
suppression.

⚠️ **Playwright's `webServer` runs `pnpm dev`, which overwrites `.next`.** After
any Playwright run that started its own server, `pnpm start` fails
(`Cannot find module for page: /_document`) until the production build is redone.
Budget a rebuild between the VR pass and the smoke pass.

### The mini-game icons landed — and nearly took the chessboard with them

The three bespoke icons arrived (maze + route + stars; diagonal with a marked
pivot; crowns placed on a board) and they do the job the piece sprites could
not: they name the MECHANIC, so a beginner who cannot yet tell a bishop from a
queen can still tell the three games apart. Their green tiles also restored, by
colour alone, the group separation that left with the `MINI-GAMES · EARLY
ACCESS` pill — gold primary, green mini-games, divider between.

⛔ **BUT THEY LANDED ON `/art/redesign/pieces/w-{rook,bishop,queen}`** — the
files `board.piece.white.*` draws the actual chessboard from. For a few minutes
the white rook ON THE PLAYING BOARD was a maze tile, and so were the pieces in
the badge sheet, the result overlay, the mastery tiles and the diagonal-run
board.

**Nothing failed.** The triplets were valid, `tsc` was clean, all 8 741 tests
stayed green, and `catalog-assets-on-disk` passed because the files existed.
Only opening the art file showed it.

Recovered without losing either side:
1. the three icons were copied to **`/art/minigames/{rook-rail,pivot-run,n-queens}`**
   (all three formats) BEFORE anything was reverted;
2. `git checkout` restored the piece sprites;
3. the three `hub.minigame.*` slot defaults now point at `/art/minigames/`.

⚠️ **The proof it worked is a NEGATIVE VR result**: after the swap only the four
`vr18-learn-hub-*` baselines moved. Every board, badge-sheet and overlay
baseline stayed green — which they could not have done if the sprites were still
mazes. That is worth more than any screenshot.

⛔ **Why the collision was possible at all**: the six `hub.minigame.*` slots
shipped with piece-sprite paths as their defaults, so "replace the mini-game
icon" and "replace the board piece" pointed at the same file. They no longer do.
`safe-path`, `knight-tour` and `promotion-run` still default to piece sprites —
they have no bespoke art yet, and none of the three renders today (safe-path is
outside rotation 1; the two coming-soon engines lost their row). **When their
icons arrive, put them under `/art/minigames/` too — never over a piece.**

---

## 3. Verification

| gate | result |
|---|---|
| `pnpm exec tsc --noEmit` | **clean, exit 0** |
| Vitest (full) | **704 files / 8741 passed + 1 todo (8742), exit 0, 140 s** — 8 744 − 4 obsolete cases (they asserted the removed footnote) + 1 new commentary guard |
| Worker failures | **0** (`Failed to start forks worker` / `Timeout waiting for worker` both absent) |
| VR | **68/68, `--project=minipay --update-snapshots=none`** |
| VR baselines | **82** (81 before + 1 new); the 4 `vr18-learn-hub-*` re-recorded again for the rail, each `-actual.png` inspected first |
| Driven smoke + viewport specs | **6/6**, against a PRODUCTION build |

Session baseline for comparison: predecessor pass measured 703 / 8732 + 1. The
**file count only ever rose** (703 → 704), so the runs are trustworthy under the
repo's own rule.

New tests:
- `lib/training/__tests__/consequence-surface.test.ts` (7) — the copy MAPPING,
  including a guard that the path copy did **not** drift to match the mini-game
  copy (otherwise the other assertions go green by vacuum).
- `featured-completion-boundary.test.tsx` AC-11 / AC-12 (6 → 8) — the WIRING,
  which no pure test can see.
- `hub-lite-scaffold.test.tsx` — one door, no roster, tour anchor unique, tap
  handler, DOM order vs Mini-games.
- `e2e/smoke-learn-separation.spec.ts` — the four flows, driven.
- `vr13-labyrinth-minigame` baseline — **paired** with
  `vr13-labyrinth-consequence` at identical numbers, so the two can differ only
  in surface treatment.

Tests re-pointed, not deleted: *"a completed daily informs without disabling…"*
and the tour-anchor test both protected guarantees that outlived the roster.

---

## 4. Manual smoke — outcome by flow

**⛔ Run against a PRODUCTION build.** See §5.1.

| flow | result |
|---|---|
| **A — Learn Home** | ✅ Mini-games and Exercises are one door each, in that order; `.reward-tile` count is **0**; entry is 64 px (≥44 tap floor) and reads "EXERCISES / 0 of 6 pieces mastered". |
| **B — Featured mini-game** | ✅ Tapping *Rook Rail* routes to `?content=rook-rail-two-roads&featured=early-access-1`, and **the board that mounts is that challenge** (`data-labyrinth-id` asserted, not just the URL). Counter announces "stars on this board". Continue / X → Learn Home and Retry → same challenge are pinned by AC-3/4/5; AC-11 pins the MINI-GAME kicker and the absence of all three path tails. |
| **C — Exercise path** | ✅ The entry lands on `/exercises?piece=…` with **no** `featured` and **no** `content`. AC-6 pins that its continuation is unchanged; AC-12 pins the EXERCISE kicker. |
| **D — 360×640** | ✅ Both surfaces present and ordered; **zero horizontal overflow**; entry bottom = **607, inside the fold** (was 724 before the rail). Residual document overflow is 46 px and it is the coming-soon roster alone — see §5.2. At 390×844 overflow is **0**. |

---

## 5. Findings, classified

### 5.1 A featured card lands on lane-1 exercise 1 — **PREEXISTING, DEV-ONLY**

Reproduced from the real hub under `pnpm dev`: tapping *Rook Rail* opened *"Move
your Rook to h4"* (lane-1 exercise 1) instead of *Two Roads*.

**It does not affect production.** Traced hop by hop with instrumentation, not
guessed:

- the deep link resolves (`featured: true`), the node exists, the request
  returns `start`, and execution **reaches `setLabyrinthMode(true)`** — yet the
  committed state stayed `false`;
- cause: `next.config.js` sets `reactStrictMode: true`, so **in development**
  React invokes effects twice. The `[selectedPiece]` reset effect
  (`exercises-screen.tsx:830`) clears the mode on its second pass, and the
  deep-link effect cannot recover because `implicitContentRequestRef` already
  recorded the request;
- production build, same probe, same URL: `bandText: "Two Roads 0 / 3 · 13
  moves"`. ✅

⚠️ **I initially called this the root cause of the founder's complaint #4. That
was wrong** and is corrected here. Both the reset effect and the ref guard
predate the Mini-games surface.

**Debt, explicitly scoped**: the dev-only divergence is real and will make the
next person "reproduce" a shipping bug that does not exist. The fix is to let the
deep-link effect re-establish itself after a mode reset (or to make the reset
effect skip its mount pass). Not attempted here — it is inside the screen's
effect ordering, well outside a surgical labelling pass.

### 5.2 46 px of residual scroll at 360×640 — **ACCEPTED, and it is only the coming-soon roster**

RESOLVED for the entry itself: the rail put the Exercises tile at bottom 607,
inside the 640 fold (it was 724). Residual overflow is 41 px. What still sits below the fold is the
`COMING SOON · Knight's Tour · Promotion Run` line, which wraps to a second row
at 360 and fits on one at 390.

That line is the least consequential thing on the page and the only thing left
overflowing. Removing it is a PRODUCT decision (PLAY's rail has no equivalent),
not a layout one, so it is left for the founder rather than taken unilaterally.

The `REACHABLE_DESTINATIONS` tier stays: it asserts the entry **exists and
clears the 44 px tap floor** and **prints its position on every run**, so the
number can never rot into a silent assumption.

### 5.2b ⛔ A LEARN server left on 3002 POISONS the VR run — **PROCESS**

`reuseExistingServer: !CI` makes Playwright adopt whatever is already on 3002.
The smoke needs a server started with `NEXT_PUBLIC_CHESSCITO_MODE=learn`; the VR
does not, and must get the config's own `webServer.env`.

Leaving the LEARN production server up during a VR run turned `about-page`,
`terms-page` and `privacy-page` red — **navigation timeouts, not pixel diffs**,
on pages sharing no code with this work — and a `--update-snapshots=changed` in
that state re-recorded `frame-tablet-600` and `support-page`, two baselines
nothing in this pass touches. Both were restored from git; the run was redone
with the port free and came back **68/68**.

⚠️ This is the same family as the orphan-server incident the predecessor audit
recorded, with a new twist: the poison here was a server *I* started on purpose
for the smoke, not a leftover. The rule, in order: **kill your server → run the
VR → start a LEARN server → run the smoke.**

### 5.3 `.env.local` runs the repo in FULL mode — **PREEXISTING, worth knowing**

`apps/web/.env.local` ships `NEXT_PUBLIC_CHESSCITO_LITE_MODE=false`, so a plain
`pnpm dev` serves the **FULL** hub, not LEARN — a different screen with no
Mini-games section at all. The first smoke run measured that screen. The spec now
guards it with a one-line failure message.

### 5.4 Residual mixing signal — **PREEXISTING, not addressed**

Inside a featured mini-game the persistent HUD still reads `Exercises` (back
label) and `Rook 0/8` (the lane-1 exercise counter). Small, but it is the same
family of confusion. Left alone deliberately: that HUD is shared by every board
in the screen and changing it is not surgical.

---

## 6. Guard rails honoured

**PAYMENTS / PEONES / PRO / P2P / SHOP TOUCHED:** NO.
**DB MIGRATION:** NONE.
**TELEMETRY EVENT FAMILIES ADDED:** 1 — `hub_exercises_entry_tap`, the new door's
tap.
**THEME SLOTS ADDED:** 7 (`hub.learn-entry` + six `hub.minigame.*`), so every
rail icon is swappable from the builder. `minigames_open`, `minigame_start` and the single-emitter
`labyrinth_complete` are unchanged.
**CONTENT MOVED BETWEEN LANES:** NONE.
**PUSHED / DEPLOYED:** NO.

---

## VERDICT

**Ready for a deploy candidate**, against the founder's own exit rule:

```
HOME
├── MINI-GAMES  → featured challenge → mini-game result → replay / back to home
└── EXERCISES   → piece progression → exercises → badge / mastery / next piece
```

Both branches now hold without contradiction, and a board says which one it
belongs to. Two items carried forward, both scoped in §5.1 and §5.2, neither
blocking.
