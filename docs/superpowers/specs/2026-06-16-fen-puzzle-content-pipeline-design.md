# Design — FEN puzzle content pipeline (curated, spreadsheet-authored)

**Date:** 2026-06-16
**Status:** Approved (architecture + augment-not-replace), ready for implementation plan.
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
- **Role convention (in the FEN):** **white = the mover + obstacles**, **black
  = capturable pickups**. The mover is the single white piece whose type equals
  the row's `piece` (the lesson). All other white pieces are obstacles (friendly
  blockers, impassable, non-capturable). Black pieces are `captureTargets`.
- **target:** a separate field (FEN cannot mark a goal square).
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
| `fen` | yes | standard FEN. White = mover + obstacles; black = capturable pickups |
| `target` | yes | algebraic goal square, e.g. `h8` |
| `tier` | yes | `easy` \| `medium` \| `hard` |
| `tags` | no | comma-separated kebab-case tags (e.g. `straight-line,detour`) |
| `explanation` | no | EN pedagogical note; surfaced as the exercise objective/description |
| `id` | no | stable id override; if blank, auto-generated `{piece}-gen-{NNN}` (deterministic by import order within piece, offset past existing hand-authored ids) |

**Mover resolution:** the mover = the unique white piece of type `piece`. If
zero or more than one white piece of that type exists, the row is rejected with
a clear error (ambiguous mover). `isCapture` is inferred true when the target
square holds a black piece or any `captureTargets` exist for a pawn.

**Example row (rook detour labyrinth):**
`labyrinth,rook,"7R/8/8/8/8/8/8/R6r w - - 0 1",h1,medium,"detour,blocked-file","Go around the blocker to reach h1.",`
(here the white rook on a1 is the mover, the white rook on h8 is an obstacle,
the black rook on h1 is the capturable goal — illustrative; real rows validated
by BFS.)

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
- Emit `apps/web/src/lib/game/generated/puzzles.generated.ts` — a typed export
  (`GENERATED_EXERCISES`, `GENERATED_LABYRINTHS`) grouped by piece. File header
  marks it generated ("do not edit by hand").
- Idempotent: same CSV → same output (stable ordering + ids).

### 3. Catalog merge (`apps/web/src/lib/game/exercises.ts`)
Merge generated arrays into the per-piece exported catalogs AFTER the existing
hand-authored entries (augment). Existing ids and ordering are untouched, so
`use-exercise-progress` migration keeps padding new entries with 0★ and the
daily rotation engine (`rotation.ts`) picks them up with no change.

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

## Testing

- `fen-puzzle.test.ts`: mapper correctness per the color=role convention
  (mover detection, obstacles, captureTargets, target), and each error case
  (invalid FEN, ambiguous mover, off-board/own-square target).
- `import-puzzles.test.ts`: CSV parsing (quoted fields), BFS optimalMoves
  computation, rejection of an unsolvable puzzle, duplicate-id detection,
  deterministic output.
- Existing BFS verifiers extended to cover the generated catalog.

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
