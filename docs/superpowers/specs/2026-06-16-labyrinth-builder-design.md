# Design — Labyrinth Builder (dev-only visual + written authoring tool)

**Date:** 2026-06-16 · **Status:** Approved + red-teamed vs code (B1-B6 resolved),
ready for implementation plan. · Author: Wolfcito 🐾 @akawolfcito

**Extends** `docs/superpowers/specs/2026-06-16-fen-puzzle-content-pipeline-design.md`
(the FEN→Exercise mapper + BFS validation + generated-catalog-merge are the data
backbone; this spec adds the visual editor, the live validation UX, the dev save
API, and author-controlled ordering).

## Problem / goal

The current labyrinths are hand-edited TS literals and several play badly. The
founder wants to author/repair labyrinths through BOTH a written format AND a
visual board, validate them automatically, and have a saved labyrinth appear in
`/exercises` in a chosen order without disturbing existing content. Concretely
(founder's 7 steps): pick piece → set start + goal → trace a valid path → wall
off everything unused → leave 1-2 false branches → compute optimal with BFS →
validate there's no accidental shorter solution → save → shows in /exercises in
the order chosen, augmenting (not replacing) what exists.

## Decisions (locked)

- **Surface:** a dev-only page `/dev/labyrinth-builder` (`notFound()` in
  production). NOT shipped to players.
- **Persistence:** **a dev-only API writes to a content file in the repo**, then
  regenerates the committed catalog → the puzzle appears in `/exercises` on the
  next dev hot-reload. Content stays in-repo (committed), no database.
- **Augment, not replace:** generated labyrinths append AFTER the hand-authored
  ones; existing ids/positions are never touched.
- **Order:** an explicit `order` integer per generated labyrinth, author-set;
  generated entries sort by `order` (then id) and sit after hand-authored.
- **Reuse the FEN backbone:** `mapFenPuzzle` (FEN→Exercise), `computeExerciseBfs`
  (the in-game solver — single source of truth), the generated-catalog merge.
- **Cell roles:** start, goal, wall (= obstacle); for `pawn` also capture target
  (the black-piece role). "False branches" are just open cells left un-walled —
  no separate type.

## Architecture / data flow

```
Visual board edits ─┐
                    ├─→ MappedPuzzle ─→ computeExerciseBfs (live) ─→ optimal + path overlay + warnings
Written FEN+target ─┘                                   │
                                                        ▼ (Save)
POST /api/dev/labyrinth (dev-only) ─→ upsert into content/labyrinths.json (with order)
                                   ─→ rebuild puzzles.generated.ts (buildCatalog over CSV + JSON sources)
                                   ─→ Next dev hot-reload ─→ /exercises shows it (augment)
```

Two content sources feed one generated catalog:
- `apps/web/content/puzzles.csv` — bulk authoring (Google Sheet export, FEN spec).
- `apps/web/content/labyrinths.json` — the Builder's source (array of records with
  `order`; easy programmatic upsert + reorder). The import/build reads BOTH.

## Components

### 1. Cell-role model + board state (`lib/labyrinth-builder/state.ts`, pure)
`BuilderState = { piece: PieceId; start: string | null; goal: string | null;
walls: string[]; captures: string[]; order: number; explanation?: string; id?: string }`.
Pure helpers: toggle a cell to a role, clear, and convert `BuilderState ⇆
PuzzleInput` (the FEN-spec input type) + `BuilderState ⇆ FEN+target` (via
`parseFenBoard`/board build) so the written field and the board stay in sync.
**RED-TEAM B5:** the FEN export ALWAYS emits an explicit `mover` (the start
square) so walls (rendered as white pieces of an arbitrary type) can never be
mistaken for the mover, regardless of which piece the lesson uses.

### 2. Live validator (`lib/labyrinth-builder/validate.ts`, pure)
Given a `BuilderState`: map to an `Exercise` (start→startPos, goal→targetPos,
walls→obstacles, captures→captureTargets, pawn isCapture), then run BFS.

**RED-TEAM B1 (verified):** `computeExerciseBfs` returns only `{ optimalMoves,
firstStep }` — NOT the full path. So we add a sibling `computeExerciseBfsPath`
in `lib/game/exercise-bfs.ts` that tracks each node's parent and reconstructs
the full optimal `BoardPosition[]` (same `getValidTargets` expansion, so it
agrees with the game). The validator uses it to overlay the route.

Returns `{ ok, optimalMoves, path, errors[], warnings[] }`:
- error: no start/goal, start===goal, unsolvable (BFS null), >1 white piece of
  the mover type with no explicit mover, black/capture role on a non-pawn.
- warning (step 7, RED-TEAM B2): the author may TRACE an intended path on the
  board (an ordered cell sequence). If the BFS optimal is SHORTER than the traced
  length ⇒ "there is a shorter path than intended (accidental shortcut)" so the
  author can wall it off. When no path is traced, the validator just shows the
  BFS optimal + overlay and the author eyeballs it.
The BFS `path` overlay is the core authoring aid — the author SEES the true
optimal route and adds walls until it matches the intended detour.

### 3. Editor UI (`app/dev/labyrinth-builder/page.tsx`, dev-only)
- **A FLAT 8×8 CSS grid (RED-TEAM B3), NOT the in-game perspective board.** The
  game board uses `board-geometry` with perspective foreshortening
  (`BOARD_V_GAMMA`) — cells aren't uniform squares, which makes precise
  cell-painting awkward. The editor uses a plain uniform grid (file a-h × rank
  8-1, a1 bottom-left to match the mapper). The perspective render stays a
  game-only concern; what ships to `/exercises` is the validated data, so the
  authoring grid does not need to look like the game board.
- Piece picker (rook…king). A role brush selector (start / goal / wall /
  capture) + a "trace path" mode (B2) to lay the intended route.
- Tapping a cell applies the active brush; the optimal path overlay + optimal
  count render live (validator on each change). Errors/warnings shown inline.
- A written field (textarea) for the FEN+target block: parse → load board; board
  edits → re-serialize the field. Bidirectional.
- Fields: `explanation` (EN), `order`, optional `id` (else content-hash id from
  the FEN spec). A list of the piece's EXISTING generated labyrinths with their
  `order` so the author places the new one correctly.
- "Save" button (disabled while `errors` non-empty) → POSTs to the dev API.
- `export const dynamic = "force-dynamic"`; `if (NODE_ENV === "production")
  notFound()`.

### 4. Dev save API (`app/api/dev/labyrinth/route.ts`, dev-only)
- Hard guard: `if (process.env.NODE_ENV === "production") return 404`. Writes
  ONLY under `apps/web/content/`. Localhost authoring convenience.
- POST body = a labyrinth record. Validates server-side via the same validator
  (never persist an unsolvable/invalid puzzle). On success: upsert into
  `content/labyrinths.json` (replace by id, else append; honor `order`), then
  rebuild `src/lib/game/generated/puzzles.generated.ts` via the FEN-spec
  `buildCatalog` over BOTH sources. Returns the saved record + new optimalMoves.
- The dev server hot-reloads the regenerated module → `/exercises` shows it.

### 5. Build + merge (extends the FEN spec)
`buildCatalog` ingests CSV rows + `labyrinths.json` records. Generated labyrinths
sort by `(order, id)`; merge appends them after hand-authored per piece in
`exercises.ts`. **RED-TEAM B6:** labyrinth progress is id-keyed
(`labyrinth-progress.ts`), so reordering generated labyrinths via `order` is
SAFE — no progress drift (the FEN-spec F4 index-drift caution applies to
EXERCISES, which are index-keyed; it does not constrain labyrinth ordering).
Existing 18 hand-authored labyrinths are untouched.

## Validation rules (the founder's steps 6-7)
- Solvable: `computeExerciseBfs` returns non-null (else block save).
- start ≠ goal; start/goal on board; mover unambiguous (or explicit).
- Non-pawn movers reject capture cells (FEN-spec F1).
- Shortcut guard: optional `expectedMin`; warn when BFS optimal is shorter.
- `optimalMoves` is always the BFS result — never author-entered.

## Red-team review (verified vs code, resolved)

| # | Finding | Status | Resolution |
|---|---------|--------|-----------|
| B1 | `computeExerciseBfs` returns only `{optimalMoves, firstStep}`, not the full path (`exercise-bfs.ts`) | DENIED original assumption | Add `computeExerciseBfsPath` (parent-tracking reconstruct) for the route overlay |
| B2 | Step-7 "no accidental shortcut" needs the author's INTENDED length to compare | Fixed | Optional "trace path" mode; warn when BFS optimal < traced length |
| B3 | Editing on the perspective game board is awkward (non-uniform cells) | Fixed | Editor uses a FLAT uniform 8×8 grid, not the perspective render |
| B4 | Dev API writes a source file at runtime (path/cwd, prod-safety) | Mitigated | Hard 404 in prod, path-locked to `content/`, dev-only HMR (documented) |
| B5 | FEN export of walls could collide with the mover type | Fixed | Always emit explicit `mover` on export |
| B6 | Reorder safety | Clarified | Labyrinth progress is id-keyed → reorder is SAFE (F4 index-drift is exercises-only) |

## Testing
- `state.test.ts`: brush toggles, BuilderState ⇆ PuzzleInput ⇆ FEN round-trip
  (incl. explicit `mover` on export, B5).
- `exercise-bfs.test.ts`: `computeExerciseBfsPath` returns a path whose length
  equals `computeExerciseBfs.optimalMoves` and whose steps are all legal (B1).
- `validate.test.ts`: solvable/unsolvable, start=goal, non-pawn-capture reject,
  shortcut warning when BFS optimal < traced-path length (B2), path correctness.
- `api/dev/labyrinth` test: 404 in production; upsert-by-id + append; rejects an
  invalid puzzle; regenerates the catalog; never mutates hand-authored entries.
- Reuse the FEN-spec mapper/build tests; existing BFS verifiers cover the merged
  catalog.

## Dependency / sequencing (important)

This tool sits ON TOP of the FEN-spec data backbone, which is NOT built yet (its
plan was deferred). So the implementation plan must sequence:

- **Phase A — FEN backbone (from the FEN-spec plan, the parts the Builder needs):**
  `fen-puzzle.ts` (`parseFenBoard`, `squareToPos`, `mapFenPuzzle`, `puzzleId`),
  `buildCatalog` (now ingesting BOTH `puzzles.csv` and `labyrinths.json`),
  `puzzles.generated.ts`, and the augment-merge into `exercises.ts`.
- **Phase B — Builder (this spec):** `state.ts`, `validate.ts`, the
  `/dev/labyrinth-builder` UI, and the `/api/dev/labyrinth` save+regenerate route.

Pulling Phase A forward is the founder's redirect (it was the "end" task) — the
Builder makes it worth doing now because the broken labyrinths are repaired
through the tool rather than by hand.

## Out of scope
- Shipping the builder to players (dev tool only).
- A generator that INVENTS labyrinths automatically (this is author-assisted;
  the author traces the path, BFS only validates).
- DB persistence / live prod editing without deploy.
- Procedural exercise generation; ES `explanation`; backfilling the 18 existing.

## Risks / notes
- **Dev-API safety:** the write endpoint MUST be inert in production (404) and
  path-locked to `content/`. It is a local authoring tool; never a prod surface.
- **Hot-reload:** "save → appears" relies on the dev server regenerating +
  reloading `puzzles.generated.ts`; in a built/prod app the file is static (as
  designed). The author commits `labyrinths.json` + the regenerated file.
- **Board orientation:** reuse `board-geometry` so the editor matches the in-game
  board exactly (FEN rank 8 → rank index 7, per the FEN-spec mapper).
- **Single solver:** validation uses `computeExerciseBfs` (the in-game rules), so
  the editor's optimal can never disagree with gameplay.
