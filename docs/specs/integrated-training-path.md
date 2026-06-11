# Spec — integrated-training-path

**Date**: 2026-06-11
**Status**: draft
**Verified against**: commit `9961f43b`

## Problem

Exercises and Labyrinths live as two disconnected surfaces. Labyrinths hide behind an
EXERCISES/LABYRINTHS pill toggle in `MissionPanelCandy` that (a) only appears after the
badge threshold (`totalStars >= 10`, `exercises-screen.tsx:2089`) and (b) only ever plays
`labyrinthList[0]` (`exercises-screen.tsx:2091`) — so 12 of the 18 catalog labyrinths
(everything except each piece's first: rook-lab-2/3, bishop-lab-4, knight-lab-2/3/4/5,
pawn-lab-3/4/5, queen-lab-2/3) are shipped but **unreachable**. The product goal is one training path per
piece where labyrinths feel like the natural continuation of exercises, not a separate tab.

### Current state (diagnostic)

| Surface | Catalog | Progress store | Economy | Proof |
|---|---|---|---|---|
| Exercises | `EXERCISES[piece]` (5–10/piece, tiers easy/medium, hard pending) | `chesscito:progress:{piece}` stars array (0–3 each) | +1 Peón first completion (wallet), Hint 1 Peón, SaveScore | Badge claim at 10★ (`/api/sign-badge`) |
| Labyrinths | `LABYRINTHS[piece]` (1–5/piece, 18 total, same `Exercise` type) | `chesscito:labyrinth-best:{piece}` best-moves map; stars derived from moves | none | LabyrinthBadge mint (`/api/sign-labyrinth`, minStars 1) |

Rotation engine: flag off by default (`rotation-flag.ts`); filters exercises to a daily
5-subset; steering effect at `exercises-screen.tsx:914-927`.

## Goal

A single per-piece progression — Easy Exercises → Medium Exercises → capture/challenge
exercises → Easy Labyrinths → Hard Labyrinths → Badge → Mastery — rendered as one path,
with labyrinths unlocking mid-training and all catalog labyrinths reachable.

## Non-goals

- New routes or screens (path lives inside existing `/exercises` surfaces).
- Global/event labyrinths (`campaignId` reserved, untouched).
- Hint inside labyrinths (defer; interacts with the queued Deep Hint spec).
- SaveScore for labyrinths (proof stays = LabyrinthBadge mint).
- Changing `BADGE_THRESHOLD`, stars semantics, localStorage formats, rotation engine,
  Get Peones, Coach, payment rail, Victory.
- New persisted entity or migration. `TrainingNode` is a **derived view-model only**.

## Contracts (SDD)

New module `apps/web/src/lib/training/path.ts` (pure, no React):

```ts
import type { PieceId, Exercise, PieceProgress } from "@/lib/game/types";

export type TrainingNodeKind = "exercise" | "labyrinth" | "badge" | "mastery";
export type TrainingNodeStatus = "locked" | "available" | "complete";

export type UnlockRule =
  | { type: "always" }
  | { type: "stars"; min: number }       // piece totalStars (exercise stars ONLY)
  | { type: "node"; nodeId: string };    // that node must be complete

export type TrainingNode = {
  id: string;            // exercise id | labyrinth id | `badge:{piece}` | `mastery:{piece}`
  kind: TrainingNodeKind;
  piece: PieceId;
  unlock: UnlockRule;
  status: TrainingNodeStatus;
  stars: number | null;  // best stars for exercise/labyrinth nodes, null for milestones
};

export type TrainingPathInput = {
  piece: PieceId;
  progress: PieceProgress;                       // existing stars array
  labyrinthBests: Record<string, number>;        // existing bests map
  badgeClaimed: boolean;                         // on-chain read (false for guests)
};

export const LABYRINTH_UNLOCK_THRESHOLD = 6;     // stars, was implicitly 10

export function buildTrainingPath(input: TrainingPathInput): TrainingNode[];
export function getPieceMastery(path: TrainingNode[]): "none" | "badge" | "mastered";
```

New Peones earn source (slice 4): `labyrinth_completion`, added to
`PEONES_DAILY_CAP_SOURCES`, idempotency key `labyrinth_completion:{piece}:{labyrinthId}`.

## Progression model

Node order per piece (path is **guided order, not a hard linear gate** — see B7):

1. Exercise nodes, catalog order (easy tier → medium tier → capture/challenge by
   `isCapture`/`tags`). Unlock: current behavior unchanged (`always` + existing
   sequential/rotation steering).
2. Labyrinth nodes, easy→hard ordered by `optimalMoves` ascending (explicit `tier` on
   `defineLabyrinth` is a future refinement).
   - First labyrinth: `{ type: "stars", min: LABYRINTH_UNLOCK_THRESHOLD }` (6★).
   - Each subsequent labyrinth: `{ type: "node", nodeId: previousLabyrinth }`
     (complete = ≥1★ best). **This makes dormant labs reachable.**
3. Badge node: `{ type: "stars", min: BADGE_THRESHOLD }` — **unchanged contract** (10★,
   exercise stars only). Claim still requires wallet + correct chain.
4. Mastery node (new, presentational): complete when badge claimed/claimable **and** every
   labyrinth of the piece has ≥1★. No contract, no chain write, no new storage — derived.

Answers to the founder questions:

1. **Unlock by stars** (rotation-safe; "complete exercise X" rules break under rotation),
   plus node-chaining between labyrinths.
2. **Labyrinths stay per-piece** (current catalog). Global/event labs out of scope.
3. **The LABYRINTHS toggle is removed in slice 3**, replaced by tappable path nodes.
   Pre-launch mode: no fallback period needed.
4. **Badge = exercises only (unchanged). Mastery = badge + all labyrinths.** Mastery is a
   new visual tier, not a new on-chain artifact.
5. **Labyrinths award stars (already) + Peones**: flat +1 first completion, wallet only,
   daily-capped, mirroring `training-earn.ts`. They do NOT count toward `BADGE_THRESHOLD`.
6. **Hint in labyrinths: no** (deferred to Deep Hint block).
7. **SaveScore: exercises only.** Labyrinth proof remains the LabyrinthBadge mint.
8. **Mobile**: vertical node rail extending the existing `MissionDetailSheet` journey rail;
   compact "path strip" in the mission panel. No carousel (hard rule), no horizontal
   scroll, fits 390px.

## Behavior

1. Given a piece with 0★, `buildTrainingPath` returns exercise nodes available per current
   rules, all labyrinth nodes `locked`, badge `locked`, mastery `locked`.
2. Given `totalStars >= 6`, the first labyrinth node is `available`; remaining labyrinths
   stay `locked` until the previous one has ≥1★ best.
3. Given a labyrinth best recorded, its node is `complete` with derived stars
   (`getLabyrinthStars` mapping unchanged: optimal=3★, +2=2★, +4=1★).
4. Given `totalStars >= 10`, the badge node is `available` (claimable) even if labyrinth
   nodes are still locked/incomplete — milestones unlock by their own rule, the path
   visual order does not gate them (B7).
5. Given badge claimed (or claimable threshold met for guests' local view) and all piece
   labyrinths ≥1★, `getPieceMastery` returns `"mastered"`.
6. Tapping an `available` labyrinth node enters `labyrinthMode` with **that** labyrinth
   (replaces the `labyrinthList[0]` hardcode with node-selected index).
7. Tapping a `locked` node shows lock state + "Unlocks at N★" copy (promise-first, no
   jargon). It never navigates.
8. While in labyrinthMode, the rotation steering effect must not yank the user back to an
   exercise (steering is suspended while `effectiveLabyrinthMode` is true).
9. On first completion of a labyrinth (bestBefore == null → best recorded), wallet
   connected: POST `/api/peones/earn` with source `labyrinth_completion`, amount 1,
   idempotency key as specified. Guests: no call, no error.
10. Guests see the full path with identical unlock logic (stars are local); badge and
    mastery nodes render "Connect to claim" instead of claim CTA.
11. With rotation ON or OFF, the path lists the **full** catalog; rotation only affects
    which exercise the steering activates, never node visibility or unlock math.
12. Removing the pill toggle leaves no orphan: `labyrinthAvailable` prop chain in
    `MissionPanelCandy` is deleted in the same slice.

## Edge cases

- Piece with a single labyrinth (rook, queen, king): path has one lab node; mastery =
  badge + that one lab.
- Queen/king have 5 exercises (15★ max) vs others 10 (30★ max): thresholds 6/10 still
  reachable; content gap noted in Out of scope.
- Labyrinth best exists from the old toggle era (pre-path): node renders complete —
  no progress lost, unlocks may *loosen* (10★→6★), never tighten.
- `LABYRINTHS[piece]` empty (future piece): no lab nodes, mastery = badge only.
- localStorage unavailable (private mode): path degrades like current progress does
  (in-memory defaults), no crash.
- Peones earn endpoint failure on labyrinth completion: completion + best still persist
  locally; earn is fire-and-forget like `training-earn.ts`.

## Acceptance criteria

- [ ] `buildTrainingPath` unit-tested for behaviors 1–5, 11 and all edge cases (pure fn).
- [ ] Path UI renders inside MissionDetailSheet at 390px with no horizontal overflow.
- [ ] Every labyrinth in `LABYRINTHS` is reachable via node taps (incl. knight-lab-3).
- [ ] Pill toggle removed; no `labyrinthAvailable` references remain.
- [ ] Badge claim flow regression-tested: claimable at 10★ exactly as before.
- [ ] `labyrinth_completion` earn: ledger row written once per (piece, labId), daily cap
      respected, guest short-circuits.
- [ ] Existing suites green (3519 baseline) + VR baselines for mission panel / detail
      sheet refreshed in the same PR with rationale.
- [ ] Rotation flag ON smoke: steering never exits an active labyrinth.

## Implementation slices

1. **Slice 1 — path core (recommended first)**: `lib/training/path.ts` types +
   `buildTrainingPath` + `getPieceMastery` + full unit tests. Pure lib, zero UI risk,
   zero behavior change. ~½ day.
2. **Slice 2 — read-only path UI**: extend MissionDetailSheet with the node rail
   (display only); toggle still works. VR baseline adds.
3. **Slice 3 — interactive nodes**: node tap → labyrinth selection (kills `[0]`
   hardcode), unlock at 6★, steering suspension, remove toggle.
   **Gate: QA-solve every dormant labyrinth first (see red-team P0-2).**
4. **Slice 4 — labyrinth Peones earn**: new source + daily cap + idempotency + tests.
5. **Slice 5 — mastery + telemetry**: mastery node, piece-selector crown state,
   `training.path_*` events.

## Out of scope / future

- Hard-tier exercises for queen/king (content); explicit `tier` on labyrinth defs.
- Hint / Deep Hint inside labyrinths.
- Stale comment `// de 15 estrellas posibles` at `exercises.ts:821` (pools grew to 10).
- On-chain mastery artifact.

## Open questions

- Exact `LABYRINTH_UNLOCK_THRESHOLD` value (6★ proposed; founder may prefer 5 or 8).
- Should mastery crown show for guests at local-threshold, or only post badge claim?
  (Spec proposes: show progress, gate the crown on claim, "Connect to claim" copy.)
