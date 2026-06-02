# Pawn Labyrinth Audit — 2026-06-02

> Triggered by manual smoke: pawn-lab-3 (a2, blockers a3+a4, star d7) reads as
> "no legal route" to beginners. This audit validates each pawn labyrinth FEN
> against the actual pawn rules in `apps/web/src/lib/game/rules/pawn.ts` and
> proposes a true Easy pawn lab.

## 1. Source of truth

- Catalog: `apps/web/src/lib/game/exercises.ts:241-269`
- Rule engine: `apps/web/src/lib/game/rules/pawn.ts:14-55`
  - Forward 1 if not blocked.
  - Forward 2 only from rank 1 AND if forward-1 is clear.
  - Diagonal **only** if `isCapture=true` AND `(captureSquares===undefined OR target ∈ captureSquares)`.
- Render: `apps/web/src/components/board.tsx:368-394` — `captureTargets` are
  drawn as a **radial amber glow**, NOT as an enemy piece sprite. Obstacles are
  rendered as desaturated piece with lock badge.

## 2. Current pawn labyrinth inventory

| ID            | Start | Target | Obstacles  | captureTargets         | Optimal | Notes                          |
|---------------|-------|--------|------------|------------------------|---------|--------------------------------|
| `pawn-lab-3`  | a2    | d7     | a3, a4     | b3, c4, d5             | 5       | Triple-chain captures          |
| `pawn-lab-4`  | a2    | c6     | a3         | b3, c4                 | 4       | Double-chain captures          |
| `pawn-lab-5`  | g2    | c7     | g3         | f3, e4, d5, c6         | 5       | Quad-chain captures (mirrored) |

Naming gap: there is no `pawn-lab-1` or `pawn-lab-2`. The slot `pawn-lab-1` is
available for a new Easy lab without orphaning `chesscito:labyrinth-best:pawn`
records (`labyrinth-progress.ts:12-16`).

## 3. Per-lab path verification

### 3.1 `pawn-lab-3` (a2 → d7, blockers a3+a4, captures b3/c4/d5)

**Move 1 — a2.** Forward a3 blocked. Forward-2 a4 blocked. Diagonals: a-file
to the left = off-board; b3 ∈ captureTargets → legal capture. **Only legal:
b3.**

**Move 2 — b3.** Forward b4 empty, no obstacle → legal forward. Diagonals: a4
is an obstacle and NOT in captureTargets → blocked; c4 ∈ captureTargets → legal
capture. **Two legal moves: b4 (forward) or c4 (capture).**

**Move 3 — c4.** Forward c5 empty → legal forward. Diagonals: b5, d5; d5 ∈
captureTargets → legal capture. **Two legal moves: c5 (forward) or d5
(capture).**

**Move 4 — d5.** Forward d6 empty → legal. Diagonals c6, e6 not in
captureTargets and not target → blocked. **Only legal: d6.**

**Move 5 — d6.** Forward d7 (target) → legal. Diagonals c7, e7 not
captureTargets, not target → blocked. **Only legal: d7. Target reached.**

✅ Optimal path exists: `a2→b3→c4→d5→d6→d7` (5 moves).
❌ **Dead-state branches** at move 2 (b3→b4) and move 3 (c4→c5). Once the pawn
abandons the capture chain, file change becomes impossible and target is
unreachable.

### 3.2 `pawn-lab-4` (a2 → c6, blocker a3, captures b3/c4)

**Move 1 — a2.** a3 blocked → no forward, no forward-2. Diagonals: a-1 off-
board; b3 ∈ captureTargets. **Only legal: b3.**

**Move 2 — b3.** Forward b4 legal; diagonals a4 (empty, not in captureTargets →
blocked), c4 ∈ captureTargets → legal. **Two legal moves: b4 or c4.**

**Move 3 — c4.** Forward c5 legal; diagonals b5, d5 not captureTargets,
blocked. **Only legal: c5.**

**Move 4 — c5.** Forward c6 (target) legal; diagonals blocked. **Only legal:
c6.**

✅ Optimal path: `a2→b3→c4→c5→c6` (4 moves).
❌ **Dead-state at move 2** (b3→b4 → permanent file-b lock).

### 3.3 `pawn-lab-5` (g2 → c7, blocker g3, captures f3/e4/d5/c6)

**Move 1 — g2.** g3 blocked. Diagonals: h3 (empty, not in captureTargets →
blocked), f3 ∈ captureTargets → legal. **Only legal: f3.**

**Move 2 — f3.** Forward f4 legal; diagonals e4 ∈ captureTargets → legal, g4
empty/blocked. **Two legal moves: f4 (forward) or e4 (capture).**

**Move 3 — e4.** Forward e5 legal; diagonals d5 ∈ captureTargets → legal, f5
empty/blocked. **Two legal: e5 or d5.**

**Move 4 — d5.** Forward d6 legal; diagonals c6 ∈ captureTargets → legal, e6
blocked. **Two legal: d6 or c6.**

**Move 5 — c6.** Forward c7 (target) legal; diagonals blocked. **Only legal:
c7.**

✅ Optimal path: `g2→f3→e4→d5→c6→c7` (5 moves).
❌ **Dead-state branches** at every forward-vs-capture fork (moves 2, 3, 4).

## 4. Audit verdict against the requested rules

| Rule                                                                                | pawn-lab-3 | pawn-lab-4 | pawn-lab-5 |
|-------------------------------------------------------------------------------------|------------|------------|------------|
| At least one legal route from start to target                                       | ✅          | ✅          | ✅          |
| Pawn never required to move diagonally to an empty square                           | ✅          | ✅          | ✅          |
| If frontal forward is blocked, a legal diagonal capture exists                      | ✅          | ✅          | ✅          |
| No first-move dead-state (a legal move always exists from `start`)                  | ✅          | ✅          | ✅          |
| No reachable dead-state during play (every state has a path to target)              | ❌          | ❌          | ❌          |

**The user's smoke is *not* a rule bug** — `b3` IS a legal capture from `a2`
in `pawn-lab-3`. It's a **discoverability bug** layered on top of a real
**dead-state risk**:

1. The amber-glow capture marker (`board.tsx:384-393`) does not read as
   "capturable enemy" to a new player. There is no piece sprite, no enemy tint,
   no semantic icon. Easy to scan past.
2. Once the player taps the pawn, the only legal target IS the amber glow —
   but if they don't recognize it as legal, they assume "no moves" and reset.
3. Even when they do capture, every subsequent step in pawn-lab-3/4/5 offers
   a forward-vs-capture fork where the forward branch is a one-way dead-state
   with no UI signal.

## 5. Proposal — new `pawn-lab-1` "First Capture" (true Easy)

```ts
defineLabyrinth({
  id: "pawn-lab-1",
  start: "d2",
  target: "e5",
  obstacles: ["d3", "d4"],
  captureTargets: ["e3"],
  isCapture: true,
  optimalMoves: 3,
}),
```

**Layout (board view, white moves up):**

```
8 . . . . . . . .
7 . . . . . . . .
6 . . . . . . . .
5 . . . . ★ . . .
4 . . . X . . . .
3 . . . X ✸ . . .
2 . . . ♙ . . . .
1 . . . . . . . .
  a b c d e f g h
```

Legend: `♙` start, `★` target, `X` obstacle, `✸` captureTarget.

**Path verification (only ONE legal move at every step → impossible to
dead-state):**

| Move | From | Forward      | Diagonal-L     | Diagonal-R                  | Only legal |
|------|------|--------------|----------------|-----------------------------|------------|
| 1    | d2   | d3 blocked   | c3 not in CT   | e3 ∈ CT                     | **e3 (capture)** |
| 2    | e3   | e4 empty     | d4 obstacle, not in CT | f4 empty, not in CT | **e4 (forward)** |
| 3    | e4   | e5 = target  | d5 not in CT   | f5 not in CT                | **e5 (target)**  |

Forward-2 from rank 1 (d2 → d4) is also blocked because d3 obstructs the
chain (`pawn.ts:30-35`).

Total: **3 moves, 1 forced capture, no fork → zero dead-state surface**. This
is the canonical "first capture" lesson: forward blocked → look diagonal →
single legal capture → resume forward to star.

## 6. Constraints to honor when implementing

1. **Regression test must update.** `labyrinths-catalog.test.ts:67` asserts
   `LABYRINTHS.pawn.length === 3`. Adding `pawn-lab-1` bumps it to 4 — update
   both the test and the inline comment `// 3 pawn labyrinths` in
   `exercises.ts` if present.
2. **Insertion order matters for UI ordering.** Per the existing pattern
   (`pawn-lab-3..5`), labyrinths render in array order. Insert `pawn-lab-1`
   at index 0 so beginners hit it first.
3. **No threshold change required.** `BADGE_THRESHOLD = 10`
   (`exercises.ts:101`) is computed over the 15 stars from regular per-piece
   exercises, not labyrinths. Adding a labyrinth does not perturb the badge
   gate. (Verify: `labyrinth-progress.ts` writes to a separate
   `chesscito:labyrinth-best:{piece}` keyspace and is not summed into the
   badge threshold path.)
4. **Path tests required.** Mirror the existing pattern in
   `labyrinth.test.ts:289-340`:
   - `pawn-lab-1: maximum depth to reach target is 3`.
   - `pawn-lab-1: target is NOT reachable in fewer than 3 moves`.
   - `pawn-lab-1: from d2, the only legal target is e3 (single forced capture)`.
   - `pawn-lab-1: from e3, the only legal target is e4 (forward, all diagonals dead)`.

## 7. Out-of-scope follow-ups (do not bundle)

Listed for traceability only — the user explicitly scoped this task to **one
new Easy Pawn Labyrinth + audit**, no visual polish.

- **Capture-target visual upgrade.** Render `captureTargets` as a desaturated
  enemy piece sprite (e.g. a phantom pawn with red tint) instead of an amber
  glow. Improves discoverability across all pawn labs and aligns with
  obstacle styling.
- **Dead-state hint.** Optional toast or chip when the next move sequence has
  no path to target. Cheap to compute (BFS on demand) but UX-heavy.
- **`pawn-lab-2` slot.** A second Easy lab with the capture on the opposite
  diagonal (left instead of right) for symmetry — optional.

## 8. Recommendation

Approve `pawn-lab-1` "First Capture" as proposed in §5 and ship in the same
cluster as Phase B (pawn rule fix). It closes the deferred Phase F item in
`docs/superpowers/specs/2026-06-02-labyrinth-design-v0.1.md:194` and
materially reduces the dead-state surface area new players hit.
