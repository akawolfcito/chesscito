# Handoff — Builder + UX session (2026-06-16)

Huge session. Everything below is on `main` (pushed) unless marked NOT-IMPLEMENTED.
Resume next session by saying **"continuemos"** → start the Exercises-Builder plan
(see §NEXT).

## §NEXT (entry point for "continuemos")
**Implement the Exercises-Builder + id-keyed progress plan, subagent-driven.**
- Spec: `docs/superpowers/specs/2026-06-16-exercises-builder-id-keyed-progress-design.md` (red-teamed F1-F6; scope reduced — id-map infra already exists via rotation/progress-adapter).
- Plan: `docs/superpowers/plans/2026-06-16-exercises-builder-id-keyed-progress.md` (5 tasks).
- Approach chosen: **subagent-driven** (fresh subagent per task + review). Branch `feat/exercises-builder`.
- **Critical sequencing (F2):** Tasks 1-3 ship together with `order = original index` so the one-shot positional→id-map migration maps on the UNCHANGED catalog order; reorder only after.
- Pre-launch (no real users) → the progress-storage migration is safe.

## Shipped this session (all on `main`)
**Labyrinth/Puzzle Builder (the big one):**
- FEN→Exercise mapper + `import-puzzles` pipeline + committed generated catalog (`puzzles.generated.ts`), augment-merged into `exercises.ts`.
- Dev-only editor `/dev/labyrinth-builder` (flat 8×8 grid, brushes, live BFS optimal + path overlay + shortcut warning, FEN import/export) + dev API `/api/dev/labyrinth` (POST upsert + GET, 404 in prod).
- Backfilled the 18 hand-authored labyrinths to `content/labyrinths.json` (ids/order/optimalMoves preserved); `LABYRINTHS` now sources from generated.
- **Author-controlled order:** `/exercises` orders labyrinths by the authored `order` (not optimalMoves); builder list sorted by order; Save auto-assigns a stable id; "New (clear)" → "+ New labyrinth".
- **Stone-tile walls:** labyrinth obstacles render as gray stone cells (`.playhub-board-cell.is-wall`), not locked rooks.
- Suite 3853/3853 at last full run; `tsc` clean.

**UX polish (earlier in session):**
- Arena: leave terminates match; rival avatar in gameplay. Leaders: board piece sprites + rank numbers (no circle) + full-board list incl #1/self. Dock: even row (labels always-on, center label color/font fixed, equalized icon size). Chesito Card (rechargeable Peones wallet, Account hero + chip modal) + peón sizing/air + Account sheet scroll fix. Trophies: hide COMING LATER, tone-down MY VICTORIES gold, achievements 2-col thematic-icon grid. Share: de-dup link + hide Download in MiniPay. OG: candy home preview via Satori. Action-pin icon+text spacing unified.

**Docs/strategy:**
- Economy/monetization insumo: `docs/product/2026-06-16-economy-and-monetization-strategy.md` (3 ranked models; #1 = daily loop + Streak Freeze + Deep Hint). **AWAITING founder validation.**

## Open threads / backlog (not started)
1. **Economy model** — validate #1 (daily loop + Streak Freeze + Deep Hint) before building. Decisions in the strategy doc §"Decisions to validate".
2. **Builder Delete button** — gap: can't remove a labyrinth/exercise (e.g. the rook test maze `rook-gen-00q06dtn` currently sits in `content/labyrinths.json`). Small follow-up.
3. **DB-live-updates** — founder wants content edits live without commit/deploy (Supabase table vs committed JSON). Noted as a future phase in the exercises-builder spec.
4. **Roadmap tiers** — multi-piece × multi-star puzzles with optimal-move scoring (founder's longer-term vision); later spec.
5. **Share URLs www** — `editorial.ts` uses apex `chesscito.com`; the (possibly stale) project rule says `www.`; flagged, NOT changed — confirm before touching the public domain.
6. **Builder "save → /exercises" needs a dev-server restart** (runtime file write doesn't HMR reliably). Polish idea: render the saved puzzle directly, or a "reload catalog" button.

## Notes / gotchas
- Hydration warning in `/exercises` console = **browser extension/cache**, NOT our SSR (confirmed: clean in incognito; headless Playwright shows 0 on main AND a guard branch). Don't chase it.
- A `git stash` holds early builder test experiments (`git stash list`) — disposable.
- Command hygiene + permissions: see project `CLAUDE.md` "Command hygiene" + memory [[permissions-review-each-session]]. Subagents must avoid `cd`/heredocs; allowlist has `Task`/`Agent`/`Edit`/`Write`.
