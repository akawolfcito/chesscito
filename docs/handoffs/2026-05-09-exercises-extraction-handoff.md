# Session Handoff — 2026-05-09 (Exercises Route Extraction)

## What this session did

Reframed `<PlayHubRoot>` (1612 LOC) from "legacy code to delete" to
"the canonical exercises feature at `/exercises`". Audit revealed
`<PlayHubRoot>` is NOT legacy — it's the entire piece-exercises
gameplay surface (rook tutorial, capture, labyrinth, briefing, badge
claim, result celebrations). Scaffold has zero exercises functionality
(its PRIMARY_PLAY_CTA goes to `/arena`). Deleting would have killed
the educational gameplay feature.

The 2026-05-09 prior handoff's "now unblocked" framing was incorrect.

## Spec

- `docs/superpowers/specs/2026-05-09-exercises-route-extraction-design.md`
  (revision 2 after red-team)
- 6 P0/P1 red-team findings absorbed into r2: scope-honest non-goals,
  navigation graph completeness, explicit redirect URL construction,
  RewardColumn-tile-vs-text-link decision, pre-flight E2E baseline,
  telemetry source-string updates.

## Commits

`44b7bd8..cd9f7f7` (9 atomic commits, all on main):

| sha | what |
|---|---|
| `44b7bd8` | `docs(spec)` — design doc r2 + 19 file `git mv` from `play-hub/` → `exercises/` |
| `d856fe8` | `refactor(exercises)` — bulk perl rewrite: `PlayHubRoot` → `ExercisesScreen`, `play-hub-root` → `exercises-screen`, import paths, prose refs |
| `6db8b97` | `feat(exercises)` — new canonical `/exercises` route + 6 page tests |
| `aa7ea48` | `refactor(hub)` — drop `?legacy=1` branching from `/hub`; add server `redirect()` for legacy bookmarks per spec D5 mapping |
| `f19bb08` | `refactor(nav)` — arena `softGate.onLearn` (lines 959, 1023) → `/exercises`; `next.config.js` rewrite `/play-hub → /exercises` |
| `6721c0c` | `feat(hub)` — secondary "Practice pieces" text-link below `<PrimaryPlayCta>` (D6.B; D6.A unworkable, see "Decisions") |
| `8717a80` | `refactor(telemetry)` — `pro-active-cta` test fixtures + `editorial.ts` + `shop-catalog.ts` comments rewrite `/play-hub` → `/exercises\|/hub` |
| `6a8efc8` | `test(e2e)` — 4 specs retargeted from `/` and `/hub?legacy=1` to `/exercises` (tutorial-banner, exercise-flow, lf-sweep-captures, visual-regression) |
| `cd9f7f7` | `docs(memory)` — `DESIGN_SYSTEM.md` bulk rewrite + `app/hub/layout.tsx` comment + MEMORY.md index entry |
| `f1d2697` | `docs(handoff)` — initial migration handoff doc |
| `59f3e92` | `test(e2e)` — pre-dismiss `<WelcomeOverlay>` in retargeted specs (E2E pre-flight fix; 26/26 green after) |
| `e3f19cb` | `test(e2e)` — `.skip` visual-regression suite pending splash-loader rebaseline |
| `2531046` | `style(typography)` — Rowdies coverage (D9 partial — see "Decisions worth knowing" §4) |
| `56617da` | `test(e2e)` — rebaseline visual-regression against /exercises (4/6 green; hub-shop-sheet-open `.skip` pre-existing) |

## Current State

- **Branch**: `main`, fully pushed to `origin/main`
- **tsc**: clean (`pnpm exec tsc --noEmit` exit 0)
- **Unit tests**: **1032/1032** passing (102 files) — was 1021/1021 at session start
- **E2E** (retargeted specs): **26/26** passing — desktop 13/13 + minipay 13/13. Pre-flight initially showed failures from `<WelcomeOverlay>` intercepting clicks at z-70 on /exercises (pre-migration the specs hit `/` LandingPage which doesn't render the overlay). Fixed in `59f3e92` by adding `chesscito:welcome-dismissed` to the addInitScript blocks.
- **E2E** (visual-regression): all 3 baselines `.skip` per `e3f19cb`. Splash loader on /exercises doesn't reliably hide within the 15s setup timeout (cold compile + first-request asset fetches). Tracked as Next Task §1 below.
- **Uncommitted work**: none.

## Architecture after

| Surface | Route | Component | Owner |
|---|---|---|---|
| Kingdom launcher | `/hub` | `<HubScaffoldClient>` | scaffold |
| Piece exercises | `/exercises` | `<ExercisesScreen>` | exercises |
| Full chess vs AI | `/arena` | arena page | arena |
| Trophies | `/trophies` | trophies page | trophies |

Cross-route nav:
- `/hub` PRIMARY_PLAY → `/arena?fresh=1`
- `/hub` "Practice pieces" link (footer) → `/exercises`
- `/arena` softGate `onLearn` → `/exercises`

## Decisions worth knowing

1. **D6 changed mid-implementation** from RewardColumn tile (A) to scaffold
   footer secondary link (B). RewardColumn tiles are typed
   `keyof REWARD_COPY` (piece names only) and shipped 2026-05-07 with
   taps wired to BadgeSheet (claim flow). A nav tile would muddy that
   abstraction. Text-link is low-density, doesn't compete with the
   dominant CTA. Test coverage: 3 cases in `hub-scaffold.test.tsx`.

2. **D5 known regression**: `/hub?legacy=1&action=shop|pro|badges`
   bookmarks lose sheet-open intent (redirect to `/hub` raw). Sheets
   reachable via scaffold UI. Pre-prod audience tiny — accepted.
   `?legacy=1` (with optional `?piece`) → `/exercises` works.
   `?legacy=1&action=trophies` → `/trophies` works.

3. **Cosmetic deferrals (per spec D9)**: `.playhub-*` CSS namespace
   (32 selectors), `SURFACE = "play-hub"` telemetry tag,
   `surface="play-hub"` primitive-boundary literal, `variant="playhub"`
   enum tokens, asset filenames (`bg-playhub-forest-mobile.png`),
   storage keys. Behavioral rename complete; namespace cleanup is a
   separate intentional pass with dashboard / visual-baseline migration.

4. **Rowdies coverage extended (commit `2531046`)**: 4 remaining
   `var(--font-game-display)` consumers from the 2026-05-09 prior
   handoff §4 audit. Resolved by applying the design-system rule
   ("Rowdies = action, Fredoka = display") at the semantic-anchor
   level: `.game-cta-depth` and `.chesscito-dock-center` get Rowdies
   directly; `.game-label` becomes `font-family: inherit` so each
   parent context applies the right token without per-class coupling.
   `.chesscito-dock-label` stays Fredoka (label, not action). This
   also closes a follow-up task from the prior handoff.

## Verification commands

```bash
# Unit tests + tsc
pnpm --filter web test
pnpm --filter web exec tsc --noEmit

# Sanity check no remaining behavioral refs to old names
rg "PlayHubRoot|play-hub-root" apps/web/src   # → 0 hits
rg "/play-hub" apps/web/src                   # → 0 hits
```

## Next Tasks

1. ~~**Visual-regression rebaseline**~~ — ✅ DONE 2026-05-09 (commit `56617da`). 4/6 baselines rebased; `hub-shop-sheet-open` remains `.skip` (pre-existing setup failure unrelated to migration; debug deferred to its own session).
2. **Cosmetic namespace pass** (deferred per D9) — explicitly deferred
   to its own focused session. Scope:
   - `.playhub-*` CSS namespace (32 selectors). Sub-decision needed:
     rename to `.exercises-*` (location-named) or split — `.board-*`
     for shared board primitives (used by both arena AND exercises),
     `.exercises-*` for exercise-only chrome.
   - `SURFACE = "play-hub"` telemetry tag in `hub-scaffold.tsx:65`.
     Sub-decision: rename to `"hub"` or `"kingdom"` (the surface IS
     the kingdom launcher post-migration), or keep for telemetry
     continuity.
   - `surface="play-hub"` literal in `<PrimitiveBoundary>` props.
   - `variant="playhub"` enum in KingdomAnchor + `surface="playhub"`
     in PrimaryPlayCta.
   - Asset filenames (`bg-playhub-forest-mobile.png`, etc.).
   Process: write a short spec with the sub-decisions, run a red-team,
   schedule alongside a planned visual rebaseline (this work will
   force baseline updates across `/hub`, `/exercises`, and `/arena`).

3. **`pendingShieldCredit` server-side fix** (carried from 2026-05-09
   prior handoff §2) — architectural bug. Shield credit happens in
   the client hook AFTER tx receipt confirmation. If the user
   navigates away (sheet closes, route change) between buy submission
   and receipt confirmation, the credit is never written. Fix is
   server-side: a `/api/credit-shield` endpoint that re-fetches the
   tx receipt, decodes `ItemPurchased`, and writes the credit
   idempotently. Requires its own design spec (similar shape to
   `/api/sign-victory` from the mint-victory work). Pre-prod,
   tester impact is small; post-prod this is a real UX/$ loss.
   Recommended next focused session.

4. **`hub-shop-sheet-open` E2E debug** — single visual baseline still
   `.skip` per `56617da`. Symptom: `button[aria-label="Shop"]` click
   doesn't surface a `[data-state="open"]` dialog within 5s on
   /exercises. Pre-existing across the migration. Bisect to find when
   it broke; could be a selector drift (aria-label) or a wiring bug.

5. **Wire `?sheet=…` URL param to scaffold** (optional) — re-enable
   the legacy bookmark sheet-open intent (`/hub?legacy=1&action=shop`
   → opens shop). Pre-prod, tester audience is tiny; track as a
   future "if anyone complains" feature.

6. **Verify telemetry dashboards** — `/play-hub` source string is
   gone from product code. If any external dashboard filtered by
   that source, expect a continuity gap from this session's deploy
   onward.

## Blockers

- None functional. Pre-existing `hub-shop-sheet-open` visual baseline failure (per 2026-05-08 handoff) survives but is unrelated to this migration.

## Notes

- The `git mv` + `git commit` sequence in commit 1 (44b7bd8) accidentally
  bundled the spec doc with the file renames. The follow-up commit
  d856fe8 carries the symbolic rewrites. History reads cleanly: spec
  + moves landed first, then the perl-driven import/symbol rewrites.
- Per global rule "Always create NEW commits rather than amending",
  did not amend the bundled commit despite imperfect message scope.
- Memory updated: out-of-repo `MEMORY.md` index entry +
  `project_exercises_extraction.md` topic file with full details.
