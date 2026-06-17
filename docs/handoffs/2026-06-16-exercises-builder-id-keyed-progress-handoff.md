# Handoff — Exercises-Builder + id-keyed progress (2026-06-16)

**Branch:** `feat/exercises-builder` (4 commits, **NOT pushed** — per plan, push only when the founder asks).
**Base:** `c5f6fb04` (main). **HEAD:** `804e7889`.
**Suite:** 3858/3858 passing · `tsc --noEmit` clean · live builder smoke ✅ (390px).

## What shipped (5 tasks, subagent-driven, two-stage reviewed)

| # | Commit | What |
|---|--------|------|
| 1 | `7433550e` | `PieceProgress` → id-keyed sparse map (`{ piece; currentId: string\|null; stars: Record<id,number> }`); `loadProgress` migrates legacy positional localStorage losslessly by **current catalog order**, writes id-map back (idempotent), sanitizes already-id-map data. Removed dead `migrateStarsLength` + 7 tests. |
| 2 | `d86bf915` | Flipped all positional star readers to the id-map (path.ts, scoring left as array helper w/ sole test consumer, exercises-screen, exercise-drawer, use-rotation-steering, visible-set→native id-map dropping the round-trip [F3], has-progress, exercise-progress, **hub-scaffold loadStarsPerPiece** — the last 3 read localStorage directly so they now tolerate BOTH shapes; this was a real Task-1 functional gap the implementer caught). |
| 3 | `82e43a73` | Backfilled the 60 hand-authored exercises into `content/exercises.json` (mirrors the labyrinth pipeline). **`order = original index`**, catalog order byte-identical incl. the frozen King tail (king-9/10/8 → order 7/8/9). All 60 `optimalMoves` re-asserted lossless. `EXERCISES[piece] = GENERATED_EXERCISES[piece]`. New `scripts/migrate-exercises.ts` + `migrate-exercises` npm script. |
| 4 | `804e7889` | Builder `kind` toggle (exercise\|labyrinth) on `/dev/labyrinth-builder`; dev API routes by `kind` (exercise→exercises.json, default labyrinth→labyrinths.json), strips `kind` before persist, rebuilds from both buckets, GET returns both + `?kind=` filter. Exercise-only fields (tier/tags) round-tripped on edit. +5 route tests. |

**Red-team F2 honored:** Tasks 1-3 landed together; the positional→id migration maps on the unchanged catalog order. Reordering is now a builder action (safe post-backfill).

## Live smoke (Task 5) — done, reverted
- Dev server :3947 → POST a test rook exercise (a8→h8, order 99) via the dev API (the Save path) → wrote **only** `exercises.json` + regenerated `puzzles.generated.ts` (labyrinths.json untouched) → new `rook-gen-*` appeared **last in the rook pool at the chosen order**.
- `/exercises` rendered correctly at 390px (MISSION modal, board, HUD, dock intact) with the regenerated catalog.
- Mutation reverted (`git checkout` of the 2 files); temp script removed; tree clean.

## Open follow-ups
1. **Builder-authored exercises have no editorial copy** → `resolveExerciseDescription` hits a use-intl missing-message **fallback** (dev console warning, NOT a crash; the 60 backfilled exercises are fine — they have `editorial.ts` entries). A new builder exercise renders with a fallback description. Fix path: either let the builder author the description into `editorial.ts`/`GENERATED_EXERCISE_DESCRIPTIONS`, or add a graceful default. Pairs with Task-4's noted gap (builder UI can't author `tier`/`tags` from scratch — new exercises default `tier:medium`, no tags).
2. **No Delete button in the builder** (pre-existing; the rook test maze `rook-gen-00q06dtn` sits first in labyrinths.json with no UI removal).
3. **VR baselines** not refreshed — behavior-preserving type flip, no pixel changes, all RTL green; run `pnpm test:e2e:visual` at cluster close if desired.
4. DB-live-updates: still a future phase (out of scope here).

## Next steps
- Founder decides: push `feat/exercises-builder` + open PR, or keep local.
- Optional: on-device MiniPay smoke of `/exercises` + the builder toggle at 390px.
- Then pick up follow-up #1 (builder description authoring) if exercises are to be founder-editable end-to-end.
