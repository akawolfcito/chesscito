# Knight curriculum — pedagogy draft (2026-07-15)

Voice matched to rook/bishop (`content/exercises.json`). Each row keeps the puzzle's
FEN/mover/target/tier/tags **unchanged** — only the 4 pedagogy fields are authored.
Once approved, "knight" joins `CURATED_PIECES` (lint.ts:38) and the build enforces completeness.

The order builds one idea at a time: the L-leap → the corner's narrow reach → chaining
hops → the knight's signature (it jumps over everything) → longer planned journeys.

| id | tier | mover→target | principle | title | playerPrompt | learningObjective |
|----|------|--------------|-----------|-------|--------------|-------------------|
| knight-1 | easy | d4→e6 | l-shape-move | The knight's leap | The knight jumps in an L. Land it on the star. | The player can recognise the knight's L-shaped jump — two squares one way, one across. |
| knight-2 | easy | a1→b3 | corner-reach | Out of the corner | In the corner the knight has just two jumps. Pick the one to the star. | The player understands the knight's reach depends on where it stands, and shrinks near an edge. |
| knight-3 | easy | a1→c2 | corner-both-jumps | The other corner jump | Same corner, the knight's other jump. Take it. | The player learns to see all of a knight's jumps from a square, not just the first one. |
| knight-4 | easy | a1→d2 | two-hop | Two hops out | No single jump reaches it. Chain two. | The player learns to build a knight route out of more than one hop. |
| knight-5 | medium | a1→e4 | reach-the-center | Into the center | Head out of the corner toward the middle, hop by hop. | The player learns to steer the knight toward the center, where it has the most jumps. |
| knight-6 | medium | a1→g4 | long-route | The long way by leaps | The star is far. Link the jumps to reach it. | The player learns to cover distance by chaining several knight hops. |
| knight-7 | medium | b1→g6 | plan-the-hops | Plan your jumps | Think a few jumps ahead before you leap. | The player learns to look ahead and plan a knight route instead of hopping one move at a time. |
| knight-8 | medium | b2→d4 | jump-over | The knight jumps over | Other pieces get blocked — the knight doesn't. Leap right over them. | The player learns the knight's signature power: it is the only piece that jumps over others, so blockers never stop it. |
| knight-9 | medium | a1→f6 | long-route-advanced | Across the board | From the corner, reach deep into the far side. Chain the hops. | The player gains confidence planning a long knight journey across open space. |
| knight-10 | medium | a8→h6 | corner-departure | Across from the corner | Leave the top corner and hop across to the star. | The player learns to launch the knight out of a corner toward a far target, choosing an efficient chain of hops. |

## Notes
- **knight-8 is the signature lesson**: the FEN surrounds the mover with friendly knights;
  the point is that the knight *leaps over* them. This is the one every player must feel.
- No FEN/geometry/order/difficulty is touched — this is pure copy, same as the rook curation.
- `principle` slugs are distinct per lesson (the linter doesn't require uniqueness, but
  distinct slugs keep the curriculum legible), following the rook/bishop convention.

## After approval — replication plan
Same treatment, 10 exercises each, in this order:
1. **Pawn** — push vs. diagonal capture, no retreat, promotion (ties into Promotion Run).
2. **Queen** — combines rook lines + bishop lines (ties into N-Queens).
3. **King** — one square any direction (ties into Royal Escape).

Each piece: author 4 fields per exercise → add to `CURATED_PIECES` → `import-puzzles` →
lint green → atomic commit. One piece per commit.
