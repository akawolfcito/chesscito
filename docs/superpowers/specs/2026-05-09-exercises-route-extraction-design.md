# Exercises Route Extraction — Design Spec

**Date**: 2026-05-09
**Status**: Revision 2 (post red-team)
**Owner**: Wolfcito 🐾

## Revision history

- **r1** — Initial draft.
- **r2 (this)** — Addresses red-team P0/P1 findings: scope honesty around
  CSS namespace + telemetry tag (F1), navigation graph completeness (F2),
  explicit redirect construction (F3), tile-not-CTA decision (F4),
  pre-flight test verification (F5), telemetry source strings (F6).

## Problem

Pre-prod, we have code labeled "legacy" that isn't legacy at all — it's the
piece-exercises gameplay. The 2026-05-09 handoff framed `<PlayHubRoot>`
as deprecated tech debt to delete. Audit reveals:

- `<PlayHubRoot>` is the **canonical and only** surface for piece exercises
  (rook tutorial, capture exercises, labyrinth, badge claim flow,
  first-visit briefing, welcome overlay, result celebrations).
- The `?legacy=1` flag and `legacyHubFor()` naming pattern suggest
  deprecation, but the feature is alive and core to the product
  ("juego pre-ajedrecístico educativo" per `CLAUDE.md`).
- Scaffold (`/hub` default) is a kingdom launcher. Its PLAY CTA goes to
  `/arena` (full chess). Scaffold provides **zero** access to piece
  exercises.

Result: deleting `<PlayHubRoot>` would silently kill the exercises
feature. The right fix is to **reposition**, not delete.

## Goal

Make the piece-exercises gameplay a first-class, canonical surface with
honest naming. Eliminate the "legacy" framing entirely.

## Non-goals (explicit out-of-scope)

These are real surface area and would be in scope for a "kill all PlayHub
naming everywhere" rewrite, but are deferred to keep this PR focused on
**behavioral** code — the user-facing route, component names, and
navigation graph. Cosmetic / namespace renames have no product impact and
can be follow-ups.

- Visual redesign of the exercises screen.
- Replacing `MissionBriefing`, `WelcomeOverlay`, `ResultOverlay`. These
  travel with the exercises feature into its new home.
- Visual regression rebaselining (tracked separately in 2026-05-09 handoff).
- Reorganizing shared sheets (`badge-sheet`, `shop-sheet`, etc.) into a
  cross-surface `components/sheets/` directory.
- **CSS namespace `.playhub-*`** (32 selectors in `globals.css`, plus
  consumers in `board.tsx`, `arena-board.tsx`, exercises files). These
  are kebab-case CSS classes used by both `/exercises` and `/arena` (the
  board geometry is shared). Renaming risks breaking visual baselines on
  both surfaces. Tracked as cosmetic follow-up.
- **`SURFACE = "play-hub"` telemetry tag** in
  `apps/web/src/components/hub/hub-scaffold.tsx:65` and the
  `primitive-boundary.tsx` `surface` prop literal `"play-hub"`. These
  are telemetry/error-context strings, not product nav. Renaming them
  breaks dashboard continuity. Defer; if renamed, do it with
  intentional dashboard migration.
- `KingdomAnchor variant="playhub"` and `PrimaryPlayCta surface="playhub"`
  enum values. Same rationale.
- Asset filenames (`bg-playhub-forest-mobile.png`,
  `panel-frame-rune.png`, etc.) keep `playhub-` prefix. Cosmetic; defer.

## Decisions

### D1 — New canonical route: `/exercises`

Mount the exercises gameplay at `/exercises`. The route is bookmarkable,
shareable, and discoverable.

Alternatives considered:
- `/practice` — synonym, but "exercises" matches the educational framing
  of the product better and is already the term used in `EXERCISES`,
  `useExerciseProgress`, capture-exercise editorial copy.
- Keep at `/hub?legacy=1` — rejected: this is the bug we're fixing.

### D2 — Component rename: `<PlayHubRoot>` → `<ExercisesScreen>`

- File: `apps/web/src/components/play-hub/play-hub-root.tsx` →
  `apps/web/src/components/exercises/exercises-screen.tsx`
- Type rename: `PlayHubRootProps` → `ExercisesScreenProps`,
  `PlayHubInitialAction` → `ExercisesInitialAction`
- Component export: `PlayHubRoot` → `ExercisesScreen`

Use `git mv` to preserve history. Run codemod for imports.

### D3 — Directory move: `play-hub/` → `exercises/`

Move all 19 files in `apps/web/src/components/play-hub/` to
`apps/web/src/components/exercises/`. Sub-decisions:

- `badge-sheet.tsx`, `shop-sheet.tsx`, `purchase-confirm-sheet.tsx` —
  moved with the rest. They're consumed by scaffold too, but living
  inside `exercises/` is awkward. **Decision**: move them anyway in this
  PR; schedule a follow-up to extract into `components/sheets/` if the
  ownership ambiguity becomes painful.
- `persistent-dock.tsx` — same. Used by `/arena` and (currently)
  `<PlayHubRoot>`. Lives in `exercises/` after move. Follow-up:
  extract to `components/navigation/`.

Tests under `play-hub/__tests__/` move alongside.

### D4 — Drop the `?legacy=1` gate from `/hub/page.tsx`

`/hub/page.tsx` becomes a thin server component:

```tsx
export default function HubPage() {
  return <HubScaffoldClient />;
}
```

Drop:
- `legacy`, `hub`, `piece`, `action` searchParams handling
- `pieceHasExercises`, `VALID_ACTIONS`, `firstParam` helpers
- Import of `<PlayHubRoot>`
- `apps/web/src/app/hub/__tests__/page.test.tsx` "legacy fallback"
  describe block (kept tests for the scaffold path)

### D5 — Redirect strategy for `?legacy=1` bookmarks

Direct-URL bookmarks like `/hub?legacy=1&piece=rook` must not 404.

**Decision**: server redirect in `/hub/page.tsx` using
`redirect()` from `next/navigation`. Next.js's `redirect()` takes a
literal string and does **not** auto-preserve query params — the
target URL must be constructed explicitly.

```ts
import { redirect } from "next/navigation";

if (isLegacy) {
  const params = new URLSearchParams();
  if (piece && pieceHasExercises(piece)) params.set("piece", piece);
  const qs = params.toString();
  redirect(`/exercises${qs ? `?${qs}` : ""}`);
}
```

For `?action=…` — these were sheet-open intents from the legacy hub.
The scaffold currently has **no** URL-param-driven sheet opener
(verified: `<HubScaffoldClient>` does not read searchParams). Two
options:

- (a) Wire scaffold to accept `?sheet=shop|pro|badges` and auto-open.
- (b) Drop sheet-open intent on legacy redirects. Sheets remain
  reachable via the scaffold UI (dock + chips). Bookmarks like
  `/hub?legacy=1&action=shop` redirect to `/hub` raw. Sheet-open
  intent is lost — accept as known regression.

**Decision**: **(b)**. Pre-prod, the bookmark audience is tiny
(internal testers, no real production users). Scope discipline wins.
Document as known regression in the migration handoff and in
`MEMORY.md`'s "Pending" section so it's traceable if a tester
complains.

Mapping:
- `?legacy=1` (with or without `piece`) → `/exercises` (with `piece`)
- `?action=shop|pro|badges` (with `?legacy=1`) → `/hub` (sheet-intent dropped)
- `?action=trophies` (with `?legacy=1`) → `/trophies`
- `?legacy=1&action=…` without a known action → `/hub`

After 6 months, the legacy redirect itself can drop (track in calendar).

### D6 — Add "Practice Pieces" entry to scaffold (RewardColumn tile)

Without a scaffold link, `/exercises` is reachable only via direct URL
or the legacy redirect. Need an in-product entry point.

Options considered:

- **A**: New `RewardColumn` tile for "Practice Pieces" → `/exercises`.
- **B**: Secondary CTA below `<PrimaryPlayCta>`. Rejected after
  red-team: scaffold footer is at density limit (390px viewport, 3-zone
  layout, dominant-CTA design rule); adding a secondary tap target
  competes with `<MissionRibbon>` and breaks the single-primary-CTA
  guardrail.
- **C**: Repurpose PRIMARY_PLAY_CTA as a chooser. Rejected: too
  invasive for v1; double-tap to play full chess is the current happy
  path.

**Decision**: **A**. `<RewardColumn>` already accepts a `tiles` array;
adding one tile costs zero layout and inherits the existing slot
ergonomics.

- Add a "Practice Pieces" tile to the `rewardTiles` array in
  `<HubScaffoldClient>`. Tile `onClick` → `router.push("/exercises")`.
- Editorial: `HUB_COPY.practiceTile` = `{ title: "Practice Pieces",
  subtitle: "Master each piece" }` (verify final wording with audit of
  existing tile copy).
- Unit test in `hub-scaffold-client.test.tsx`: tile renders + click
  navigates.

### D7 — Migrate E2E specs to `/exercises`

**Pre-flight (before any retarget)**: Run each spec against current `main`
to record its pass/fail state. Red-team flagged that `tutorial-banner.spec.ts`
hits `/`, which redirects to `/hub` (scaffold) — and scaffold has no
`MissionBriefing`. The spec may already be silently broken.

```bash
cd apps/web && pnpm test:e2e tutorial-banner exercise-flow lf-sweep-captures
```

If red on main, file findings in the spec retarget commit message and
fix during retarget. Don't chase pre-existing failures unrelated to the
move.

| Spec | Current | Action |
|---|---|---|
| `tutorial-banner.spec.ts` | `/` | Repoint to `/exercises`. Verify briefing renders post-move. |
| `exercise-flow.spec.ts` | `/` | Repoint to `/exercises`. |
| `lf-sweep-captures.spec.ts` | `/` | Repoint splash/briefing/picker captures to `/exercises`. |
| `contextual-header.spec.ts` | `/hub` | Keep at `/hub` — tests scaffold behavior. |
| `visual-regression.spec.ts` | `/hub?legacy=1` | Repoint to `/exercises`. Rebaselining is its own task; if blocked, mark `.skip` with TODO referencing this spec. |

### D8 — Navigation graph + telemetry updates

Beyond the rename, several call-sites push to `/hub` with semantics that
should now point to `/exercises`. Red-team caught these as F2.

**Navigation retargets** (push targets that mean "go practice pieces"):
- `apps/web/src/app/arena/page.tsx:959` — `onLearn: () => router.push("/hub")` → `/exercises`
- `apps/web/src/app/arena/page.tsx:1023` — same `onLearn` handler → `/exercises`

**Navigation kept as `/hub`** (these mean "go home to kingdom"):
- `apps/web/src/app/arena/page.tsx:506` — `handleBackToHub` (kingdom = home)
- `landing-page.tsx` CTAs (lines 57, 94, 818) — kingdom-first onboarding
- `app/page.tsx:37` — wallet UA redirect (lands in kingdom)

**Rewrite**: `apps/web/next.config.js:12` — `/play-hub → /` becomes
`/play-hub → /exercises`. The `/play-hub` legacy path (which has no
in-app code path generating it) gracefully resolves to the renamed surface.

**Telemetry source-string updates**:
- `apps/web/src/components/pro/__tests__/pro-active-cta.test.tsx:22` —
  `NAV_SOURCES` array hardcodes `/play-hub`. Update to `/exercises`.
- `apps/web/src/components/pro/__tests__/pro-active-cta.test.tsx:32,40,49`
  — three `source="/play-hub"` test cases. Update.
- `apps/web/src/components/pro/__tests__/pro-sheet.test.tsx:7` —
  `pathnameMock` returns `/play-hub`. Update.
- `apps/web/src/components/pro/pro-active-cta.tsx` — verify any logic
  that gates on the literal `/play-hub` and update.

If any telemetry dashboard externally filters by `source=/play-hub`, the
rename creates a continuity gap. Pre-prod, this is acceptable. Document
in handoff so future analytics work knows.

**Editorial / docs / memory updates**:
- `lib/content/editorial.ts:1013` — comment mentions `/play-hub`. Update.
- `apps/web/src/lib/contracts/shop-catalog.ts:82` — path comment. Update.
- `apps/web/src/app/hub/layout.tsx` — comment "canonical play-hub URL".
  Verify, update if present.
- `DESIGN_SYSTEM.md` — replace `play-hub-root.tsx` references with
  `exercises-screen.tsx`. ~5 mentions per audit.
- `docs/handoffs/2026-05-09-session-handoff.md` — DO NOT edit (historical).
- `MEMORY.md` — add note that "PlayHub" is renamed Exercises; remove the
  "Pending: Delete PlayHubRoot" item; add the dropped-sheet-intent
  regression to a new "Known regressions" sub-list.

### D9 — Naming follow-ups (out of scope, tracked)

These are deferred to a cosmetic-only follow-up PR with intentional
dashboard / visual-baseline migration:

- `.playhub-*` CSS namespace (32 selectors + consumers).
- `KingdomAnchor variant="playhub"` enum — rename to `variant="hub"`.
- `PrimaryPlayCta surface="playhub"` — same.
- `<HubScaffold>` `SURFACE = "play-hub"` telemetry tag.
- `primitive-boundary.tsx` `surface="play-hub"` literal.
- Asset filenames (`bg-playhub-forest-mobile.png`, etc.).
- Storage keys (`chesscito:onboarded`, `chesscito:welcome-dismissed`) —
  unchanged (rename would require migration logic; locks out testers).

## Implementation Plan (staged commits)

0. **Pre-flight (no commit)**: run E2E specs against current `main` to
   record baseline pass/fail. Note any pre-existing failures so spec
   retargets don't get blamed for them.

1. **`refactor(exercises)`: rename `play-hub` → `exercises` directory + component**
   - `git mv apps/web/src/components/play-hub apps/web/src/components/exercises`
   - Rename `play-hub-root.tsx` → `exercises-screen.tsx`
   - Rename component `PlayHubRoot` → `ExercisesScreen`,
     `PlayHubRootProps` → `ExercisesScreenProps`,
     `PlayHubInitialAction` → `ExercisesInitialAction`
   - Update all import paths (`@/components/play-hub/*` → `@/components/exercises/*`)
   - Update test imports under `__tests__/`
   - Verify `tsc --noEmit` clean, `pnpm test` green

2. **`feat(exercises)`: add canonical `/exercises` route**
   - Create `apps/web/src/app/exercises/page.tsx` rendering `<ExercisesScreen>`
   - Read `?piece=` searchParam (preserve `pieceHasExercises` validation)
   - **Drop `?action=` support** (sheets open via scaffold; not needed at /exercises)
   - Add `apps/web/src/app/exercises/__tests__/page.test.tsx` covering
     piece validation + array-shaped param flattening

3. **`refactor(hub)`: drop `?legacy=1` + add bookmark redirects**
   - Simplify `/hub/page.tsx` to `return <HubScaffoldClient />` plus
     legacy redirect logic (per D5 code block)
   - Map `?legacy=1` (with `piece`) → `/exercises?piece=…`
   - Map `?legacy=1&action=trophies` → `/trophies`
   - Map `?legacy=1&action=shop|pro|badges` → `/hub` (intent dropped — known regression)
   - Update `apps/web/src/app/hub/__tests__/page.test.tsx` (drop legacy
     describe block; add redirect-coverage describe block)

4. **`refactor(nav)`: retarget arena `onLearn` + `next.config.js`**
   - `apps/web/src/app/arena/page.tsx:959,1023` — `onLearn` → `/exercises`
   - `apps/web/next.config.js` — rewrite `/play-hub → /exercises`
   - Add/update tests covering arena `onLearn` navigation target

5. **`feat(hub)`: add "Practice Pieces" RewardColumn tile**
   - Add tile to `rewardTiles` array in `<HubScaffoldClient>`
   - Add `HUB_COPY.practiceTile` editorial key
   - Wire `onClick → router.push("/exercises")`
   - Test: tile renders + click navigates

6. **`refactor(telemetry)`: rename `/play-hub` source strings**
   - `pro-active-cta.test.tsx`, `pro-sheet.test.tsx` — `/play-hub` → `/exercises`
   - `pro-active-cta.tsx` source-handling logic if it gates on the literal
   - Verify telemetry events still fire with new source string

7. **`test(e2e)`: migrate exercise-targeting specs to `/exercises`**
   - `tutorial-banner.spec.ts`, `exercise-flow.spec.ts`,
     `lf-sweep-captures.spec.ts`, `visual-regression.spec.ts`
   - Mark visual-regression `.skip` with TODO if rebaselining required

8. **`docs(memory)`: update DESIGN_SYSTEM.md + MEMORY.md + comments**
   - Replace `play-hub-root.tsx` references with `exercises-screen.tsx`
   - Update comments in `editorial.ts:1013`, `shop-catalog.ts:82`,
     `app/hub/layout.tsx`
   - Drop "Delete PlayHubRoot" pending item from MEMORY.md
   - Add "Sheet-open intent on `?legacy=1&action=…` bookmarks" to
     known-regressions sub-list

9. **`docs(handoff)`: write 2026-05-09-exercises-extraction-handoff.md**

## Rollback Strategy

Each commit is atomic and revertible. If a regression surfaces:

- Bad import after rename → revert commit 1, fix, redo. Files preserved
  via `git mv` history.
- `/hub?legacy=1` redirect breaks an external bookmark → revert commit 3
  alone. Commit 1 + 2 already provide `/exercises` as a working path.
- Scaffold CTA visual issue → revert commit 4. `/exercises` remains
  reachable via direct URL or dock, plus legacy redirect.

## Risks & Mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| Hidden import using a string path instead of alias breaks after move | Low | Audit completed; 0 dynamic imports found. Run full `tsc` after commit 1. |
| MEMORY/CLAUDE references to `play-hub-root.tsx` rot | Med | Spec lists all known mentions. Grep + update in commit 6. |
| Visual regression baselines drift | Med | Pre-existing red per handoff. Mark `.skip` if blocked; rebaseline is its own task. |
| External MiniPay/Discord/share links target `/hub?legacy=1` | Unknown | Server `308` redirect preserves bookmarks. User to confirm no hardcoded share previews use `?legacy=1` (audit grep showed none in repo). |
| `KingdomAnchor variant="playhub"` cosmetic naming inconsistency confuses future devs | Low | Tracked in D9. Easy follow-up rename. |

## Success Criteria

Behavioral / product:
- `/exercises` is the canonical URL for piece exercises and renders
  `<ExercisesScreen>`.
- `?legacy=1` does not appear in any in-app **code path** under
  `apps/web/src/`. (May still appear in test fixture URLs that exercise
  the redirect.)
- `components/play-hub/` directory does not exist.
- `<PlayHubRoot>` symbol does not exist in active code.
- Scaffold (`/hub`) has a visible "Practice Pieces" tile linking to
  `/exercises`.
- Arena's "Learn pieces" callbacks navigate to `/exercises`.
- `next.config.js` rewrite `/play-hub` resolves to `/exercises`.
- `pnpm test` green; `tsc --noEmit` clean.
- E2E specs that exercise piece-exercise gameplay target `/exercises` directly.

Naming honesty:
- "PlayHubRoot", "play-hub-root.tsx", `useShopSheetState` style legacy
  prose appears only in historical docs (handoffs, release notes) — not
  in active reference docs (`DESIGN_SYSTEM.md`, `MEMORY.md`, `CLAUDE.md`)
  or active code comments.
- The strings `.playhub-*` (CSS), `surface="play-hub"` (telemetry),
  `variant="playhub"` (kingdom anchor) are documented as deferred
  cosmetic renames in MEMORY.md follow-ups. Their continued presence is
  not a failure of this spec.

## Open Questions (post r2)

1. **Sheet-open intent regression on legacy bookmarks** — accepted as
   known regression in D5.b. If a tester relies on
   `/hub?legacy=1&action=shop`-style bookmarks, surface in handoff and
   reconsider scaffold URL-param wiring.
2. **Bookmark-redirect retention** — keep `?legacy=1` redirect
   indefinitely (low cost) or drop after 6 months? Recommend: indefinite.
3. **Telemetry source-string continuity** — pre-prod, dashboards
   filtering by `source=/play-hub` are internal only. Acceptable to break
   continuity. If product analytics depends on the old string, surface
   before commit 6.

## References

- 2026-05-09 handoff: `docs/handoffs/2026-05-09-session-handoff.md`
- Red-team finding (this session): `<PlayHubRoot>` is gameplay, not legacy
- Scaffold owner: `apps/web/src/components/hub/hub-scaffold-client.tsx`
- Exercises owner: `apps/web/src/components/play-hub/play-hub-root.tsx`
  (1612 LOC)
