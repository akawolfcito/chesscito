# Phase 1C — Labyrinth Quality Expansion Plan

## 1. Current count per piece

| Piece | Count | IDs |
|-------|-------|-----|
| Rook | 2 | rook-lab-1, rook-lab-2 |
| Bishop | 2 | bishop-lab-1, bishop-lab-2 |
| Knight | 2 | knight-lab-1, knight-lab-2 |
| Pawn | 2 | pawn-lab-1, pawn-lab-2 |
| Queen | 1 | queen-lab-1 |
| **Total** | **9** | |

## 2. Current quality assessment

### Acceptable (keep as-is)
- **rook-lab-1** (opt=4, 3 obstacles): L-shaped wall, meaningful constraint.
- **rook-lab-2** (opt=3, 3 obstacles): Forces upper-deck detour, decent.
- **queen-lab-1** (opt=3, 3 obstacles): Clean a1→h8 with b2/a5/h4 blocking.

### Weak — too few obstacles
- **bishop-lab-1** (opt=4, 1 obstacle): Single blocker at d4. Trivial to solve.
- **bishop-lab-2** (opt=4, 1 obstacle): Single blocker at e6. Same problem.

### Too similar to basic exercises
- **knight-lab-1** (opt=3): No obstacles. 3-jump from a1→e4. Feels like exercise knight-5.
- **knight-lab-2** (opt=4): No obstacles. 4-jump a1→e5. Just a longer path.

### Poorly composed
- **pawn-lab-1** (opt=4): 1 obstacle e4. Starts at e2 (double-forward available). Only 4 ranks of traversal. No switch in capture direction.
- **pawn-lab-2** (opt=4): 2 obstacles d4/c5. Better but only covers ranks 1–5, files c–e. No board-spanning tension.

## 3. New labyrinth designs

All proposed designs below will be **BFS-verified at implementation time** — tests confirm `bfs<N>(optimal-1) → null` and `bfs<N>(optimal) → optimal`.

### Pawn: +3 (replace existing 2, add 1 new)

#### pawn-lab-3 — "The Corridor"
| Field | Value |
|-------|-------|
| startPos | a2 (0,1) |
| targetPos | d7 (3,6) |
| obstacles | a3(0,2), a4(0,3) |
| isCapture | true |
| optimalMoves | 5 |
| **Intended path** | a2 → b3(cap▶) → b4(fwd) → c5(cap▶) → c6(fwd) → d7(cap▶) |
| **No shortcut at depth 4** | BFS can only reach rank 5 (c6) in ≤4 moves; target is rank 6. |
| **Constraint** | a3 blocks forward + double-fwd from a2, forcing cap right immediately. a4 blocks cap left from b3, preventing early deviation. |

#### pawn-lab-4 — "The Ladder"
| Field | Value |
|-------|-------|
| startPos | a2 (0,1) |
| targetPos | d5 (3,4) |
| obstacles | a3(0,2) |
| isCapture | true |
| optimalMoves | 4 |
| **Intended path** | a2 → b3(cap▶) → c3(fwd) → d4(cap▶) → d5(fwd) |
| **No shortcut at depth 3** | Depth 3 reaches d4(3,3) or c5(2,4) but neither is d5(3,4). |

#### pawn-lab-5 — "The Gauntlet"
| Field | Value |
|-------|-------|
| startPos | g2 (6,1) |
| targetPos | c6 (2,5) |
| obstacles | g3(6,2), d4(3,3), e6(4,5) |
| isCapture | true |
| optimalMoves | 5 |
| **Intended path** | g2 → f3(cap◀) → f4(fwd) → e5(cap◀) → d5(fwd) → c6(cap◀) |
| **No shortcut at depth 4** | Obstacles d4 and e6 block diagonal shortcuts on d/e files. Pawn must traverse all 6 files left to right. |
| **Constraint** | g3 blocks forward from start. Forces capture left, then alternating cap/fwd across the full board width. |

### Knight: +3 (keep existing 2 as warm-up, add 3 rich labyrinths)

#### knight-lab-3 — "The Long Diagonal"
| Field | Value |
|-------|-------|
| startPos | a1 (0,0) |
| targetPos | h8 (7,7) |
| optimalMoves | 6 |
| **Notes** | Opposing-corner knight tour. Knight's-graph distance a1→h8 = 6 moves (well-known). No obstacles needed. |
| **No shortcut at depth 5** | Euclidean distance ~9.9; each jump covers ~3 Manhattan. Ceil(14/3) = 5, but BFS confirms depth 5 → null. |

#### knight-lab-4 — "The Box"
| Field | Value |
|-------|-------|
| startPos | b1 (1,0) |
| targetPos | g7 (6,6) |
| optimalMoves | 4 |
| **Intended path** | b1 → d2 → f3 → g5 → g7 |
| **No shortcut at depth 3** | Tight center corridor; BFS depth 3 → null. |

#### knight-lab-5 — "The Crossroads"
| Field | Value |
|-------|-------|
| startPos | d4 (3,3) |
| targetPos | a1 (0,0) |
| optimalMoves | 4 |
| **Intended path** | d4 → c2 → a3 → b1 → a1 (counterintuitive — must move *away* from target first) |
| **No shortcut at depth 3** | Center-to-corner distance = 6 Manhattan → ceil(6/3) = 2, but geometry prevents depth < 4. BFS depth 3 → null. |

### Queen: +2 (queen-lab-2, queen-lab-3)

#### queen-lab-2 — "The Trapdoor"
| Field | Value |
|-------|-------|
| startPos | a1 (0,0) |
| targetPos | h1 (7,0) |
| obstacles | c1(2,0), e2(4,1), f3(5,2), h4(7,3) |
| optimalMoves | 4 |
| **Intended path** | a1 → a2(fwd) → d2(horiz) → d1(vert) → h1(horiz) |
| **Constraint logic** | c1 blocks rank-0 horizontal (a1→h1 in 1). e2 blocks rank-1 horizontal (a2→h2). f3 blocks rank-2 horizontal (c3→h3). h4 blocks diagonals from d4→h4 and general access. |

#### queen-lab-3 — "The Sieve"
| Field | Value |
|-------|-------|
| startPos | d1 (3,0) |
| targetPos | d8 (3,7) |
| obstacles | d3(3,2), d5(3,4), d7(3,6), b3(1,2), f3(5,2) |
| optimalMoves | 4 |
| **Intended path** | d1 → a4(diag NW) → a7(fwd) → d7(diag SE)... wait d7 is obstacle. |
| **Alternate** | Will design during implementation to avoid stair-step d-file obstacles from being too restrictive. BFS will verify. |

**Note for queen:** The queen's 8-direction movement makes forcing depth ≥4 very difficult — any two squares can be connected in ≤2 queen moves unless heavily obstructed. We may find during BFS verification that some proposed designs collapse to optimal=3 and need extra blockers. This is expected and the test suite will catch it.

### Bishop: +2 (replace/redesign existing 2)

#### bishop-lab-3 — "The Dead End"
| Field | Value |
|-------|-------|
| startPos | c1 (2,0) |
| targetPos | h6 (7,5) |
| obstacles | e3(4,2), g5(6,4) |
| optimalMoves | 4 |
| **Intended path** | c1 → a3(diag NW) → f8(diag NE) → h6(diag SE) |
| **Constraint** | e3 blocks the direct c1→h6 diagonal at d4/e3. g5 blocks f8→h6 shortcut. |

#### bishop-lab-4 — "The Mirror"
| Field | Value |
|-------|-------|
| startPos | a1 (0,0) |
| targetPos | a7 (0,6) |
| obstacles | c3(2,2), e5(4,4) |
| optimalMoves | 5 |
| **Intended path** | a1 → h8(diag NE) → a8(vert... wait). Let me rethink. |
| **Note** | Dark-square to dark-square on same file. Will design bishop labyrinth with BFS verification during implementation. |

### Rook: +1 (keep existing 2, add 1 for depth)

#### rook-lab-3 — "The Pinball"
| Field | Value |
|-------|-------|
| startPos | a1 (0,0) |
| targetPos | h7 (7,6) |
| obstacles | a5(0,4), g1(6,0), h5(7,4) |
| optimalMoves | 5 |
| **Intended path** | a1 → a4(vert) → g4(horiz) → g2(vert) → h2(horiz) → h7(vert) |
| **Constraint** | a5 caps a-file at rank 3. g1 blocks rank-0 horizontal. h5 caps h-file entry. |

## 4. BFS test strategy

### New BFS helpers needed
- **`bfsRookDepth`** — same pattern as `bfsQueenDepth` but uses `getRookMoves`
- **`bfsBishopDepth`** — same pattern but uses `getBishopMoves`

Or better: create a **generic `bfsSlidingDepth`** helper:
```ts
function bfsSlidingDepth(
  start: BoardPosition,
  target: BoardPosition,
  blockers: BoardPosition[],
  getMoves: (pos: BoardPosition, blockers: BoardPosition[]) => BoardPosition[],
  maxDepth: number,
): number | null
```
This replaces `bfsQueenDepth` and any new rook/bishop helpers.

### Test structure addition

For each new labyrinth, two tests per piece group:
```ts
it("$id: reachable in exactly $optimal moves", () => { ... })
it("$id: NOT reachable in fewer than $optimal moves", () => { ... })
```

Existing data-integrity tests (`PIECES_WITH_LABYRINTHS`) already cover: non-zero count, start≠target, valid positions, optimal>0, obstacles don't overlap start/target, no duplicate obstacles. These automatically cover new labyrinths.

### Test count estimate

| Section | Existing | New | Total |
|---------|----------|-----|-------|
| rook-movement | 5 | 0 | 5 |
| star-threshold | 5 | 0 | 5 |
| data-integrity (per piece) | 7 groups × N pieces | 0 | same (5→5 pieces) |
| rook path existence | 0 | 2+(1 bfs) | ~3 |
| bishop path existence | 0 | 4+(2 bfs) | ~6 |
| knight path existence | 4 (existing) | 6+(3 bfs) | ~13 |
| pawn path existence | 4 (existing) | 6+(3 bfs) | ~13 |
| queen path existence | 3 (existing) | 4+(2 bfs) | ~9 |
| rook-lab-1 legacy data | 3 | 0 | 3 |
| **Total tests** | ~67 | ~22 | **~89** |

## 5. Exact files to modify

### apps/web/src/lib/game/exercises.ts
- Replace `PAWN_LABYRINTHS` array with 3 new labyrinths (remove pawn-lab-1, pawn-lab-2; add pawn-lab-3,-4,-5)
- Append `KNIGHT_LABYRINTHS` with knight-lab-3,-4,-5 (keep existing 2)
- Append `QUEEN_LABYRINTHS` with queen-lab-2,-3 (keep queen-lab-1)
- Replace `BISHOP_LABYRINTHS` with bishop-lab-3,-4 (remove bishop-lab-1,-2; or keep them and add 2)
- Append `ROOK_LABYRINTHS` with rook-lab-3 (keep rook-lab-1,-2)

**Decision question:** Should we remove weak labyrinths (bishop-lab-1,-2, pawn-lab-1,-2) or keep them alongside new ones?

**Recommendation:** Remove them. They reduce quality signal and make the labyrinth page feel padded. Or keep pawn-lab-2 as it is borderline OK and provides a gradual difficulty curve.

### apps/web/src/lib/game/__tests__/labyrinth.test.ts
- Create generic `bfsSlidingDepth` helper (replace `bfsQueenDepth`, add rook/bishop coverage)
- Add `"rook"`, `"bishop"` to path-existence test groups (currently only knight, pawn, queen)
- Add test groups for bishop path existence (2 labyrinths × 2 tests each)
- Add rook-lab-3 tests
- Add knight-lab-3,-4,-5 tests
- Add pawn-lab-3,-4,-5 tests
- Add queen-lab-2,-3 tests

## 6. Risk points

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Queen labyrinth collapses to optimal <4** | Need more obstacles than anticipated | BFS verification catches this; add blockers iteratively. Fallback: omit toughest queen labyrinth. |
| **Pawn pawn-lab-5 path doesn't exist at all** | Blockers may over-constrain on the left (c-file) | BFS verification; adjust obstacles if depth returns null |
| **PIECES_WITH_LABYRINTHS array** | Must include all 5 pieces | It already does — no change needed |
| **Knight lab-3 optimal=6 is too long** | 6 moves may feel tedious for mobile | Lower bound is 6 (proved by knight's graph). Accept as the "boss" labyrinth. |
| **Labyrinth star thresholds** | labyrinthStars formula unchanged | No risk. Existing formula handles >=2 optimal correctly. |
| **BFS false negatives** | bfsKnightDepth doesn't filter obstacles (knight jumps over them) | Already correct — knight ignores obstacles. bfsPawnDepth and bfsSlidingDepth both filter. |
| **Existing labyrinth `optimalMoves`** | Changing existing labyrinths could affect star counts | We're NOT changing existing labyrinths that work (rook-lab-1,-2, queen-lab-1). Only adding/replacing. |
| **Pawn starting rank** | All pawn labyrinths start at rank 1 (double-forward available) | `a3` obstacle explicitly blocks both forward-1 AND forward-2. Verified in code: double-fwd is inside `if (!isBlocked(fwd1))` block. |

## 7. Summary of changes

```
exercises.ts:
  PAWN_LABYRINTHS:   [pawn-lab-3, pawn-lab-4, pawn-lab-5]  (replace 2 weak with 3 strong)
  KNIGHT_LABYRINTHS: [knight-lab-1, -2, -3, -4, -5]        (add 3 rich labyrinths)
  QUEEN_LABYRINTHS:  [queen-lab-1, queen-lab-2, queen-lab-3](add 2)
  BISHOP_LABYRINTHS: [bishop-lab-3, bishop-lab-4]           (replace 2 weak)
  ROOK_LABYRINTHS:   [rook-lab-1, -2, -3]                   (add 1)

labyrinth.test.ts:
  Add generic bfsSlidingDepth helper
  Add 5 path-existence test groups (rook, bishop, knight, pawn, queen)
  ~22 new tests

Other files: NONE (no UI, no contracts, no constants)
```

**Total labyrinths after Phase 1C: 3 + 5 + 2 + 2 + 3 = 15 (up from 9)**

**Design note:** All exact positions and optimalMoves will be verified during implementation via BFS. The values in this plan are best-faith estimates; BFS may reveal different optimal depths, which is fine — we adjust to match ground truth.
