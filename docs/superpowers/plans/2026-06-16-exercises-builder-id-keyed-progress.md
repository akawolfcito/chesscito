# Exercises in the Builder + id-keyed progress — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Goal:** Make exercise progress id-keyed (so exercises can be edited/reordered like labyrinths), backfill the 60 exercises into the editable source, and add an exercise mode to the builder.

**Architecture:** The id-map model already exists (`rotation.ts` reads stars by id; `progress-adapter.ts` converts positional→id-map — slice C). This plan makes the PERSISTENCE native id-map, flips the remaining positional readers, backfills exercises (mirrors the labyrinth backfill), and adds a `kind` toggle to the builder.

**Tech Stack:** TS, Vitest, Next.js. `<repo>` = `/Users/wolfcito/development/BLCKCHN/GOOD_WOLF_LABS/akawolfcito/celo/chesscito`. Tests: `pnpm -C <repo>/apps/web exec vitest run <f>`; typecheck `pnpm -C <repo>/apps/web exec tsc --noEmit`.

**Spec:** `docs/superpowers/specs/2026-06-16-exercises-builder-id-keyed-progress-design.md` (red-teamed F1-F6).

**COMMAND HYGIENE (all subagents):** never `cd`; use `git -C <repo>`, `pnpm -C <repo>/apps/web`; no heredocs (use Write); typecheck via `pnpm exec tsc`. Commit, do NOT push. Work on branch `feat/exercises-builder` (create it first).

**SEQUENCING (red-team F2):** Tasks 1-2 (id-keyed persistence + readers) and Task 3 (backfill with `order = original index`) must land together so the one-shot positional→id migration maps on the UNCHANGED catalog order. Reordering is a builder action AFTER this ships.

---

## Task 1: id-keyed persistence + data model

**Files:** `src/lib/game/types.ts`, `src/hooks/use-exercise-progress.ts`, `src/lib/game/progress-adapter.ts` (reuse `migrateStarsArrayToIdMap`), tests `src/hooks/__tests__/use-exercise-progress.test.ts`.

- [ ] **Step 1: Failing tests** — legacy positional → id-map migration is lossless; star write/read by id; legacy `currentId` from `exerciseIndex`; unknown ids dropped.
```typescript
// load a legacy {exerciseIndex:2, stars:[3,1,0,...]} from localStorage → expect
// progress.stars[EXERCISES.rook[0].id] === 3, [1].id===1, currentId===EXERCISES.rook[2].id
// recordStars(id, 2) → progress.stars[id] === 2; reload persists id-map shape.
```
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement.**
  - `types.ts` `PieceProgress`: `{ piece: PieceId; currentId: string | null; stars: Record<string, number> }`.
  - `use-exercise-progress.ts` `loadProgress`: SSR-safe default `{ piece, currentId: null, stars: {} }`. On load: if parsed has `Array.isArray(stars)` (legacy), convert with `migrateStarsArrayToIdMap(piece, stars)` → id-map, and `currentId = EXERCISES[piece][parsed.exerciseIndex]?.id ?? null`; write back the new shape. If already id-map (`stars` is a non-array object), validate values 0-3, drop ids not in the current catalog.
  - star-write path: `stars[id] = bestStarsAfter` (by id, not index). `currentId` setter replaces the `exerciseIndex` setter. Keep `getExerciseCount`/`emptyStars`→`{}`.
- [ ] **Step 4: Run, verify pass + `tsc` (it will surface every positional consumer — that's Task 2's worklist).**
- [ ] **Step 5: Commit** `feat(progress): id-keyed exercise progress + legacy migration`.

## Task 2: flip positional readers to the id-map

**Files (each a tsc error after Task 1):** `src/lib/training/path.ts`, `src/lib/game/scoring.ts`, `src/components/exercises/exercises-screen.tsx`, `src/components/exercises/exercise-drawer.tsx`, `src/lib/game/has-progress.ts`, `src/lib/game/exercise-progress.ts`, `src/lib/exercises/visible-set.ts` (retarget off `migrateStarsArrayToIdMap` — F3, read the id-map directly). Tests: the ones that build positional `stars`.

- [ ] **Step 1: Update each reader** (drive by `tsc --noEmit` error list):
  - `path.ts`: `totalStars = Object.values(progress.stars).reduce(...)`; per-node `progress.stars[exercise.id] ?? 0`; exercise nodes honor authored `order` (use `EXERCISES[piece]` which is now order-sorted from the catalog).
  - `scoring.ts` `totalStars`: accept `Record<string,number>` (or `Object.values`); fix callers.
  - `exercises-screen.tsx`: `stars.every` → `EXERCISES[piece].every(e => (stars[e.id]??0) > 0)`; `stars[exerciseIndex]` → `stars[currentId]`; the next-exercise `findIndex` → find current exercise by id in `EXERCISES[piece]`, step to the next; `stars[0]` → first catalog id; `exerciseIndex` props → `currentId`/derived index for the drawer.
  - `exercise-drawer.tsx`: `stars: Record<string,number>`; each node reads `stars[node.id]`.
  - `has-progress.ts`, `exercise-progress.ts`/`loadStarsPerPiece`: id-map aware.
  - `visible-set.ts`: read the native id-map (stop converting an array).
- [ ] **Step 2: Update tests** that build positional stars (`makeProgress`, path.test, etc.) to the id-map shape, preserving intent.
- [ ] **Step 3: `tsc --noEmit` clean + run the touched suites green.**
- [ ] **Step 4: Commit** `refactor(progress): flip positional star readers to id-map`.

## Task 3: backfill the 60 exercises (mirror labyrinths)

**Files:** Create `scripts/migrate-exercises.ts`; `content/exercises.json`; modify `scripts/import-puzzles.ts` (ingest exercises.json), `src/lib/game/exercises.ts` (remove hand-authored exercise arrays → `EXERCISES[piece] = GENERATED_EXERCISES[piece]`); add `"migrate-exercises"` npm script.

- [ ] **Step 1:** `migrate-exercises.ts` mirrors `migrate-labyrinths.ts`: read hand-authored `EXERCISES[piece]` (entries NOT in `GENERATED_EXERCISES`), convert each via `buildFenBlock({piece, start: posToSquare(ex.startPos), goal: posToSquare(ex.targetPos), walls: (ex.obstacles??[]).map(posToSquare), captures: (ex.captureTargets??[]).map(posToSquare), order: i})`, record `{ kind:"exercise", id: ex.id, ...fen/target/mover, order: i }`, MERGE into existing `content/exercises.json` (create as `[]` if absent), assert recomputed `optimalMoves === ex.optimalMoves` before write.
- [ ] **Step 2:** `import-puzzles.ts`: read `content/exercises.json` (like labyrinths.json) and pass its records to `buildCatalog` as `kind:"exercise"` (the addPuzzle path already routes by kind). Generated exercises sort by `(order, id)`.
- [ ] **Step 3:** Run `pnpm migrate-exercises` then `pnpm import-puzzles` (exit 0). Remove hand-authored exercise arrays from `exercises.ts`; `EXERCISES[piece] = GENERATED_EXERCISES[piece]`; drop the "POSITIONAL AND FROZEN" comment.
- [ ] **Step 4:** `tsc` clean + FULL `vitest run` green (proves ids/order/optimalMoves preserved + the id-keying holds end-to-end).
- [ ] **Step 5: Commit** `refactor(content): backfill 60 exercises to content/exercises.json`.

## Task 4: builder exercise mode

**Files:** `src/app/api/dev/labyrinth/route.ts` (write by kind), `src/app/dev/labyrinth-builder/page.tsx` (kind toggle), route test.

- [ ] **Step 1:** Route: accept a `kind` on the record (default "labyrinth"); write to `content/exercises.json` when `kind:"exercise"`, else `labyrinths.json`; rebuild as today. GET returns records from BOTH files (or a `?kind=` filter). Add tests: POST exercise → writes exercises.json; GET returns both kinds.
- [ ] **Step 2:** Page: a `kind` toggle (exercise | labyrinth) at the top; the board/brushes are identical; the "Existing" list + GET filter by the active kind; Save sends `kind`. Title reflects the kind.
- [ ] **Step 3:** `tsc` clean; route tests green. (Page verified by controller smoke.)
- [ ] **Step 4: Commit** `feat(builder): exercise|labyrinth kind toggle + dev API by kind`.

## Task 5: full verification
- [ ] `pnpm -C <repo>/apps/web exec tsc --noEmit` clean + full `vitest run` green.
- [ ] Controller smoke (dev server): `/dev/labyrinth-builder` → toggle Exercise → author + Save → restart dev → confirm it appears in `/exercises` at the chosen order; legacy progress migrated (no lost stars). Screenshot 390px.
- [ ] Commit any baseline refreshes.

## Self-review notes
- Sequencing F2 honored: Tasks 1-3 ship together, order=original index, migration on unchanged order.
- F3: visible-set + use-exercise-progress read native id-map; array-input adapter kept ONLY as the legacy-load migrator.
- F1 leverage: rotation/mastery already id-keyed — Task 2 is the remaining positional readers, not a rewrite.
- Out of scope: roadmap tiers; DB-live-updates (noted as future phase).
