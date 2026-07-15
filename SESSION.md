# Session Handoff — 2026-07-14 (Rook Rails close + Graphify)

## Next session objective (tight, in order)
1. Install & configure **Graphify**; generate the initial repo graph (no product-logic changes).
2. Resume the close of **Rook Rails Delivery 1**.
3. Design + validate the one missing board: **Two Turns**.
4. Close the four labyrinths visually and technically **before** Phase B.

## Start here
Read this file, then `docs/audits/2026-07-14-rook-rails-board-audit.md` (the approved
classification + engine evidence). Plan: `docs/plans/2026-07-13-rook-curriculum-implementation-plan.md`
(§9 redesign callout). Full session detail: `docs/handoffs/2026-07-14-a9-obstacles-handoff.md`.

## Current State
- **Branch**: `fix/exercise-obstacles-a0` · last commit `15f9835d`.
- **Build**: 🔴 **RED** — 2 order-tests fail (`generated-merge`, `path.test`) because the file's
  rail ids/orders do NOT yet match the approved classification (below). Expected until the remap.
  BFS verifier itself is green (declared optimal = engine minimum for all 4).
- **Uncommitted**: `apps/web/content/labyrinths.json` + regenerated `puzzles.generated.ts` — the
  founder's manual rail redesign (WIP). `docs/audits/2026-07-14-rook-rails-board-audit.md` untracked.
  Do NOT revert; this is the work in progress.

## Approved Rook Rails classification (by board geometry, NOT builder name)
The board→level mapping is decided. The **ids/orders in the file do not reflect it yet** — that remap
is part of the close.

| Order | Level | Board (mover→target) | Status |
|--:|---|---|---|
| 0 | **Two Turns** | *to be designed* | founder designs in builder → I validate |
| 1 | **Dead End** | `a4 → e4` | approved: detours a6/a8 cost +2 (anticipate the mistake, no infinite trap); best wall grouping (13+10) |
| 2 | **Two Roads** | `g1 → b7` | approved **with caveat** (see below) |
| 3 | **Rook Run** | `d8 → f1` | approved as the final level (optimal 8, single dense line) |
| — | reserve | `c6 → e1` | optimal 8; NOT in the main ladder |

**Dead End is a penalised detour (+2), not an infinite pocket** — teaches anticipation without trapping
the player. Founder decision; do not "fix" it into a ∞ dead end.

### Two Roads (`g1 → b7`) caveat — NON-blocking
Two complete routes of different cost, confirmed against the engine:
- central road, cost 6, 3★: `g1 → f1 → f3 → d3 → d6 → b6 → b7`
- right-edge road, cost 7, 2★: `g1 → g2 → h2 → h5 → e5 → e6 → b6 → b7`

They are spatially distinct. Caveat: the two cost-6 mouths (f1, c1) converge and share the back half,
so it reads as "one central road, two mouths + one alternative" rather than a clean two-roads split,
and the penalty is only +1. **Do NOT redesign Two Roads unless the final visual review shows the
contrast doesn't read.**

## Immediate pending work
**Design `Two Turns` manually in the builder**, meeting:
- optimal 3–4 moves; two clear direction changes;
- grouped walls + visible corridors; not a trivial single corridor;
- none of the Dead End / Two Roads complexity;
- feels like the FIRST Special Training, not another basic exercise.

Then, once the FEN exists, I validate: (1) BFS optimal; (2) optimal-route count; (3) opening decisions;
(4) redundant-obstacle scan; (5) title↔geometry match; (6) mobile contact sheet of all four; (7) stop
for human review.

**Also part of the close**: remap the 4 rail records to the approved ids/orders (Two Turns 0, Dead End
1 ← a4→e4, Two Roads 2 ← g1→b7, Rook Run 3 ← d8→f1; c6→e1 out of the main ladder), then update the
order-tests (`generated-merge`, `path.test`) and run the suite green. Regenerate after editing:
`pnpm -C apps/web import-puzzles`, and **kill :3000 first** or a stale dev server serves the old catalog.

## Graphify (do first, in its own commit — never mixed with labyrinth changes)
```bash
uv tool install graphifyy && graphify install      # or: pipx install graphifyy && graphify install
```
Then `/graphify .` — expect `graphify-out/{graph.html,GRAPH_REPORT.md,graph.json}`.
Before committing: decide if `graphify-out/` should be gitignored; confirm it holds NO secrets / `.env`
/ private backups / Supabase data; document install only if it helps the permanent flow.

## Out of scope (do NOT start)
Capture for rook/bishop/queen · multiple collectible stars · BFS generalization · **Break Through** ·
builder/Supabase refactor · redesign of already-approved exercises.

## Done-when (close criteria)
Graphify installed & tested · `Two Turns` has a final validated FEN · all four Rook Rails have final
order + names · a joint mobile visual review exists · suite + TypeScript green · Phase B NOT started.

## Validation tooling (session scratchpad — may not survive next session)
`rail-analyze.js` (optimal, routes, opening decisions, per-move commit cost, dead-end/two-roads
detection), `rail-audit.js` (per-board audit + wall grouping), `rail-search.js`. Read-only, matches the
real engine. Path: `/private/tmp/claude-502/.../scratchpad/`. Rebuildable from `src/test-utils/bfs-optimal.ts`
if gone. **Design boards by hand, then validate — do NOT generate from metrics** (memory:
`feedback_metrics_dont_make_a_maze`).

## Reference
- Rook Rails must keep the **ambient stone wall** (A9): obstacles are `.is-wall`, never friendly pieces.
- Rail ids are new on purpose (board/optimal/principle changed → plan §10.3); old ids drop, loadProgress
  discards orphans, no migration.
- Contact sheets: Rook Rails D1 (v1, superseded) → https://claude.ai/code/artifact/546e590e-7313-4107-ab7a-071d5561cd1a
