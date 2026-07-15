# Rook Rails — board audit (2026-07-14)

Audit of the four manually-designed rail records **by geometry (FEN + mover +
target), not by builder id/name**. Measured against the real rook engine
(`getValidTargets` via the shared BFS). No boards were designed or changed.

Target ladder (founder): **Two Turns → Dead End → Two Roads → Rook Run**
(chain turns → anticipate a mistake → compare routes → master the full maze).

## APPROVED CLASSIFICATION (2026-07-14, founder)

Dead End is realised as a **penalised detour (+2), not an infinite pocket** — a
detour teaches anticipation without trapping the player. The a4→e4 board already
has that mechanic (a6/a8 cost +2), so it becomes Dead End. No new Dead End board.

| Level | Board | mover→target | Evidence | Status |
|---|---|---|---|---|
| Two Turns (0) | *to be designed* | — | no short board exists (all optimal 6–8) | **founder designs in builder → I validate** |
| Dead End (1) | a4→e4 | a4→e4 | 2 penalised detours a6(+2), a8(+2) = anticipate the mistake; best wall grouping (4 groups, slabs 13+10) | **assigned** |
| Two Roads (2) | g1→b7 | g1→b7 | two complete routes of different cost — see below | **candidate, confirmed with a caveat** |
| Rook Run (3) | d8→f1 | d8→f1 | optimal 8, single line, densest = full-maze mastery | **assigned** |
| reserve | c6→e1 | c6→e1 | optimal 8 but 6 equal routes + worst grouping (12 groups, 7 singletons) | **reserve** |

### g1→b7 — do two complete routes of different cost exist? YES (gap is +1)

Every opening move and the complete route it forces (via the real engine):

| via | cost | complete route |
|---|--:|---|
| f1 | **6** | g1 → f1 → f3 → d3 → d6 → b6 → b7 |
| c1 | **6** | g1 → c1 → c3 → d3 → d6 → b6 → b7 |
| e1 | 7 | g1 → e1 → f1 → f3 → d3 → d6 → b6 → b7 |
| d1 | 7 | g1 → d1 → f1 → f3 → d3 → d6 → b6 → b7 |
| **g2** | **7** | g1 → g2 → h2 → h5 → e5 → e6 → b6 → b7 |

**The two roads are real, but one is stronger than it looks and one weaker:**
- The two cost-6 routes (via f1 and via c1) are **not two roads** — they converge at
  `d3 → d6 → b6 → b7` and share the whole back half. They are two mouths of the *same*
  central road.
- The genuinely different road is **via g2** (cost 7): it climbs the right edge
  (g2 → h2 → h5) and drops in from e5/e6 — a distinct corridor, not a variant.

So the real decision is **central road (6, 3★)** vs **right-edge road (7, 2★)**. Two
complete routes, different cost: confirmed. **Caveat: the gap is only +1**, so choosing
wrong costs a single star. The Two Roads principle wanted a sharper contrast (short vs
clearly-longer). It works, but it is subtle.

**Minimum change if a sharper Two Roads is wanted (not done — your call):** lengthen the
right-edge road to +2/+3 (wall one square on the h-file approach so g2 must detour
further), OR seal the c1 mouth so the board reads as exactly two roads (f1 central,
g2 right) instead of "one road, two mouths, plus an alternative."

---

## UPDATE (2026-07-14, second pass) — duplicate resolved, Dead End gap remains

The builder now holds **four unique boards** (the one-turn/dead-end duplicate is
gone). New measurements:

| Board (builder name) | mover→target | optimal | opt. routes | ∞ dead-ends | penalised +2 | walls | groups (sizes) |
|---|---|--:|--:|---|---|--:|---|
| one-turn (NEW) | c6→e1 | 8 | 6 | none | **none** | 20 | **12 (4,3,2,2,2,1×7)** |
| two-roads | g1→b7 | 6 | 2 | none | none | 28 | 7 (8,8,4,4,2,1,1) |
| two-turns | a4→e4 | 6 | 2 | none | a6(+2),a8(+2) | 25 | **4 (13,10,1,1)** |
| dead-end | d8→f1 | 8 | 1 | none | **none** | 27 | 8 (7,5,4,3,3,3,1,1) |

**The new one-turn board did NOT create the Dead End mechanic** — it has no dead end
and no penalised detour, it is another optimal-8 long board, and it is the
**worst-grouped of the four** (12 wall groups, 7 scattered singletons — weakest maze
identity). The board named `dead-end` (d8→f1) still has **no dead end** either.

So after the update the ladder is: **two long dense "master the maze" boards**
(one-turn c6→e1 and dead-end d8→f1, both optimal 8), **one redundant dense board**
(two-roads g1→b7), and **one real Two Roads** (two-turns a4→e4). **Still zero Dead
End, still zero short Two Turns.**

Best geometric fit for the target ladder, unchanged:
- **Rook Run** ← `dead-end` board (d8→f1): optimal 8, single line, densest → mastery.
  (The new one-turn is also optimal 8 but has 6 equal routes and scattered walls — a
  weaker mastery board.)
- **Two Roads** ← `two-turns` board (a4→e4): short 6 / long 8 (+2), best grouping.
- **Two Turns** ← still a gap (no short board; the leftovers are optimal 6–8).
- **Dead End** ← still a gap (no pocket on any board).

**Minimum change for Dead End:** wall off one branch of a dense board so an opening
move runs into a true pocket (commit cost ∞, or ≥ optimal+2 forced back-out). Best
donor is one of the two redundant long boards (one-turn c6→e1 or two-roads g1→b7) —
converting a third "master the maze" board into the missing trap. Human picks WHICH
corridor reads as the trap; the engine confirms the pocket after.

---

## First pass (superseded above) — there were 3 unique boards, not 4

`rook-rail-one-turn` and `rook-rail-dead-end` are **byte-identical** (FEN + mover +
target all equal: `NNNR1NNN/8/1NN1N1N1/1N2NN2/2NNN2N/N1N3N1/N3NNN1/NNN5`, d8 → f1).
One is a copy of the other. So four records point at **three geometries**.

## Per-board measurements

| Board (builder name) | mover→target | optimal | optimal routes | complete alt. routes | hard dead-ends (∞) | penalised detours (+2) | walls | wall groups (sizes) |
|---|---|--:|--:|--:|---|---|--:|---|
| **A** (one-turn = dead-end) | d8→f1 | 8 | 1 | 4 | none | **none** | 27 | 8 (7,5,4,3,3,3,1,1) |
| **B** (two-roads) | g1→b7 | 6 | 2 | 5 | none | **none** | 28 | 7 (8,8,4,4,2,1,1) |
| **C** (two-turns) | a4→e4 | 6 | 2 | 6 | none | **a6(+2), a8(+2)** | 25 | **4 (13,10,1,1)** |

Opening-move commit costs (the decision profile):
- **A**: d7:8 · e8:9 · d6:9 · d5:9 — one real line, the rest are +1. No trap.
- **B**: f1:6 · c1:6 · e1:7 · d1:7 · g2:7 — two equal shortest lines, alts only +1.
- **C**: b4:6 · c4:6 · a5:7 · a7:7 · **a6:8 · a8:8** — two shortest + two +2 detours.

## Finding 1 — the builder names do NOT match the demonstrated mechanic

- **C is named "two-turns" but is geometrically the best Two Roads**: two shortest
  lines (6) plus penalised +2 alternatives (a6, a8), and the cleanest maze walls of
  the three (two big slabs of 13 and 10 — best visual identity).
- **A is named "one-turn"/"dead-end" but is geometrically Rook Run**: the longest
  (optimal 8), densest, single hard line — mastery of the full maze. It has **no
  dead end at all**, so its "dead-end" name is unearned.
- **B ("two-roads") is a second Rook-Run-flavoured board**: dense, find-the-line,
  two equal shortest routes, no penalised choice.

## Finding 2 — two mechanics are demonstrated; two are not

- ✅ **Rook Run** — demonstrated by **A** (optimal 8, dense, single line). Strongest fit.
- ✅ **Two Roads** — demonstrated by **C** (short 6 vs long 8, the +2 penalty *is* the
  compare-routes decision). B is a weaker candidate (its alts are only +1 → no star cost).
- ❌ **Dead End** — **no board demonstrates it.** None has a hard dead end (∞), and only
  C has any penalised detour — but that reads as "a longer road," not "a pocket you
  enter and must back out of." "Anticipate a mistake" needs a branch that *ends*.
- ❌ **Two Turns** — **no board demonstrates it.** All three are optimal 6–8; none is the
  short, legible chain-of-turns (optimal ~3) the ladder's low rung wants. B is the
  leftover, but it is long and dense — a third Rook-Run flavour, not Two Turns.

## Proposed 1:1 assignment (by geometry)

| Level | Board | Evidence | Verdict |
|---|---|---|---|
| Two Turns (0) | — | none is short / chain-of-turns | **gap** |
| Dead End (1) | — | none has a pocket/∞; C's +2 is a long road, not a dead end | **gap** |
| Two Roads (2) | **C** | short 6 / long 8 (+2 penalty), best wall grouping | **fits** |
| Rook Run (3) | **A** | optimal 8, densest, single line = full-maze mastery | **fits** |

**B is redundant** for this ladder: it is a second dense find-the-line board, which
either Two Roads (C) or Rook Run (A) already cover better.

## Minimum changes (no new boards — smallest edit to the closest candidate)

1. **Dead End** — closest is **B** (the leftover). Minimum change: wall off one of its
   branch corridors so an opening move leads into a true pocket (commit cost ∞, or ≥
   optimal+2 with a forced back-out). That converts a redundant Rook-Run board into the
   missing "anticipate a mistake" level. Needs a human pass on WHICH corridor reads as
   the trap — the engine can then confirm the pocket.
2. **Two Turns** — no board is close. A short board (optimal ~3, one false fork) does not
   exist among the three. This rung likely needs a genuinely new, *smaller* board — the
   only true gap, and consistent with dropping the old One Turn: the ladder still needs a
   gentle entry, just a harder one than One Turn was.

## What this means for the ladder

Three dense boards, all optimal 6–8, do not make a four-rung difficulty ladder —
they make three variations of "master the maze." The ladder needs **spread**: a
short entry (Two Turns), a trap (Dead End), a route choice (Two Roads), and the long
mastery run (Rook Run). Today only the top two rungs (Two Roads, Rook Run) are real.
