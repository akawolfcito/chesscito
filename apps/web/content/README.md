# Puzzle content authoring

Two sources feed the generated catalog (`src/lib/game/generated/puzzles.generated.ts`),
which AUGMENTS (never replaces) the hand-authored content in `lib/game/exercises.ts`:

- `labyrinths.json` — written by the **Labyrinth Builder** (`/dev/labyrinth-builder`).
- `puzzles.csv` — bulk authoring (e.g. a Google Sheet export). Currently header-only.

Regenerate the committed catalog any time with: `pnpm import-puzzles`
(validates every puzzle with BFS; fails on unsolvable/invalid/duplicate-id).

## Labyrinth Builder (recommended) — `/dev/labyrinth-builder`
Dev-only page (404 in production). Workflow:
1. Pick the piece, then paint **start**, **goal**, **walls** (and **captures** for pawns)
   on the flat 8×8 grid. Open cells you leave off the path are the "false branches".
2. The optimal route + move count compute live (same BFS as the game). Use **trace**
   to lay your intended route — a warning fires if there's an accidental shorter path.
3. Set `order` (controls position in `/exercises`; pick one that doesn't collide with
   the listed existing ids) and an optional EN `explanation`.
4. **Save** → POSTs to `/api/dev/labyrinth`, which upserts `labyrinths.json` and
   regenerates the catalog. Refresh `/exercises` to see it.
5. **Commit** the changed `content/labyrinths.json` + `src/lib/game/generated/puzzles.generated.ts`.

## Role convention (shared by both sources)
A puzzle is a FEN board + a `target` square. In the FEN:
- **white** = the mover (the piece of the lesson's type) + obstacles (other white pieces).
- **black** = capturable pickups — honored **only for `pawn` movers** (the engine ignores
  captures for other pieces; the importer rejects black pieces on a non-pawn lesson).
- Always provide an explicit **mover** square when more than one white piece of the
  lesson type is on the board (the Builder always emits it).
- `optimalMoves` is computed by BFS — never hand-entered.

## `puzzles.csv` columns
`kind` (exercise|labyrinth) · `piece` · `fen` (quote it — contains spaces) · `target` ·
`mover` (optional) · `tier` (easy|medium|hard) · `tags` (comma) · `explanation` (EN) · `id` (optional; else a content-hash id).

Specs: `docs/superpowers/specs/2026-06-16-fen-puzzle-content-pipeline-design.md`,
`docs/superpowers/specs/2026-06-16-labyrinth-builder-design.md`.
