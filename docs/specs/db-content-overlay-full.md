# Spec — db-content-overlay-full

**Date**: 2026-06-17
**Status**: ready for /tdd (red-team P0s folded in)
**Builds on**: `docs/specs/db-backed-content.md` (Phases 1–2c shipped). This is the
follow-up that completes overlay coverage (labyrinths + descriptions) and wires
the builder to publish live in one action.

## Problem
Phase 2c made **exercises** live-editable via the Supabase overlay, but two gaps
remain and one workflow is manual:
1. **Labyrinths don't flow.** `exercises-screen.tsx` reads `LABYRINTHS` directly
   from the compiled baseline (`src/lib/game/exercises.ts:128`, used at
   `:2243` and `:2878`). An overlay `kind:"labyrinth"` row is stored and merged
   into `merged.labyrinths` by `getMergedCatalog()`, but the UI never reads it,
   so labyrinth edits require a redeploy.
2. **Exercise descriptions don't flow.** `resolveExerciseDescription()`
   (`exercises.ts:98`) reads `GENERATED_EXERCISE_DESCRIPTIONS` directly; the
   overlay's per-row `explanation` (already merged into `merged.descriptions`)
   never reaches the one caller (`exercise-drawer.tsx:306`).
3. **Publishing is manual.** The builder (`/dev/labyrinth-builder`) saves only to
   `content/*.json` via `/api/dev/labyrinth` (needs redeploy). Going live means
   hand-running a `curl` against `/api/admin/content` with the `ADMIN_TOKEN`.

## Goal
A founder edits an exercise **or** a labyrinth (mechanics + description) in the
local builder, clicks one **Save** button, and the change is both versioned in
git (`content/*.json`) and live in prod within seconds (overlay) — with the
`ADMIN_TOKEN` never leaving the server.

## Non-goals
- Hosting the builder (stays `/dev`, local-only, 404 in prod — unchanged).
- New authoring fields (description already authored via the `explanation` field).
- Realtime push, progress-in-DB, role system (unchanged from base spec).
- Changing the overlay merge/loader logic (`merged-catalog.ts` already merges
  labyrinths + descriptions correctly — this is read-path + builder only).
- Touching the `CONTENT_OVERLAY_ENABLED` flag semantics (reuse as-is).

## Contracts (SDD)

### Read-path: widen the client catalog context
Today `ExerciseCatalogContext` carries exercise pools only
(`catalog-context.tsx`, value type `ExerciseCatalog` = `Record<PieceId,
Exercise[]>`). Widen it to the full read catalog while keeping the existing
`useExerciseCatalog()` return shape (back-compat → the 3 current consumers are
untouched):

```ts
// catalog-context.tsx
export interface ContentCatalog {
  exercises: Record<PieceId, Exercise[]>;
  labyrinths: Record<PieceId, Exercise[]>;
  descriptions: Record<string, string>;
}

const DEFAULT: ContentCatalog = {
  exercises: EXERCISES,
  labyrinths: LABYRINTHS,
  descriptions: GENERATED_EXERCISE_DESCRIPTIONS,
};
const ContentCatalogContext = createContext<ContentCatalog>(DEFAULT);

export function ContentCatalogProvider({ value, children }: {
  value: ContentCatalog; children: ReactNode;
}): JSX.Element;

// Back-compat selector — unchanged return type, existing consumers untouched.
export function useExerciseCatalog(): Record<PieceId, Exercise[]>; // → ctx.exercises
// New selectors.
export function useLabyrinthCatalog(): Record<PieceId, Exercise[]>; // → ctx.labyrinths
export function useExerciseDescriptions(): Record<string, string>;  // → ctx.descriptions
```

### Read-path: inject descriptions into the resolver
`resolveExerciseDescription` gains an injected descriptions map (default =
baseline import → byte-identical when unprovided):

```ts
// exercises.ts
export function resolveExerciseDescription(
  id: string,
  index: number,
  i18n: (id: string) => string | null,
  fallback: (n: number) => string,
  descriptions: Record<string, string> = GENERATED_EXERCISE_DESCRIPTIONS, // NEW
): string;
```

### Builder publish: server-local proxy (token never in browser)
New dev-only route. Reuses the existing dev write (json + regenerate) then
forwards to the live overlay using the server-held token.

```ts
// app/api/dev/publish/route.ts  (NODE_ENV==="production" → 404)
export interface PublishRequest {
  kind: ContentKind;            // "exercise" | "labyrinth"
  record: LabyrinthRecord;      // same record the builder already sends to /api/dev/labyrinth
}

export interface PublishResult {
  ok: boolean;                  // true iff overlay publish succeeded (the "live" goal)
  baseline: { ok: boolean; id?: string; errors?: string[] }; // content/*.json write
  overlay:  { ok: boolean; revalidated?: boolean; errors?: string[] }; // POST /api/admin/content
}
```

- Reads `ADMIN_TOKEN` and `OVERLAY_PUBLISH_BASE_URL` from **server** env (local
  `.env`). Neither is `NEXT_PUBLIC_`; neither is sent to the browser.
- Step 1: write baseline via a **shared extracted helper** (see below) → obtain
  the resolved `id` (the helper auto-assigns a content-addressed id when absent).
- Step 2: POST to `${OVERLAY_PUBLISH_BASE_URL}/api/admin/content` with
  `x-admin-token: ADMIN_TOKEN` and `{ kind, record: { ...record, id } }`.
  `OVERLAY_PUBLISH_BASE_URL` is normalized (strip trailing slash); unset → skip
  with a clear "overlay target not configured" message (no `undefined/api/...`).
- Returns both outcomes; a baseline success + overlay failure is **partial**, not
  fatal (the founder can retry publish or commit the json).
- **Error sanitization (red-team P0):** `overlay.errors` carries only safe,
  curated strings (status + a generic reason). The proxy NEVER echoes the
  `ADMIN_TOKEN`, the request headers, or the raw upstream response body (which may
  contain DB connection strings) to the client or to logs.

### Builder publish: shared baseline-write helper (red-team P0)
The dev write logic currently lives inside the route handler
(`/api/dev/labyrinth/route.ts:48-94`: fs read-modify-write of `content/*.json` +
re-read the other bucket + CSV + `buildCatalog` BFS validate + `renderGeneratedModule`).
Extract it so the existing dev route AND the new proxy call ONE function — no
divergence, no route-calls-route:

```ts
// lib/content/baseline-write.ts  (server-only, dev-only callers)
export function writeBaselineRecord(
  kind: ContentKind,
  record: LabyrinthRecord,
): { ok: true; id: string; warnings: string[] } | { ok: false; errors: string[] };
// Preserves the dual-bucket + CSV rebuild exactly (a labyrinth save still
// re-reads exercises + CSV before regenerating the module).
```
The existing `/api/dev/labyrinth` POST becomes a thin wrapper over this helper;
its tests must stay green (extraction is behavior-preserving).

## Behavior
1. Given the flag is ON and an overlay labyrinth row exists, when a player opens
   that piece, then the labyrinth list reads from `merged.labyrinths` (new/edited
   labyrinth appears, disabled one disappears) without a redeploy.
2. Given the flag is ON and an overlay row carries an `explanation`, when the
   exercise drawer renders that id, then the overlay description is shown
   (overrides the baseline/i18n text).
3. Given the flag is OFF (no provider), when any surface renders, then exercises,
   labyrinths, and descriptions all read the baseline default — byte-identical to
   pre-follow-up.
4. Given the founder clicks **Save** in the builder, when the puzzle is valid,
   then the server-local proxy writes `content/*.json` AND publishes to the live
   overlay in one action, and the UI reports both outcomes.
5. Given the overlay publish fails (network/token/DB) but the baseline write
   succeeded, then the builder shows a partial-success state ("Saved to baseline;
   live publish failed: …") and the local json is intact.
6. Given `ADMIN_TOKEN` or `OVERLAY_PUBLISH_BASE_URL` is unset locally, then the
   proxy still writes baseline and reports overlay as skipped/failed with a clear
   message (never silently drops the live publish).

## Edge cases
- **Description cleared on edit**: an overlay row with no `explanation` removes
  the baseline description for that id (mergeOverlay already does this); the
  resolver then falls back to i18n → generic, no console warning (existing guard).
- **Labyrinth disabled**: `merged.labyrinths` already removes disabled rows; the
  king-labyrinth id list at `exercises-screen.tsx:2878` must read the merged
  pool, not baseline, or the gate logic drifts.
- **id mismatch between baseline and overlay**: the proxy sends the SAME resolved
  id to both, so an edit replaces consistently in both systems.
- **Partial failure ordering**: baseline write first (local, reliable), overlay
  second (network). If baseline fails, do NOT attempt overlay (nothing to publish).
- **optimal_moves**: the admin route recomputes via BFS; the proxy never sends a
  stored value (avoids the read-path trust mismatch that drops rows).
- **Flag-ON hydration**: page.tsx already serializes the merged catalog into the
  provider; widening the value to include labyrinths+descriptions keeps the same
  SSR/client single-source contract (no new mismatch surface).
- **Builder in prod**: `/api/dev/publish` 404s in prod (NODE_ENV guard), same as
  `/api/dev/labyrinth` — publishing is a local-only founder action.

## Acceptance criteria
- [ ] `ContentCatalogProvider` carries `{exercises, labyrinths, descriptions}`;
      `useExerciseCatalog()` return type is unchanged; 3 existing consumers compile
      untouched.
- [ ] **ALL** labyrinth-derived state in the screen reads the merged pool, not
      just the two obvious reads (red-team P0): the render list (`:2243`), the
      king-gate id list (`:2878`), any pool count, and the "all labyrinths
      complete" derivation in `training/path.ts:140`. The displayed list and the
      gate/unlock logic must agree (no shown-but-locked drift). With the flag ON an
      overlay labyrinth appears live AND is correctly unlocked.
- [ ] `exercise-drawer.tsx:306` passes `useExerciseDescriptions()` into
      `resolveExerciseDescription`; an overlay `explanation` shows live.
- [ ] `resolveExerciseDescription` default arg = baseline → existing unit tests
      pass unchanged.
- [ ] page.tsx provider value = full merged read catalog; flag OFF → no provider →
      byte-identical (full suite green + `tsc` clean).
- [ ] `/api/dev/publish` 404s in prod; locally writes baseline + POSTs overlay
      with the server-held token; returns both outcomes.
- [ ] Builder **Save** calls the proxy; success, partial-failure, and
      token-unset states each render a distinct, clear toast.
- [ ] `ADMIN_TOKEN` never appears in any client bundle or network request from the
      browser (only server→server from the proxy); `overlay.errors` returned to the
      client are sanitized (no token, headers, or raw upstream body).
- [ ] Smoke: edit a labyrinth in the local builder → Save → it is live on the
      target (preview) without redeploy; revert restores baseline.

## Out of scope / future
- Wiring the builder to choose preview vs prod target at click-time (env-config
  only for now).
- A "publish history / audit view" in the builder.
- Retiring the baseline generated module (keep dual-write).

## Open questions
1. **Publish target** (needs founder confirm): `OVERLAY_PUBLISH_BASE_URL` defaults
   to **preview** (`https://preview.chesscito.com`) for safety. Publishing
   straight to prod would need it pointed at `https://www.chesscito.com`. Default
   preview, founder flips to prod when ready — confirm.
2. **Save semantics**: "todo en 1" = always dual-write (baseline + overlay) on
   every Save (chosen). No separate "draft/local-only" save mode — confirm we
   don't want a local-only escape hatch for WIP puzzles.
3. **Commit reminder**: the json is written but not committed. Acceptable to leave
   git commit manual (recommended), or should the builder surface a "remember to
   commit content/*.json" nudge after a successful baseline write?
