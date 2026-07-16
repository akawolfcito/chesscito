# Build plan — Safe Path (king) + Promotion Run (pawn)

**Date:** 2026-07-16 · **Parent spec:** `docs/specs/2026-07-16-signature-games-spec.md` §3/§4
**Status:** ✅ **APPROVED — founder decided 2026-07-16** (§3 rewritten from open questions to
settled decisions). Safe Path is cleared to build; Promotion Run's threat model (Q2) stays open
and does **not** block Safe Path.

This plan exists because reading the code moved two things the parent spec assumed. Both
change the shape of the work, so they are settled here before TDD starts.

---

## 1. What the code actually says (verified, not assumed)

### 1.1 The surgery is smaller than the spec implies — the FEN already carries types

The parent spec calls `{pos, piece}` "mid-high effort" and frames it as widening the puzzle
model. But `mapFenPuzzle` (`lib/game/fen-puzzle.ts:142-149`) **already reads `p.type` and
`p.color`** off the parsed FEN board — and then throws the type away:

```ts
for (const [sq, p] of board) {
  if (sq === moverSq) continue;
  if (p.color === "w") { obstacles.push(squareToPos(sq)); continue; }   // type discarded
  if (input.piece !== "pawn") throw new FenError(`black piece on ${sq}: ...`);
  captureTargets.push(squareToPos(sq));                                  // type discarded
}
```

**The content format needs no migration.** Levels are authored as FEN; FEN is typed by
definition. The only lossy step is this flattening. That is a much smaller job than "widen
the model + migrate the content".

### 1.2 The threat guard blocks Safe Path outright

`fen-puzzle.ts:146` throws `FenError` on **any** black piece when the mover is not a pawn.
Safe Path is a **king** surrounded by black enemies → **the import throws today.** This is a
prerequisite, not a detail; it is not mentioned in the parent spec.

### 1.3 No rules module survives the attack layer — all five fail, each differently

The handoff flagged `getQueenMoves`. The real scope is worse: **none** of `lib/game/rules/*`
can be reused for threats, and there is no attack layer anywhere in the tree today
(`grep attackedSquares` → empty).

| Module | Why it cannot serve attacks |
|---|---|
| `rook.ts:36-38` | `break` **before** `push` → the blocker's own square is excluded. But that square **is** attacked — capturing it is the point. |
| `bishop.ts:28` | Same `break`-before-`push`. |
| `queen.ts` | Just rook ∪ bishop → inherits both bugs. |
| `king.ts:29` | Filters blockers out of the result. Comment says it plainly: *"threats are NOT modeled in v0.1"*. |
| `pawn.ts` | **Worst.** It is a *movement* function: includes the forward push (which does **not** attack) and only yields diagonals when `isCapture` is true (a pawn attacks its diagonals **always**, occupied or not). Also hardcodes white-moves-up (`rank + 1`); Safe Path enemies are black, moving **down**. |

**Conclusion: `attack-map.ts` is a new module, not a wrapper.** Attempting to reuse the
movement rules would ship a threat layer that under-reports every ray by exactly one square —
the most dangerous square, the one with the enemy on it.

### 1.4 The king must not block his own attack map

Classic chess subtlety with real teeth here: when computing which squares are attacked **for
the purpose of king movement**, the king must be **excluded from the blocker set**. Otherwise
the square directly behind him along an enemy ray reads "safe", and the game teaches the
exact opposite of the king's identity.

**Consequence (good):** with enemies static *and* the king excluded, the attack map is a
**constant per level** — computed once at load, never recomputed on a move. BFS over safe
squares is then trivial. This is what makes Safe Path cheap **provided the king cannot
capture** (see Open Questions Q1).

---

## 2. Design decision: additive, not surgery

`obstacles` / `captureTargets` have **27 + 15 references across 13 files** (`exercises-screen`,
`exercise-bfs`, `catalog`, `lint`, `notation`, `daily-puzzles`, the four boards,
`labyrinth-builder/validate`, `test-utils/bfs-optimal`).

**Do not change their meaning.** Add a new optional field:

```ts
export type TypedEnemy = { pos: BoardPosition; piece: PieceId };

export type MappedPuzzle = {
  // ...unchanged...
  obstacles?: BoardPosition[];      // untouched — 27 callers keep working
  captureTargets?: BoardPosition[]; // untouched — 15 callers keep working
  enemies?: TypedEnemy[];           // NEW: typed, only the threat kinds populate it
};
```

Every existing consumer is untouched; only the two new games read `enemies`. This follows the
same instinct as the `COVERAGE_KINDS` predicate (`fen-puzzle.ts:59`) — widen by adding a
concept, not by bending the one in place.

**Rejected:** retyping `obstacles` to `TypedEnemy[]`. It would touch 13 files for zero gain to
12 of them, and A9 already refused that same surgery once (handoff 2026-07-14 §2/§3).

---

## 3. Settled decisions (founder, 2026-07-16)

The founder's own framing, verbatim, is the contract:

> "el rey es el personaje que quieres sacar del peligro, la meta es un refugio, las piezas
> enemigas no se mueven, pero vigilan zonas del tablero. […] **un laberinto de peligro, no
> necesariamente de muros.** No sería 'no puedes pasar porque hay una pared' sino 'puedes pasar
> físicamente por ahí, pero es una zona vigilada, así que no debes hacerlo'."

| # | Decision |
|---|---|
| **D1** | **Enemies are static and untouchable — the king never captures.** The attack map is a **constant per level**, computed once at load. |
| **D2** | **Watched squares are INVISIBLE to the player.** Same call as N-Queens' safe-square dots (`2a47bf30`: *"stop giving the puzzle away"*). |
| **D3** | **The map IS rendered in `/dev`**, so the founder can author good levels fast. Same data, different viewer — a debug flag, not a second computation. |
| **D4** | **Stepping on a watched square is LEGAL and LOSES.** The attack fires, the player is caught. This overrides parent spec §3's *"may never enter an attacked square"* (which specified a silent rejection). |
| **D5** | **On loss → TRY AGAIN overlay → back to the START square.** Losing at step 9 of 10 costs the whole run. Founder: *"ni modo"*. |
| **D6** | **Shields are in the MVP** (see §3.1 — they are nearly free). |
| **D7** | **Auto-queen** on promotion. No piece-choice menu in MVP. |

### 3.1 Why shields are cheap — the flow already exists

`lib/exercises/use-fail-rescue.ts` already orchestrates fail → modal → **shield spend
(server-authoritative, `POST /api/shields/spend`) → peones fallback**
(`lib/peones/shield-spend-fallback.ts`), and is **already wired into `exercises-screen.tsx`** —
the very host Safe Path plugs into. The hook is deliberately generic: it takes `onRescued` /
`onSkipped` and its own docblock states it is decoupled from board state "to keep this hook
testable". **Integration = passing two callbacks.** The founder's "unless it raises effort too
much" condition is not triggered; do not defer it.

### 3.2 Why D2 (invisible) is not unfair — a correction on the record

An earlier draft of this plan argued hidden zones + lethal steps = blind trial and error, and
recommended against it. **That was wrong.** The enemy *pieces* are visible on the board; the
watched squares are a **deduction**, not hidden information. Highlighting them performs the
reading for the player, and reading the threat **is** the skill the game teaches. Real chess
highlights nothing. The founder's call is also consistent with the N-Queens precedent.

### 3.3 Still open — Promotion Run only (does NOT block Safe Path)

**Q2 — does Promotion Run use the attack map, or a flat lethal-square set?** The parent spec
says the two games "share the attack layer", then defines the pawn's rule as *"stepping on one
loses"* — a lethal-square set, not an attack map. The pawn also **captures** (its only way to
change file), so any enemy it removes would mutate a shared map → dynamic, the very thing D1
avoids. **These may be two concepts under one name.** Decide at stage 7; Safe Path does not
wait on it.

---

## 4. Build order

Staged TDD, one atomic commit per stage, full suite before each.

| # | Stage | Test first |
|---|---|---|
| 1 | `TypedEnemy` + `enemies` on `MappedPuzzle`; stop discarding the type in `mapFenPuzzle`; widen the `:146` guard for threat kinds | fen round-trip keeps types; existing 27 consumers unaffected |
| 2 | `lib/game/attack-map.ts` — `attackedSquares(enemies) -> Set<square>` | **per piece**: ray includes the blocker square; pawn attacks diagonals-only and **downward** (enemies are black); king excluded from blockers (§1.4) |
| 3 | `lib/game/safe-path.ts` — legal king steps, `isCaught(pos)` (D4), BFS `optimalMoves` over safe squares | unreachable refuge; refuge itself watched; king boxed in; **stepping on a watched square is legal and loses** |
| 4 | Content: `safe-path` kind + placeholder levels; `import-puzzles` BFS-verifies | lint gate; **solver-measured** achievability, not BFS reachability |
| 5 | `safe-path-board.tsx` (reuse `<GameBoard>`, hoist status via `onBandChange`); zones hidden (D2); `/dev/safe-path` probe **renders the map** (D3) | probe photographs the mechanic standalone |
| 6 | Host wiring from the runtime catalog (never id/prefix — B4.2.1); **`use-fail-rescue` on caught → `onRescued` = reset to start, `onSkipped` = reset to start minus a star** (D5/D6); i18n EN/ES; E2E | rescue modal fires on caught; shield spend resets the board |
| 7..n | Promotion Run — same ladder, scope set by §3.3 Q2 | |

**Grading:** Safe Path is arrival-graded → reuse `labyrinthStars`. It is **not** a coverage
kind; do not add it to `COVERAGE_KINDS`.

---

## 5. Traps carried in from memory (do not rediscover)

- ⚠️ **Reachable (BFS) ≠ achievable by the player.** A level can pass the catalog and be
  unplayable. Measure with a solver. (`feedback_reachable_is_not_achievable`)
- ⚠️ **Regenerating `puzzles.generated` does not invalidate the `unstable_cache` "content"
  tag.** Clear `.next` or the e2e goes falsely green. (`project_catalog_cache_staleness`)
- ⚠️ **Two `number` metrics of opposite meaning** reuse without a type error and lie silently.
  `optimalMoves` (lower = better) vs a coverage percentage (higher = better) must never meet.
  (`feedback_same_shape_number_wrong_meaning`)
- ⚠️ **Spatial content is designed by hand**; metrics are a filter, not a generator.
  (`feedback_metrics_dont_make_a_maze`)
- ⚠️ A "one modal at a time" test must count `[aria-modal="true"]`, never `role="dialog"`.
