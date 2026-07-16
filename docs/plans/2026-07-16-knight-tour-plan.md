# Plan — Knight's Tour (`kind: "knight-tour"`)

Spec (closed, not re-litigated): `docs/specs/2026-07-16-signature-games-spec.md` §1.
Reference implementation: Diagonal Run, end to end.

## ⚠️ The finding that shapes this build — the ledger grades BACKWARDS for a tour

Diagonal Run completes through the labyrinth ledger:
`diagonal-run-board` → `handleLabyrinthMove(targetPos, moves)` (`exercises-screen.tsx:2509`).
That path is **fewest-moves-is-better**, in three places:

| Place | Behaviour | What it does to a tour |
|---|---|---|
| `recordLabyrinthBest` (`labyrinth-progress.ts:77`) | records only if `moves < prev` | a run covering **3** squares overwrites a run covering **10** as an "improvement" |
| `labyrinthStars(moves, optimal)` (`exercises.ts:125`) | `moves <= optimal → 3★` | **3★ para todo**: ver corrección abajo |
| `addNetStars(prevLabStars, stars)` (`:2545`) | feeds the daily ledger | inherits the same inversion |

Knight's Tour scores **coverage ÷ reachable** — more is better. So it cannot ride
`handleLabyrinthMove` as-is. This is the concrete shape of the spec's "grading gap"
line, and the reason the game is cheap **but not free**.

### Corrección (2026-07-16, la escribió el test, no yo)

Mi primera versión de esta tabla decía que un tour completo sacaría **0★** bajo
`labyrinthStars`. **Es falso**, y el test de contraste lo tumbó. Verificado con la
función real (`tsx -e`, optimal = 19):

| moves | 3 | 10 | 15 | 19 |
|---|---|---|---|---|
| `labyrinthStars(moves, 19)` | 3 | 3 | 3 | 3 |

Cubrir un bolsillo de N casillas cuesta N−1 movimientos, que es **exactamente** el
`optimal` que ese nivel llevaría. Así que toda corrida cae en `moves <= optimal`, la
primera banda, que devuelve 3 sin mirar nada más. `labyrinthStars` no se **invierte**
con un tour: se queda **ciega** — el tour perfecto y el callejón de 3 saltos puntúan
igual. Peor síntoma que el que yo había imaginado, y más difícil de ver en QA: nadie
reporta un bug cuando siempre le dan 3 estrellas.

**Lo que sí se invierte es el ledger**, y eso queda en pie tal cual: `recordLabyrinthBest`
guarda el número más chico, así que el callejón pisa al tour perfecto como "récord nuevo".
La conclusión del plan no cambia — grader propio + ledger propio — pero la razón del
grader es la ceguera, no la inversión.

**Decision I propose** (this is the one thing I want signed before I code):
give the tour its **own completion handler + its own grader**, and store its best
through a **coverage-aware** ledger write, rather than bending `labyrinthStars` or
inverting values at the boundary.

Rejected alternative: store `reachable − visited` so "lower is better" still holds.
It fits the existing ledger with zero surgery, but a **full tour stores 0**, and
`recordLabyrinthBest` rejects `moves <= 0` (`:71`) — the perfect run would silently
not record. Cute, and a trap. Not doing it.

## The second finding — `target` is meaningless for a tour

`mapFenPuzzle` **requires** `target` and throws on `target === start`
(`fen-puzzle.ts:101`), and `buildCatalog` BFS-verifies a path to it (`catalog.ts:161`).
A tour has no target square. Rather than author a dummy target (a lie the linter
would then enforce), `buildCatalog` branches on `kind: "knight-tour"` the same way it
already branches for `diagonal-run` (`:167`): skip the target contract, compute the
**reachable set** instead, and store its size.

`optimalMoves` for a tour = **reachable − 1** (visiting N squares takes N−1 moves).
That keeps the field's meaning honest ("the best possible run") without a new column.

## Stages (atomic commit each, TDD per CLAUDE.md: types → red test → impl)

1. **`lib/game/knight-tour.ts`** — pure module, no React.
   `reachableSquares(start, walls)` (BFS over knight moves) ·
   `legalTourMoves(pos, visited, walls)` · `applyTourMove` · `isStuck`.
2. **`lib/game/tour-score.ts`** — the second grader.
   `tourStars(visited, reachable)`: `< 80%` → 0★ (pass allowed) · `>= 80%` → 1★ ·
   more coverage → 2★ · full tour → 3★. **Does not touch `labyrinthStars`.**
3. **Catalog** — `kind: "knight-tour"` in `PuzzleInput`/`MappedPuzzle`/`LabyrinthRecord`,
   a `knightTour` runtime bucket in `BuiltCatalog` (mirrors `diagonalRun`), reachable-set
   verification in `buildCatalog`. Lint: **reject a level whose reachable set is < 8**
   (a pocket too small to be a game).
4. **Levels** — 3 placeholder rows in `content/labyrinths.json` (small / medium / large,
   walled). Placeholders **on purpose**: the founder tunes them in `/dev/labyrinth-builder`.
5. **Board** — `components/exercises/knight-tour-board.tsx`, reuses `<GameBoard>`, owns no
   chrome, hoists `visited/reachable + %` to the mission band via `onBandChange`
   (the `dr-band` hooks it adopted on 2026-07-16). X-marks on vacated squares.
6. **Host** — route from the runtime catalog (never an id/prefix, B4.2.1) + the coverage
   completion handler from finding #1. End state: stuck → overlay with pass-or-retry.
7. **i18n** — `KNIGHT_TOUR_COPY` namespace, EN + ES.
8. **Probe + E2E** — `/dev/knight-tour` + a spec that plays a level to stuck.

## Risk I am flagging, not solving

Spec says score = visited ÷ **reachable** (BFS-reachable), and that is the closed
contract. But BFS-reachable is an **upper bound a tour may not achieve** — the longest
non-revisiting path is a different (NP-hard) question. On a bad level 80% can be
literally impossible. Mitigation inside the contract: ship the placeholders **small and
walled**, and let the founder feel them in the builder. If a level proves unreachable in
practice, that is level design, which is his lane — not a code change.

## Gate

Suite green + `tsc --noEmit` clean **before** the local merge (`SESSION.md` workflow:
branch → atomic commits → merge `--no-ff` to `main` → one push).
