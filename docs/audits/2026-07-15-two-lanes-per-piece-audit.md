# Audit — The two Chesscito lanes per piece (2026-07-15)

Branch: `fix/exercise-obstacles-a0`. Grounded in `content/exercises.json` (59 entries)
and `content/labyrinths.json` (22 entries) as they stand today.

Every piece is meant to ship **two lanes**:

1. **Exercises** — the graded puzzle pool (`~10`/piece, BFS-verified, id-keyed progress).
2. **Playful game** — a signature mini-game that exercises the piece's *identity* move.

---

## Lane 1 — Exercises: playable everywhere, pedagogically complete only for rook & bishop

| Piece  | Count | Tiers                    | `principle` / `playerPrompt` / `learningObjective` |
|--------|:-----:|--------------------------|---------------------------------------------------|
| Rook   | 10    | easy 5 / med 5           | ✅ complete                                        |
| Bishop | 9     | easy 5 / med 4           | ✅ complete                                        |
| Knight | 10    | easy 4 / med 6           | ❌ **all 3 empty** (30 missing fields)             |
| Pawn   | 10    | easy 4 / med 6           | ❌ **all 3 empty**                                 |
| Queen  | 10    | easy 5 / med 5           | ❌ **all 3 empty**                                 |
| King   | 10    | easy 4 / med 4 / hard 2  | ❌ **all 3 empty**                                 |

**Verdict:** all six pools are *mechanically* solid (FEN + target + mover + tier + tags,
BFS-verified). But knight/pawn/queen/king are **pedagogically bare** — no principle, no
player prompt, no learning objective. That is the gap: they play, they don't *teach* with
the same voice as rook/bishop. This is authorable content work, no engine change.

## Lane 2 — Playful game: only rook & bishop have a signature game

| Piece  | Signature game            | Kind               | Status                    |
|--------|---------------------------|--------------------|---------------------------|
| Rook   | **Rook Rails** (labyrinth)| labyrinth (walls)  | ✅ shipped                 |
| Bishop | **Diagonal Run** (glide)  | `diagonal-run`     | ✅ shipped                 |
| Knight | — (5 generic labs)        | labyrinth          | 💡 proposal below          |
| Pawn   | — (4 generic labs)        | labyrinth          | 💡 proposal below          |
| Queen  | — (3 generic labs)        | labyrinth          | 💡 proposal below          |
| King   | — (1 generic lab)         | labyrinth          | 💡 proposal below          |

Knight/pawn/queen/king only have *generic* labyrinths (walls + shortest path), which is the
rook's game reskinned — it does **not** express what makes each piece distinct.

---

## Proposals — a signature game per remaining piece

Design frame: (1) exercises the piece's *identity* move, (2) self-contained win + star
grading, (3) reuses `<GameBoard>` + BFS/ledger infra like Diagonal Run did, (4) fits 390px.

### Knight → **Knight's Tour** ✅ (confirm)
Visit a set of squares (or all) without repeating a square. The knight's L-jump is the whole
puzzle. Canonical, instantly legible. BFS/DFS over `(square, visited-set)` — same state
generalization already registered in plan §15.6.3. **Recommended.**

### Queen → **N-Queens** ✅ (confirm)
Place N queens so none attacks another. The queen's full range *is* the constraint. Iconic.
Note: it's a **placement** puzzle, not a movement one — a different genre from the other
games, but its recognizability may be worth it. Alt: *Queen's Sweep* — capture every star in
fewest moves (rook + bishop lines combined), which stays in the movement genre.

### Pawn → **Promotion Run** (proposed, "sin idea" slot)
March a single pawn from rank 2 to rank 8. Forward pushes are blocked by pieces; the only way
past is **diagonal capture**. Teaches the pawn's asymmetry (moves straight, takes diagonally)
+ promotion payoff. Reuses the labyrinth engine almost verbatim. Alt: *Phalanx* — advance a
pawn chain keeping them mutually defended.

### King → **Safe Path** (proposed, "sin idea" slot)
Walk the king to a target square **without ever stepping onto a square attacked by a static
enemy piece**. Teaches the king's defining rule: never move into check. One-square steps make
it gentle; the attack-map makes it think. Reuses board + a per-square "attacked" mask. Alt:
*King's Escape* — reach any edge/safe zone.

---

## Open product decisions (founder)

1. Confirm **Knight's Tour** (knight) and **N-Queens** (queen) as the signature games.
2. Pick the **pawn** game: Promotion Run (rec) vs Phalanx vs other.
3. Pick the **king** game: Safe Path (rec) vs King's Escape vs other.
4. Prioritization: close the **pedagogical-fields gap** (knight/pawn/queen/king exercises)
   before building new games, or ship a game first? The exercise gap is cheaper and lifts all
   four pieces to rook/bishop parity in the lane that's already live.
