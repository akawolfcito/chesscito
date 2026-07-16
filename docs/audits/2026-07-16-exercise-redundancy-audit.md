# Exercise redundancy audit — knight, pawn, queen, king (2026-07-16)

Run it yourself: `pnpm -C apps/web exec tsx scripts/audit-redundancy.ts`

## Why

Curating the four uncurated pieces (2026-07-15) wrote **copy over boards that already
existed**. Rook and bishop got something more: an audit that **deleted** exercises teaching
nothing new (rook-3 repeated rook-2's file move; rook-5 was rook-4's corner turn again —
replaced by `rook-distance-1` / `rook-no-diagonal-1`). Knight, pawn, queen and king never
got that pass. This is that pass, **measured with the real engine** (BFS + legal moves),
not by eye.

## The metric

Each exercise gets a **shape**: `optimalMoves | optimalRoutes | firstMoveChoices | geometry
| reach | open-or-blocked`. Two exercises with the same shape ask the player for the same
thing. That is a **candidate, not a verdict** — some pairs repeat a shape on purpose.

> **The tool's first version was wrong, and the rook caught it.** Without `reach` it flagged
> `rook-2` / `rook-distance-1` as duplicates — the pair the rook audit created *deliberately*
> ("one square is a move too"). Distance is what separates a repeat from a contrast. With
> `reach` added, **rook reports zero repeats** — the audited reference comes back clean,
> which is the signal the metric works.

## Findings — 6 candidates, 4 real

| Pair | Shape | Verdict |
|---|---|---|
| bishop-1 / bishop-2 | `1\|1\|7\|diagonal\|far\|open` | **Deliberate.** Bishop is audited (B4.3); bishop-2 teaches the *other* diagonal + "always light squares". |
| knight-2 / knight-3 | `1\|1\|2\|offset\|near\|open` | **Deliberate.** The corner has exactly two jumps; showing both IS the lesson. |
| **pawn-3 / pawn-4** | `1\|1\|2\|diagonal\|adjacent\|open` | 🔴 **Real.** c5→d6 and f4→g5 are the same one-step diagonal capture, twice. |
| **queen-6 / queen-10** | `3\|27\|7\|same-rank\|near\|blocked` | 🔴 **Real, the strongest.** a1→c1 and a8→c8 are the *same board mirrored* to the other corner. |
| **king-2 / king-4** | `1\|1\|5\|diagonal\|adjacent\|open` | 🔴 **Real.** e1→f2 and e1→d2: same square, mirrored diagonal step. |
| **king-6 / king-9** | `7\|1\|3\|diagonal\|far\|open` | 🔴 **Real.** h8→a1 and a8→h1: the same 7-move walk mirrored. |

## What the measurement corrected

My pre-audit suspicions, checked against data:

| Suspicion | Result |
|---|---|
| knight-6 / 9 / 10 "three long-routes, same idea" | ❌ **Wrong.** They escalate: opt 3/4/5, routes 1/6/38. |
| queen-2 vs queen-4 "both a rook line" | ❌ **Wrong.** Different geometry (file vs rank), and it is the pattern rook already set (rook-1 rank, rook-2 file). |
| king-2 vs king-4 · king-6 vs king-9 | ✅ Right. |
| pawn-3 / pawn-4 · queen-6 / queen-10 | 😬 **Missed entirely** — the two the metric found. |

Four of six calls made by eye were wrong. Cf. [[feedback_suspect_your_derivation_first]].

## Recommendation — NOT applied, deliberately

Each duplicate should be **replaced by a lesson the piece is missing**, the way the rook
audit did it. Concrete openings, in order of value:

1. **pawn-4 → "the pawn cannot capture forward."** The pawn's sharpest rule and the
   curriculum has no exercise for it: an enemy directly ahead **blocks and cannot be taken**;
   the only way on is the diagonal. This is the pawn's `no-diagonal` — a contrast lesson.
   ⚠️ Verify first that the engine models a *non-capturable enemy straight ahead*; today
   forward blockers in `pawn-7` / `pawn-10` are **friendly** obstacles.
2. **king-4 → "the king is not a queen."** It cannot slide: a square two steps away costs
   two moves. The king curriculum has no contrast lesson at all.
3. **king-9 → a walk that must round something**, not a second open diagonal.
4. **queen-10 → drop the mirror**; the queen already has three blocked-rank detours
   (6, 7, 9). A different constraint (blocked *diagonal*) is the gap.

**Left unapplied on purpose:** the founder tunes exercises in `/dev/labyrinth-builder`, and
these are four board edits, not engine work. The audit's job was to say *which four and why*.
The signature games are the build.
