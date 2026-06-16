# Design — Exercises in the Builder + id-keyed exercise progress

**Date:** 2026-06-16 · **Status:** Red-teamed vs code (scope reduced — id-map infra already exists). DB-future noted. Ready for plan. · Author: Wolfcito 🐾 @akawolfcito

**Extends** the Labyrinth Builder (`2026-06-16-labyrinth-builder-design.md`) +
FEN pipeline (`2026-06-16-fen-puzzle-content-pipeline-design.md`). Goal: author /
edit / order EXERCISES through the same builder flow as labyrinths.

## Problem
The builder authors labyrinths (id-keyed progress → edit/reorder is safe).
Exercises are different: their progress is a **positional array**
(`PieceProgress.stars: number[]`, indexed by `EXERCISES[piece]` position) with a
`exerciseIndex` cursor, and `exercises.ts` comments the order as "POSITIONAL AND
FROZEN" precisely because reordering would scramble saved stars. So we cannot give
exercises the builder's edit/reorder flow without first making exercise progress
**id-keyed**. Founder chose id-keyed (pre-launch → safe; no real player progress).

## Decisions (locked with founder)
- **Exercise progress → id-keyed** (`Record<exerciseId, stars>`), mirroring
  labyrinth progress. Enables edit-in-place + author `order` like labyrinths.
- **Pre-launch safety:** no real users (per project memory), so the storage
  migration carries no production-progress-loss risk. A one-shot localStorage
  migration still converts any local positional progress → id-map (lossless via
  the current `EXERCISES[piece]` order) so the founder's own test stars survive.
- **Backfill** the 60 hand-authored exercises into the editable source (like the
  18 labyrinths), so the builder loads/edits them.

## Data model change
`PieceProgress` (in `lib/game/types.ts`):
- BEFORE: `{ piece; exerciseIndex: number; stars: number[] }`
- AFTER: `{ piece; currentId: string | null; stars: Record<string, number> }`
  - `stars` keyed by exercise id (0-3). `currentId` = the id of the "current"
    exercise (replaces the positional `exerciseIndex`). `null` → default to the
    first exercise in the piece's catalog order.
- Storage key unchanged (`chesscito:progress:{piece}`). **Migration on load:** if
  the stored shape is the legacy `{ exerciseIndex, stars: [] }`, convert
  `stars[i]` → `byId[EXERCISES[piece][i].id]` and `exerciseIndex` →
  `currentId = EXERCISES[piece][exerciseIndex]?.id`. Write back the new shape.
  Unknown ids (catalog shrank) are dropped; missing ids default to 0.

## Consumers to update (enumerated — all read positional `stars` today)
- `lib/training/path.ts:60,64` — `stars.reduce` (total) + `stars[index]` per
  exercise node → use `Object.values(stars).reduce` + `stars[exercise.id] ?? 0`.
  Exercise nodes already iterate `EXERCISES[piece]` in catalog order → now also
  honor authored `order` (parity with the labyrinth change).
- `lib/game/scoring.ts:18` `totalStars(stars: number[])` → accept the id-map (or
  `number[]` via `Object.values`); update callers.
- `components/exercises/exercises-screen.tsx` — `stars.every` (1345),
  `stars[exerciseIndex]` (1518), `stars.findIndex` (2297), `stars[0]` (2377),
  `progress.exerciseIndex` (1516/2656), `stars` passed to drawer (2655). Rework
  to id-map + `currentId`. The "next exercise" cursor logic (findIndex) moves to
  catalog-order traversal by id.
- `components/exercises/exercise-drawer.tsx:25` `stars: PieceProgress["stars"]`
  → id-map; the drawer maps each node's stars by id.
- `lib/game/exercise-progress.ts` / `loadStarsPerPiece` + `has-progress.ts` →
  id-map aware.
- `lib/game/progress-adapter.ts` — ALREADY bridges positional → id-map for
  mastery; simplify/retarget it to the now-native id-map (reduces a layer).
- `hooks/use-exercise-progress.ts` — load/save/migrate + the star-write path
  (`stars[idx] = ...` → `stars[id] = ...`); rotation reads stars by id.
- `lib/game/rotation.ts` — reads stars to bias incomplete exercises → by id.
- `exercises.ts` — drop the "POSITIONAL AND FROZEN" invariant (no longer needed).

## Backfill + builder
- One-shot `scripts/migrate-exercises.ts` (mirror `migrate-labyrinths.ts`):
  emit the 60 hand-authored exercises to `content/exercises.json` as
  `LabyrinthRecord`-shaped records with `kind:"exercise"`, ids preserved, `order`
  = original catalog index. `buildCatalog` ingests `exercises.json` (it already
  ingests `labyrinths.json`); remove hand-authored exercise arrays from
  `exercises.ts`; `EXERCISES[piece] = GENERATED_EXERCISES[piece]`.
- Builder (`/dev/labyrinth-builder` → rename concept to "puzzle builder"): add a
  `kind` toggle (exercise | labyrinth). GET/POST already carry records; the dev
  API writes to `exercises.json` or `labyrinths.json` by kind. The "Existing"
  list + `order` + edit-in-place work identically per kind.

## Testing
- `use-exercise-progress.test`: legacy positional → id-map migration is lossless;
  star write/read by id; unknown-id drop.
- `path.test`: exercise nodes by id + authored order; totals by id-map.
- Backfill: 60 exercises round-trip (BFS optimalMoves match originals); combined
  catalog BFS-verified; full suite green (the safety net for the refactor).
- Builder: kind toggle authors an exercise; edit-in-place by id; GET returns both
  kinds.

## Risks
- **Largest blast radius this project** — positional progress is load-bearing
  across path/screen/scoring/drawer/rotation. The full vitest suite is the gate;
  every consumer must flip to id-map in one coherent change.
- `progress-adapter.ts` existing bridge must not double-convert after the native
  id-map lands — retarget, don't stack.
- Mastery milestones (roadmap) will build on the id-map → this unblocks them.

## Red-team review (verified vs code — scope is SMALLER than first drafted)
| # | Finding | Status | Resolution |
|---|---------|--------|-----------|
| F1 | The id-map model ALREADY EXISTS: `rotation.ts` reads stars by id (`progress?.[ex.id]`) and `progress-adapter.ts` already converts positional→id-map (slice C, 2026-06-08). So rotation + mastery are ALREADY id-keyed. | Scope reduced | The change is NOT from scratch: make PERSISTENCE native id-map + flip only the remaining POSITIONAL readers (path `stars[index]`, exercises-screen `stars[exerciseIndex]`/`findIndex`/`every`/`stars[0]`, scoring, drawer). Reuse `migrateStarsArrayToIdMap` as the one-shot migrator. |
| F2 | `migrateStarsArrayToIdMap` maps by CURRENT catalog order. If the catalog is reordered before the one-shot migration runs, positional→id mapping is WRONG. | Constraint | Ship id-keying + the exercises backfill TOGETHER with `order = original index` (same order). The on-load migration maps correctly on the unchanged order; reordering happens only AFTER, when progress is already id-keyed. |
| F3 | Double-conversion: `use-exercise-progress` (`calculatePoolMasteryFromArray`) + `visible-set` (`migrateStarsArrayToIdMap`) convert FROM the positional array today. | Must retarget | Once persistence is native id-map, those callers read the id-map DIRECTLY — do not re-convert an already-id-map. Retarget/retire the array-input adapters; keep one as the legacy-load migrator only. |
| F4 | `exerciseIndex` (positional cursor) drives the screen's "current / next exercise" nav (`findIndex`, `stars[exerciseIndex]`). | Trickiest part | Replace with `currentId` + catalog-order traversal by id. This is the highest-care UI edit. |
| F5 | Many tests build positional `stars: number[]` (`makeProgress(piece, EXERCISES[piece].map(()=>0))`). | Test churn | Update test helpers + assertions to the id-map shape, preserving intent. Full suite is the gate. |
| F6 | Backfill exercises (incl. pawn capture drills) → FEN must round-trip; BFS optimalMoves must equal the originals. | Same as labyrinths | Mirror `migrate-labyrinths.ts`; assert optimalMoves match; combined catalog BFS-verified. |

## Future (post-MVP, out of scope now)
- **DB-backed content for live updates (founder wish):** replace the committed
  `*.json` source + `pnpm import-puzzles` + deploy cycle with a Supabase table the
  builder writes to and the app reads, so authored exercises/labyrinths appear
  LIVE without a commit/deploy. Bigger (infra + read path + auth + offline
  story); a dedicated phase AFTER the file-based builder is solid. The current
  file-based pipeline is the stepping stone (same record shape ports to a row).

## Out of scope (now)
- The roadmap tiers (multi-piece, multi-star) — this only makes exercises
  builder-authorable + id-keyed; tiers are a later spec.
- ES copy for exercise explanations (EN-only, per the pipeline spec).
