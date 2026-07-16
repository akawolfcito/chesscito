# Spec — the four remaining signature games (2026-07-16)

Founder decisions are **locked** (2026-07-15/16 session). This spec exists so the build
starts from a settled contract instead of re-litigating mechanics. Companion:
`docs/audits/2026-07-15-two-lanes-per-piece-audit.md`.

## Framing (founder, verbatim intent)

> "lo ideal es que esto sea la carcasa, no importa si no son los mejores o peores ejercicios
> sino que la **dinámica sea clara**, y si hay que pulir finalmente el ejercicio lo haré
> fácilmente con el `/dev/labyrinth-builder`."

**Build the mechanic; ship placeholder levels.** Level polish is the founder's job in the
builder. Do not spend effort perfecting level design.

## Settled decisions (do not re-ask)

| Question | Decision |
|---|---|
| Board size | **8×8 always.** No reduced boards, no masking, no "sensations". Just place the position. |
| Random starts | **Authored per level** (FEN). Variety comes from having several levels. Random breaks E2E/VR and the builder. |
| Pass threshold | **80%** of the achievable set. |
| Below threshold | Player may take **pass with 0 stars**, or retry. |
| Enemies (pawn/king) | **Static**, projecting lethal/attacked squares. No enemy AI in MVP. |
| King game | Royal Escape is the ceiling; **MVP = Safe Path** (static threats, reach the refuge). |
| Level difficulty | Start at **intermediate** — the exercises already taught the basics. |
| If a game can't work | Ship the piece **without** its game and hide it from the Special Training path sheet rather than shipping something broken. |

## ⚠️ The constraint that sets the build order

`MappedPuzzle` (`lib/game/fen-puzzle.ts:63`) carries `obstacles?: BoardPosition[]` and
`captureTargets?: BoardPosition[]` — **squares, with no piece type**. A9 hit this same wall
and deliberately refused the surgery, standing up the knight-only content lint gate instead
(`lib/content/lint.ts`, handoff 2026-07-14 §2/§3).

**A threat layer needs types**: a rook does not attack like a bishop. So:

| Game | Needs `{pos, piece}` surgery? | Effort |
|---|---|---|
| **Knight's Tour** | ❌ No — knight + walls; a wall is a wall | **lowest** |
| **N-Queens** | ❌ No — every piece is a queen, so no type ambiguity | low-mid |
| **Safe Path** (king) | ✅ Yes — typed enemies + attack map | mid-high |
| **Promotion Run** (pawn) | ✅ Yes — same attack layer | mid-high |

**Build in that order.** Safe Path and Promotion Run **share** the surgery + the attack
layer: do them back to back, never apart (plan §15.6.3: pay once, not twice).

> An earlier ordering in this session put Safe Path first on the guess that "attacked squares
> are just walls". The code says otherwise. The walls are typeless; the threats are not.

---

## 1. Knight's Tour (`kind: "knight-tour"`) — build first

**Loop.** Knight starts on an authored square. Each move marks the vacated square with an
**X**; X squares can never be entered again. The game ends when no legal unvisited square
remains. Score = squares visited ÷ reachable.

- **Reachable set is computed from the level**, walls included — so the founder resizes the
  puzzle in the builder (a 5×5 pocket = 25 squares) with zero code changes. **Ship several
  placeholder levels (small / medium / large)**; the founder picks the feel.
- **Progress must be visible** ("se gana cuando se llegue al 80% que debería estar visible").
  Surface it in the **mission band** — the full-width strip is now the status home
  (`mission-panel-candy.tsx`, `missionStatus` prop) — and/or a tooltip on the piece for
  contrast against board and sprite.
- Stars: 80% = pass. Minimum pass = 1★; more coverage = more stars; full tour = 3★.
- Below 80%: offer pass-with-0★ or retry.
- ⚠️ **Open 8×8 = 64 squares → 80% is 52 taps**, and a classic knight's tour is genuinely
  hard. This is why levels ship walled and small first.

## 2. N-Queens (`kind: "queens"`)

**Loop (confirmed by founder).**
- **N = 8 max** on an 8×8 (10 non-attacking queens do not exist). First level targets ~6 —
  intermediate, not easy.
- **The system places queen #1** (authored, not random — see decisions). The player places
  the rest.
- A counter chip reads **`<queen> ×N`** (e.g. "queen ×4"). Home: the mission band.
- **Mini-tour** on entry: "select the queen and place it on the board."
- **Illegal placement** (attacked by an existing queen): play the attack/capture beat, show
  an overlay explaining you cannot place a piece where it would be captured, and **reject
  it — no penalty, retry freely.**
- **The game ends when no safe square remains** (stuck). Score = queens placed. That is the
  only way to score below N, and it is what makes 80% meaningful.
- Obstacles/blocks may be authored to **open up** possibilities for new players.

## 3 & 4. Safe Path (king) + Promotion Run (pawn) — one surgery, two games

**Prerequisite:** widen the puzzle model to typed pieces (`{pos, piece}`) and add an
attack-map module: `attackedSquares(enemies) -> Set<square>`. Registered in plan §15.6.3;
A9 explicitly deferred it. **Do them together.**

**Safe Path (`kind: "safe-path"`).** Static enemies project attacked squares (**visible** —
the teaching is reading the threat). The king walks one square at a time to the refuge and
**may never enter an attacked square**. BFS over safe squares gives `optimalMoves`; grade
with the existing `labyrinthStars`. This is the king's whole identity: never move into check.

**Promotion Run (`kind: "promotion-run"`).** Founder's design, verified chess-correct:
- Pawn pushes straight when the square is free; **captures only diagonally**; never retreats.
- A blocked file is passed **by capturing diagonally** — that is how the pawn changes file.
- Reaching the last rank **promotes**.
- Static enemies make squares **lethal**: stepping on one loses.
- ⚠️ A pawn only reaches a square diagonally **by capturing**, so if the promotion square is
  only reachable on the diagonal it must hold a capturable token. The founder's own sketch
  (c2 → c3 → ×b4 → b5 → ×c6) already respects this.
- Open: whether the promotion **piece choice** (Q/R/B/N) ships in the MVP.

---

## Pattern to follow

Diagonal Run is the reference implementation, end to end:
- Pure module: `lib/game/diagonal-run.ts` (rules + BFS, no React).
- Board: `components/exercises/diagonal-run-board.tsx` — reuses `<GameBoard>`; **owns no
  chrome**: it hoists its status line to the mission band via `onBandChange` (2026-07-16).
- Content: `content/labyrinths.json` entries carry `kind`; `pnpm -C apps/web import-puzzles`
  regenerates + BFS-verifies + lints.
- Host: `exercises-screen.tsx` derives the active game **from the runtime catalog, never from
  an id or prefix** (B4.2.1).
- Completion flows through the **labyrinth ledger**, which already gives progress + overlay.
- i18n namespace per game (cf. `DIAGONAL_RUN_COPY`), EN + ES.
- `/dev/<game>` probe + E2E: the probe photographs the mechanic standalone.

**Grading gap:** `labyrinthStars(moves, optimal)` grades by move count. Knight's Tour and
N-Queens grade by **percentage of a set**. That needs a second grader — do not bend the
existing one.
