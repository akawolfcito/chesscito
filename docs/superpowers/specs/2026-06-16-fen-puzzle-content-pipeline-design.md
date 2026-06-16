# Design — FEN puzzle content pipeline (curated, spreadsheet-authored)

**Date:** 2026-06-16
**Status:** Approved (architecture + augment-not-replace), red-teamed against
code (F1-F6 resolved), ready for implementation plan.
**Author:** Wolfcito 🐾 @akawolfcito

## Problem

Exercises and labyrinths are hand-authored as TypeScript literals in
`apps/web/src/lib/game/exercises.ts` (60 exercises, 18 labyrinths today),
BFS-verified in CI, no auto-generation and no import pipeline. Content is
finite: a motivated player can exhaust it in a day or two, which undercuts
retention and makes the app feel like a one-off analysis tool.

The founder wants a **curated, constantly-growing** content model: make it easy
to mass-produce *quality* puzzles without editing TypeScript by hand, keep the
existing BFS quality gate, and feed the existing daily-rotation engine. Not
procedural/infinite, not DB-backed — a low-friction authoring pipeline.

## Decisions (locked with founder)

- **Model:** curated flow (finite-but-growing), quality-first.
- **Authoring format:** **FEN** for the board position + a separate `target`
  square + optional EN `explanation`. FEN chosen so positions can be built in
  any board editor (lichess, etc.), pasted, and shared.
- **Role convention (in the FEN):** **white = the mover + obstacles.** The
  mover is the white piece whose type equals the row's `piece` (the lesson);
  when more than one white piece of that type exists, an explicit `mover`
  column (a square) disambiguates. All other white pieces are obstacles
  (friendly blockers, impassable, non-capturable).
  **Black pieces = capturable pickups (`captureTargets`) ONLY for `pawn`
  movers.** RED-TEAM F1 (verified in `board.ts:46-71`): the engine + BFS only
  honor `captureTargets` for pawns — rook/bishop/knight/queen/king ignore them.
  So for NON-pawn movers, black pieces are rejected by the importer (clear
  error: "captures unsupported for {piece}; model as obstacles"). v1 keeps the
  engine as the source of truth rather than silently mis-modeling captures.
- **target:** a separate field (FEN cannot mark a goal square). For pawn capture
  drills the target may be a capturable square; otherwise it is an empty goal.
- **Transport:** Google Sheet / Excel exported to **CSV**.
- **explanation:** **EN only** for now (ES falls back to EN); optional.
- **Architecture:** CSV → an import script → a **committed generated catalog**
  (`*.generated.ts`). BFS auto-computes `optimalMoves` and validates solvability
  at import. No runtime JSON load, no database.
- **Scope vs existing content:** **AUGMENT, not replace.** The current 60
  exercises / 18 labyrinths stay exactly as-is; generated content is merged in.
  No backfill of existing content into the pipeline (can be a later task).

## CSV schema

One row per puzzle. Header row required. Columns:

| column | required | values / notes |
|--------|----------|----------------|
| `kind` | yes | `exercise` \| `labyrinth` |
| `piece` | yes | `rook` \| `bishop` \| `knight` \| `pawn` \| `queen` \| `king` — the lesson the puzzle belongs to; also identifies the mover in the FEN |
| `fen` | yes | standard FEN. White = mover + obstacles; black = pawn-only capturable pickups |
| `target` | yes | algebraic goal square, e.g. `h8` |
| `mover` | no | square of the player's piece; REQUIRED only when >1 white piece of type `piece` is present (disambiguation — RED-TEAM F2) |
| `tier` | yes | `easy` \| `medium` \| `hard` |
| `tags` | no | comma-separated kebab-case tags (e.g. `straight-line,detour`) |
| `explanation` | no | EN pedagogical note; emitted to the descriptions map AND `objective` (see Component 2) |
| `id` | no | stable id override; if blank, auto-generated `{piece}-gen-{hash8}` where `hash8` is a short content hash of `kind+piece+fen+target+mover` (RED-TEAM F4: hash, NOT row order, so reordering the sheet never changes ids) |

**Mover resolution:** if `mover` is set, the mover is the white piece on that
square (must match type `piece`). Otherwise the mover = the unique white piece
of type `piece`; if zero or >1 exist and `mover` is blank, the row is rejected
(ambiguous mover). For non-pawn movers, any black piece in the FEN is rejected
(F1: captures unsupported). `isCapture` is set true only for pawn movers whose
target/`captureTargets` are capturable squares.

**Example row (rook detour labyrinth, knight obstacle so the mover is
unambiguous):**
`labyrinth,rook,"8/8/8/8/4N3/8/8/R6R w - - 0 1",h1,a1,medium,"detour,blocked-file","Slide around the knight to reach h1.",`
Here the FEN has two white rooks (a1, h1) + a white knight (e4). `mover=a1`
selects the a1 rook; the h1 rook and e4 knight are obstacles; `target=h1`. No
black pieces (non-pawn → captures unsupported). `optimalMoves` is computed by
BFS at import.

## Components

### 1. FEN → Exercise mapper (`apps/web/src/lib/game/fen-puzzle.ts`)
Pure, testable. Input: `{ kind, piece, fen, target, tier, tags, explanation }`.
Output: an `Exercise` (the existing type in `lib/game/types.ts`) with
`startPos`, `targetPos`, `obstacles?`, `captureTargets?`, `isCapture?`, `tier`,
`tags`, `objective`. Throws typed errors on: invalid FEN, ambiguous/missing
mover, target off-board, target on the mover's own square.

### 2. Import script (`apps/web/scripts/import-puzzles.ts`)
- Reads a CSV path (default `apps/web/content/puzzles.csv`).
- Parses rows (robust CSV: quoted fields, commas in tags/explanation).
- For each row: run the mapper → run BFS (`exercise-bfs.ts` /
  `computeExerciseBfs`) to compute `optimalMoves` and confirm solvability.
  Reject unsolvable puzzles and report row number + reason.
- Detect collisions: **fail** on duplicate ids (generated + hand-authored);
  **warn** (non-fatal) on duplicate identical positions (same fen+target).
- Emit `apps/web/src/lib/game/generated/puzzles.generated.ts` — typed exports
  (`GENERATED_EXERCISES`, `GENERATED_LABYRINTHS`) grouped by piece, **sorted by
  stable id** (RED-TEAM F4) so sheet row order never changes output order or
  array indices. File header marks it generated ("do not edit by hand").
- Also emit `GENERATED_EXERCISE_DESCRIPTIONS: Record<string, string>` (id → EN
  `explanation`) in the same file (RED-TEAM F3 — see Component 3).
- Idempotent: same CSV → byte-identical output (stable sort + content-hash ids).

### 3. Catalog merge + description wiring
- **Catalog (`apps/web/src/lib/game/exercises.ts`):** append the stable-sorted
  generated arrays AFTER the hand-authored entries (augment). Existing ids and
  positions are untouched, so `use-exercise-progress` migration keeps padding
  new entries with 0★ and `rotation.ts` picks them up unchanged. Because
  exercise progress is **index-keyed** (RED-TEAM F4, verified in
  `use-exercise-progress.ts`), generated entries are append-only and stably
  sorted — never reordered between imports — so saved stars never drift.
  Labyrinth progress is **id-keyed** (`labyrinth-progress.ts`), already safe.
- **Descriptions (RED-TEAM F3):** the exercise drawer renders
  `EXERCISE_DESCRIPTIONS[id]` (verified in `exercise-drawer.tsx:300`), NOT
  `exercise.objective`. So the per-exercise description lookup must merge
  `GENERATED_EXERCISE_DESCRIPTIONS` on top of the hand-authored
  `EXERCISE_DESCRIPTIONS`. Generated explanations are EN-only; ES falls back to
  EN (acceptable per the EN-only decision). Rows without `explanation` fall back
  to the existing "Exercise N" generic label (no regression).

### 4. Validation / CI
- The existing BFS verifiers (`exercises-bfs-verifier.test.ts`,
  `labyrinths-bfs-verifier.test.ts`) run over the COMBINED catalog, so every
  generated puzzle's `optimalMoves` is re-checked in CI.
- The import script is the first gate (fails fast on bad rows); CI is the
  second (guards against a stale/hand-edited generated file).
- A test asserts the generated file is in sync with the CSV (re-run import in a
  temp dir, diff) so the committed catalog can't drift from its source.

## Data flow

Sheet (author) → export CSV → `pnpm import-puzzles` → mapper + BFS validate →
`puzzles.generated.ts` (committed) → merged into catalog → rotation/UI consume
→ CI BFS re-verifies. Author workflow: edit sheet → export → run script →
review diff → commit.

## Red-team review (verified against code, resolved)

| # | Finding | Status | Resolution |
|---|---------|--------|-----------|
| F1 | `captureTargets` honored ONLY for pawns (`board.ts:46-71`); other movers ignore them | DENIED original assumption | Black pieces = capturable for `pawn` only; rejected for non-pawn movers (model as obstacles) |
| F2 | Same-type white obstacle makes the mover ambiguous (the first draft's own example was invalid) | Fixed | Optional `mover` square column; required when >1 white piece of the type |
| F3 | Drawer reads `EXERCISE_DESCRIPTIONS[id]`, not `objective` (`exercise-drawer.tsx:300`) → generated explanation would show "Exercise N" | Fixed | Emit `GENERATED_EXERCISE_DESCRIPTIONS`, merged into the descriptions lookup |
| F4 | Exercise progress is index-keyed (`use-exercise-progress.ts`) → reordering drifts saved stars; labyrinths are id-keyed (safe) | Fixed | Content-hash ids + stable sort + append-only; never reorder generated exercises |
| F5 | optimalMoves BFS vs in-game solver could diverge | CONFIRMED SAFE | BFS uses the same `getValidTargets` (`board.ts`) the game uses — single source of truth |
| F6 | CSV must be committed; FEN contains spaces (quote in CSV); target-on-capture handling | Noted | CSV committed at `apps/web/content/puzzles.csv`; importer requires quoted `fen`; pawn target-capture handled per F1 |

## Testing

- `fen-puzzle.test.ts`: mapper correctness per the convention (mover detection,
  `mover` override, obstacles, pawn `captureTargets`, target), and each error
  case (invalid FEN, ambiguous mover with no `mover` column, **black piece with
  a non-pawn mover**, off-board/own-square target).
- `import-puzzles.test.ts`: CSV parsing (quoted FEN + commas in tags), BFS
  optimalMoves computation, rejection of an unsolvable puzzle, duplicate-id
  **fail** + duplicate-position **warn**, content-hash id stability, and
  **byte-identical output when sheet rows are reordered** (F4 guard).
- `import-descriptions` test: `GENERATED_EXERCISE_DESCRIPTIONS` surfaces in the
  drawer lookup for a generated id (F3 guard).
- Existing BFS verifiers extended to cover the combined catalog.

## Out of scope (explicit)

- Procedural/infinite generation (not this design).
- DB-backed content / live editing without deploy.
- Backfilling the existing 60/18 into the pipeline.
- ES translations of `explanation` (EN-only now; ES later).
- An in-app authoring UI (the Sheet IS the authoring surface).

## Risks / notes

- **Ambiguous mover** is the main authoring footgun → the mapper fails loudly
  with the row number; document the convention at the top of the CSV/template.
- **Board rendering**: obstacles/captureTargets render as generic blockers /
  pickups (not as their FEN piece type) — acceptable for pre-chess drills and
  matches today's behavior.
- **Daily rotation** draws from the per-piece pool; as the pool grows, variety
  improves automatically (deterministic, no change needed).
