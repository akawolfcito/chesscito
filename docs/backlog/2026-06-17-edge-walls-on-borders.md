# Backlog — Edge-walls (walls on cell borders, not blocked cells)

**Status:** queued (no spec yet). Founder reference: a green/cream checkerboard with
stone wall segments sitting ON the grid lines between cells (rounded stone bars + nub
joints at intersections), forming a maze — walls block *movement between* two cells, they
do not occupy a cell.

## Why it's architectural, not cosmetic
Today a wall = an occupied **cell**: it is encoded as a white knight (`N`) inside the
puzzle **FEN**, and the BFS treats that square as impassable. An edge-wall lives on the
**border between two adjacent cells** and blocks the move across that edge.

**Primary blocker:** FEN can only represent pieces on squares, never edges. The entire
content pipeline (migrate → `content/*.json` → `import-puzzles` → generated catalog)
encodes walls as on-board pieces in the FEN string. Edge-walls need a **structured field
parallel to the FEN** (e.g. `edgeWalls: ["d4|d5", ...]`), not inside it.

## Surfaces to change (6)
1. **Data model** — wall goes from `string[]` of squares to a set of edges (adjacent
   square pair, or square + direction). New field on the Exercise/Labyrinth record;
   `BuilderState.walls` splits into cell-walls vs edge-walls (if both coexist).
2. **Pathfinding** — `lib/game` BFS + sliding-piece movement (rook/bishop/queen) must
   check every **edge crossed** along a slide, not just the destination cell. This is the
   correctness core; needs its own test matrix.
3. **Render** — draw a stone **bar on the shared border** + nub joints at intersections
   (per the reference), instead of filling a cell with a stone tile. New sprite/geometry
   on top of `board-geometry.ts` (edge midpoints + corner joints). Audit existing stone
   assets first (reuse `chesscito-board` palette).
4. **Builder** (`/dev/labyrinth-builder`) — the `wall` brush changes from tap-a-cell to
   **tap-an-edge** (tap between two cells / on a grid line). Different hit-targets +
   visual affordance. Enumerate all UI states per CLAUDE.md "Specs de features con UI".
5. **optimalMoves** — recomputed under the new movement rules.
6. **Migration** — if edge-walls **replace** cell-walls, convert the 18 labyrinths +
   the exercises that use walls. If they **coexist**, this is purely additive.

## Key decision (first spec question)
**Replace vs coexist:** do edge-walls replace blocked-cell walls, or do both wall types
live side by side? This drives data-model shape, migration cost, and BFS complexity.

## Suggested path when picked up
spec (lead with replace-vs-coexist + the parallel `edgeWalls` serialization + builder UI
states + BFS edge-cases) → red-team → TDD. Estimate: multi-day.

## Related
- Builds on the stone-tile wall render (`41934377`, "render walls as stone tiles") and
  the FEN content pipeline shipped in PR #120.
