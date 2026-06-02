# Labyrinth Design v0.1 — Audit + Quality Pass

**Date:** 2026-06-02
**Owner:** Product / Puzzle Design
**Status:** Phase A audit + Phase B pawn-rule fix landed (no commit yet)
**Scope:** Improve labyrinth quality across the catalog before any visual polish — focus on rule correctness (especially Pawn), pedagogy, and a single shared design vocabulary. Sequel to `2026-06-02-training-content-v0.1.md`.

---

## 0. Guiding constraints

- Do **not** touch contracts, monetization, PRO, Peones, leaderboard, scoring rules, or thresholds.
- Do **not** change the `10★ per piece` Labyrinth unlock threshold.
- Do **not** repaint or restyle anything — visual polish is the next cluster.
- Preserve existing labyrinth IDs (they key into `chesscito:labyrinth-best:{piece}` localStorage); renaming would orphan player best-scores.
- EN/ES copy stays in sync.

---

## 1. Current state (auditoría)

### 1.1 Catalog snapshot (post Phase B.2)

| Piece  | IDs               | Optimal moves | Mechanic | Quality | Issues |
|--------|-------------------|--------------|----------|---------|--------|
| Rook   | `rook-lab-1..3`   | 3 / 3 / 3    | Rectilinear with blockers | OK | lab-1 & lab-3 both go `a1→h8` — two variations on the same concept, no clear difficulty progression |
| Bishop | `bishop-lab-3, lab-4` | 3 / 5    | Diagonal with blockers | OK | **Naming gap**: missing `bishop-lab-1`/`lab-2`. Stable IDs from prior cluster; renaming would orphan localStorage |
| Knight | `knight-lab-1..5` | 3 / 4 / 6 / 4 / 5 | L-jumps + blockers | Good | Best-developed piece in the catalog — Easy → Medium → Hard implicit progression |
| Pawn   | `pawn-lab-3, lab-4, lab-5` | 5 / 4 / 5 | Forward + diagonal-capture chains | **Mechanically sound but pedagogically Medium-Hard** | (a) Naming gap (no `lab-1`/`lab-2`); (b) dead-state risk if user goes forward instead of capturing — see §1.3 |
| Queen  | `queen-lab-1..3` | 3 / 3 / 3   | Multi-direction with blockers | OK | All optimal=3; no progressive difficulty |
| King   | `king-lab-1`     | 4 | Sidestep blocker to reach shelter | OK (just added Phase B.2) | Only 1 lab so far; medium/hard deferred |

### 1.2 How moves are computed today

`apps/web/src/lib/game/board.ts:33-61` (`getValidTargets`) dispatches to per-piece rule modules in `apps/web/src/lib/game/rules/`:

- **Sliders** (Rook, Bishop, Queen): rays stop one square before any blocker; cannot land on a blocker.
- **Knight**: 8 L-jumps; ignores blockers along the path (it's a jump), but cannot land ON a blocker.
- **Pawn**: special handling — forward 1 (or 2 from rank 1) blocked by obstacles; diagonals only when `isCapture=true` and the diagonal landing square is in `captureSquares` (allow-list).
- **King**: 8 one-square deltas; cannot land on a blocker (added in Phase B for King exercises).

The Pawn case is wired in `board.ts:49-54`:

```ts
case "pawn": {
  const pawnCaptureSquares = captureTargets !== undefined
    ? targetPos ? [...captureTargets, targetPos] : captureTargets
    : undefined;
  moves = getPawnMoves(position, blockers, isCapture, pawnCaptureSquares);
  break;
}
```

`getPawnMoves` (`apps/web/src/lib/game/rules/pawn.ts:14-55`) treats `captureSquares === undefined` as **"all diagonals allowed"** (existing test labels it `backward compat`, `labyrinth.test.ts:589-593`). This is the source of the bug below.

### 1.3 Bug: pawn can move diagonally to empty squares in L1 capture exercises

**Conditions:** `isCapture: true`, `captureTargets: undefined` (the shape of every L1 pawn capture exercise — `pawn-3`, `pawn-4`, `pawn-5`).

In rendering, `board.tsx:123` calls `getValidTargets` with a defined `targetPosition` (the exercise's target square). Inside `board.ts`, `pawnCaptureSquares` resolves to `undefined` (current code), so `getPawnMoves` treats all diagonals as allowed — the player can land on empty diagonal squares as a "capture" even though no enemy exists there.

**Concrete example (`pawn-3`, start `c5`, target `d6`, `isCapture: true`):**
- Current: from `c5`, the board offers `b6`, `c6`, `c7`(via fwd2 wouldn't apply since not on starting rank), `d6`. User can land on `b6` — wrong: no enemy on `b6`, pawn should not move diagonally.
- Intended: from `c5`, board offers `c6` (forward), `d6` (capture target). `b6` rejected.

This is what the user described in the task as "puede moverse en diagonal en situaciones donde no debería".

### 1.4 Dead-state risk in pawn labyrinths

Pawn labyrinths force consecutive diagonal captures. If a player deviates by going forward where a capture was expected, the file change required to reach the target may no longer be reachable:

- `pawn-lab-3` (`a2 → d7` via captures `b3 → c4 → d5`): if the player goes `a2 → b3 (capture) → b4 (forward instead of c4)`, they continue up file `b` and never change file → target `d7` unreachable.

This is recoverable via reset (no crash), but a beginner sees no progress indicator. Documented as Medium-Hard difficulty — not a bug. The fix is **labeling / pedagogy** (separate Easy lab that doesn't punish forward moves), not mechanics.

---

## 2. Design principles

A labyrinth is **good** when it:

1. **Teaches the identity of the piece.** Rook → rectilinear with blockers. Bishop → diagonal choice. Knight → multi-jump weaving. Pawn → forward-with-captures-as-detour. King → 8-direction reach + shelter. Queen → routing trade-off (file vs. diagonal).
2. **Forces a real decision.** A puzzle that solves itself in one obvious move is an exercise, not a labyrinth.
3. **Stays non-trivial.** Optimal ≥ 3 moves for Easy, 4+ for Medium, 5+ for Hard.
4. **Feels fair.** At least one path to the target must always exist; ambiguous "no-progress" states should be detectable or recoverable.
5. **Differentiates difficulty** by obstacle density, branching factor, and corner case awareness — not by length alone.
6. **Avoids unjust dead-ends.** A dead state without a hint to reset is frustrating; either prevent it by design or surface it in UI.

---

## 3. Per-piece model

### 3.1 Rook — straight lines + detour

- **Mechanic**: cardinal rays bounded by friendly blockers.
- **Easy**: 1 blocker, optimal 2–3 moves, one obvious detour file/rank.
- **Medium**: 2 blockers, optimal 3–4 moves, two viable routes.
- **Hard**: 3+ blockers forming a maze, optimal 4+, requires planning.

### 3.2 Bishop — diagonal choice

- **Mechanic**: diagonal rays bounded by blockers.
- **Easy**: 1 blocker on the main diagonal, optimal 3 moves on alternate diagonals.
- **Medium**: 2 blockers requiring color-aware planning.
- **Hard**: 3+ blockers; teach that the bishop can never change color.

### 3.3 Knight — weaving jumps

- **Mechanic**: 8 L-jumps; obstacles deny landing but not transit.
- **Easy**: 1–2 blockers near start, optimal 3.
- **Medium**: 2–3 blockers in the middle of the board, optimal 4.
- **Hard**: 3+ blockers forming a corridor, optimal 5–6.

### 3.4 Queen — routing trade-off

- **Mechanic**: combined rook + bishop rays bounded by blockers.
- **Easy**: 1 blocker forcing diagonal-vs-straight choice, optimal 2–3.
- **Medium**: blockers that punish the obvious diagonal path, optimal 3–4.
- **Hard**: corridor forces efficient direction-mixing, optimal 4+.

### 3.5 King — short steps, shelter target

- **Mechanic**: 8 one-square deltas, no threat modeling in v0.1.
- **Easy**: walk to a corner with 1 blocker on the direct rank/file (king-lab-1 today).
- **Medium**: 2 blockers forcing diagonal sidestep + return to file.
- **Hard**: deferred until `attackedSquares` modeling lands (v0.2). Without threat squares, the king's natural "avoid danger" identity cannot be modeled.

### 3.6 Pawn — forward-with-captures-as-detour

- **Mechanic**:
  - **Movement**: forward only (1 square; 2 from starting rank).
  - **Capture**: only when there's something to capture on a diagonal — never as free movement.
- **Easy**: 1 blocker on the file forces a single diagonal capture, then continues forward.
- **Medium**: 2 captures required in sequence to change file (current `pawn-lab-3` / `lab-4`).
- **Hard**: chain of 3+ captures, dead-state risk if player deviates (current `pawn-lab-5`).

---

## 4. Pawn rule — explicit contract

**Forward (movement):**
- Allowed when the target file is the same as origin AND target rank is exactly origin+1.
- From starting rank (rank 1, 0-indexed), a 2-square forward is also allowed if both intermediate and final squares are clear of obstacles.
- Forward is **the only** legal pawn move when there is nothing to capture.

**Diagonal (capture only):**
- Allowed when there is something to capture on the diagonal landing square:
  - In **labyrinths**: the landing must be in `captureTargets` OR equal to `targetPos`.
  - In **L1 capture exercises** (`isCapture: true`, no explicit `captureTargets`): the landing **MUST equal `targetPos`**. **Today this is broken** — see §1.3.
- Never allowed as free movement.

**Never:**
- Backward moves (rank < origin.rank).
- Sideways moves (same rank, different file).
- Diagonal landing on an empty square (current bug for L1 capture exercises).

### 4.1 Fix wired in Phase B (this commit's scope)

`board.ts:49-54` is updated:

```ts
case "pawn": {
  const pawnCaptureSquares = captureTargets !== undefined
    ? targetPos ? [...captureTargets, targetPos] : captureTargets
    : isCapture && targetPos
      ? [targetPos]                 // L1 capture: only the target square is a valid diagonal
      : undefined;                  // L1 movement or rule-direct call: leave as-is for backward compat
  moves = getPawnMoves(position, blockers, isCapture, pawnCaptureSquares);
  break;
}
```

Why the `undefined` fallback survives: existing test `labyrinth.test.ts:589-593` calls `getValidTargets("pawn", pos, [], true)` with no `targetPos`. That path is preserved (returns `undefined` → all-diagonals semantics) to avoid breaking direct-API callers like `tutorialHints` in `exercises-screen.tsx:1998` (which passes only 2 args and defaults `isCapture=false` anyway).

Pre-fix breakage scenarios:
- L1 capture exercises (`pawn-3`/`pawn-4`/`pawn-5`): player could pseudo-capture on empty diagonals.

Post-fix behavior:
- L1 capture exercises: only the target square is a valid diagonal landing. Forward path unchanged.
- Labyrinth pawn puzzles: unchanged (captureTargets explicit).
- Direct API calls without `targetPos`: unchanged (all-diagonals semantics).

---

## 5. Minimum implementation in this cluster

| # | Action | Risk | Status |
|---|--------|:----:|--------|
| A | Pawn-rule fix in `board.ts` for L1 capture exercises | Low | ✅ landed (Phase B) |
| B | Regression tests for the fix in `labyrinth.test.ts` | Low | ✅ landed (Phase B) |
| C | At least 1 King labyrinth (already shipped in Phase B.2) | — | ✅ shipped earlier today |
| D | Document Easy/Medium/Hard tiers per piece + naming gap (Bishop, Pawn) | None | ✅ this spec |
| E | Polish existing easy labyrinths (FEN tweaks) | Medium | ⏸️ deferred to Phase C — separate audit cluster |
| F | Add a true Easy pawn labyrinth (1 forced capture, continues forward to target) | Low | ⏸️ deferred to Phase C — needs design pass + dedicated test |
| G | Medium / Hard tier additions per piece | Medium | ⏸️ deferred to Phase D — design exercise |

---

## 6. Phased rollout

| Phase | Goal | Status |
|-------|------|--------|
| **A** | Audit + spec | ✅ this doc |
| **B** | Pawn-rule fix + tests | ✅ landed in this commit (pending review) |
| **C** | Easy labyrinth polish + new Easy pawn lab | ⏸️ deferred |
| **D** | Medium / Hard tier additions | ⏸️ deferred |
| **E** | `attackedSquares` modeling → unlocks King Hard + true Pawn captures-of-real-enemies | ⏸️ deferred to v0.2 |

---

## 7. Acceptance criteria

- [x] Each existing piece keeps ≥ 1 working labyrinth that respects the piece's identity.
- [x] Pawn cannot move diagonally except onto a capture target (`captureTargets` or `targetPos`).
- [x] No existing labyrinth becomes unsolvable due to the fix (verified via regression tests + the pawn-lab tests in `labyrinth.test.ts:342-405`).
- [x] King has a base labyrinth (`king-lab-1` from Phase B.2).
- [x] 10★ unlock threshold unchanged.
- [x] No contracts, monetization, PRO, Peones, leaderboard, scoring, layouts touched.
- [x] EN/ES copy unchanged (no UI strings added in this cluster).
- [x] Test counts reported (see commit message).
- [x] Files modified reported (see commit message).

---

## 8. Risks + follow-ups

### 8.1 Bishop / Pawn ID naming gap

**Risk**: `bishop-lab-3, lab-4` (no `lab-1, lab-2`) and `pawn-lab-3, lab-4, lab-5` (no `lab-1, lab-2`) are visible inconsistencies. Stable IDs are necessary because they key into `chesscito:labyrinth-best:{piece}` records (`labyrinth-progress.ts:12-16`). Renaming would orphan every saved best-score.

**Decision**: keep IDs as-is. If product later decides normalization is worth the effort, add a migration in `labyrinth-progress.ts` that remaps `bishop-lab-3 → bishop-lab-1` on first read.

### 8.2 Dead-state in pawn labyrinths

**Risk**: in `pawn-lab-3..5`, a non-optimal first move (forward instead of capture) makes the puzzle unwinnable. No UI hint surfaces this; the only recovery is reset.

**Decision**: deferred to UX/polish cluster. Options for that cluster:
- Add a "no progressing moves" warning chip in the HUD.
- Add a true Easy pawn labyrinth (Phase C) so beginners encounter a forgiving puzzle first.
- Document the trade-off in the in-game hint copy.

### 8.3 King v0.2 `attackedSquares`

**Risk**: King's "avoid danger" identity requires modeling threatened squares. v0.1 fakes it via copy ("Reach the shelter") but mechanics stay obstacle-only.

**Decision**: design + ship in v0.2 cluster. The catalog can grow Medium/Easy obstacle-only King labyrinths in the meantime; Hard waits.

### 8.4 VR baselines

**Risk**: pawn labyrinths' valid-target highlights now show fewer diagonals (post-fix). Any baseline screenshot that captured a pawn capture exercise mid-selection would shift.

**Decision**: existing baselines (`hub-clean.png`, `hub-daily-tactic-open.png`, `hub-shop-sheet-open.png`) do not capture a selected pawn in a capture exercise. No baseline refresh needed pre-PR. Run `pnpm test:e2e:visual` once on the branch before promote; if any pawn-related snapshot is red, eyeball + refresh per `vr-baseline-discipline`.

---

## 9. Files touched in this cluster (Phase B)

- `apps/web/src/lib/game/board.ts` — Pawn case: tightened `pawnCaptureSquares` fallback when `captureTargets` is undefined but `isCapture=true` and `targetPos` is defined.
- `apps/web/src/lib/game/__tests__/labyrinth.test.ts` — new regression tests covering the L1 capture exercise pawn case.
- `docs/superpowers/specs/2026-06-02-labyrinth-design-v0.1.md` — **NEW** — this document.

No other files touched in v0.1.
