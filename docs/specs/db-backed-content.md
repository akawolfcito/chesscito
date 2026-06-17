# Spec — db-backed-content

**Date**: 2026-06-17
**Status**: draft (red-team P0/P1 folded in — ready for /tdd Phase 1)

## Problem
Builder-authored exercises and labyrinths only reach players after a full
rebuild + redeploy: the content lives in `content/*.json`, is compiled by
`pnpm import-puzzles` into a **synchronous** generated TS module
(`GENERATED_EXERCISES` / `GENERATED_LABYRINTHS`), and `EXERCISES[piece]` /
`LABYRINTHS[piece]` (`src/lib/game/exercises.ts`) read it synchronously across
the exercises screen, rotation engine, training path, and hub reward tiles.
The founder cannot fix a typo or ship a new puzzle without a deploy.

## Goal
Founder-authored content (new / edited / disabled puzzles) appears live in
production within seconds of saving in the builder, with **no redeploy**, while
keeping the player read path cheap (no per-request DB hit) and resilient (the
game still works if the DB is paused/unreachable — Supabase free tier pauses
inactive projects).

## Non-goals
- Player progress in DB (stars/currentId stay in localStorage — separate phase).
- Realtime push to open clients (no Supabase Realtime subscriptions).
- Multi-author roles / full auth. Write is founder-only (admin allowlist).
- Editing the FEN/geometry model or the BFS validator (reused as-is).
- Per-request DB reads (rejected for cost; on-demand revalidation instead).

## Architecture (locked decisions)
1. **Source of truth = compiled baseline ⊕ DB overlay.** The generated module
   stays the compiled baseline (always available, synchronous, BFS-verified at
   build). A Supabase table holds only **deltas**: new puzzles, edits to a
   baseline puzzle, and disables. Merged catalog = baseline overridden by
   overlay.
2. **Freshness = on-demand revalidation.** Players read a **cached** merged
   catalog. The admin write path calls `revalidateTag("content")` on save, so
   the DB is read ~once per author-save (cache rebuild), not per player request.
3. **Write auth = `ADMIN_TOKEN` server-only secret** (red-team P0). The write
   route requires a `x-admin-token` header matching `process.env.ADMIN_TOKEN`
   (server-only, never `NEXT_PUBLIC_`; absent env → route disabled, 503). Chosen
   over wallet-signature because the builder is a dev-tool-grade surface and a
   shared secret is the simplest prod-safe gate; wallet-sig is a future upgrade
   if the builder must run inside MiniPay. The route is rate-limited (token-bucket,
   reuse the existing limiter) and every write is audit-logged (id, kind, actor
   token hash, updated_at).
4. **Caching primitive = `unstable_cache` tagged `"content"`** (red-team P1).
   `getMergedCatalog()` wraps the overlay fetch + merge in `unstable_cache(fn,
   keyParts, { tags: ["content"] })`; the write route calls
   `revalidateTag("content")`. The `/exercises` server boundary must NOT be
   forced-static (it reads the cache), and NO player fetch is left untagged — a
   cache-bust test (write → next read reflects it) is an acceptance criterion so
   the "live" claim is verified, not assumed.
5. **Overlay trust = re-verify BFS in the loader, once per revalidation**
   (red-team P1 optimal-moves-trust). The few overlay rows are BFS-validated
   inside the cached `getMergedCatalog()` (paid once per cache rebuild, not per
   request); a row whose stored `optimal_moves` disagrees with the recomputed
   value, or that is unsolvable, is **dropped** from the merge and logged. The DB
   value is never blindly trusted at read time.
6. **Fallback** = baseline-only whenever the overlay is unavailable
   (`getSupabaseServer()` null, fetch error/timeout, or a malformed row). Overlay
   queries use a short timeout (≤2s) so a paused free-tier project degrades to
   baseline fast instead of blocking the request.

### Validator relocation (prerequisite — red-team P1)
The BFS validator + catalog builder currently live in `scripts/import-puzzles.ts`,
which an `app/` prod route cannot safely import (dev-only build graph). **Phase 0:**
extract the shared, prod-safe pieces (`buildCatalog`, `mapFenPuzzle`,
`computeExerciseBfs`, `puzzleId`, types) into `src/lib/content/` and have both the
dev route and `scripts/import-puzzles.ts` import from there. No behavior change;
purely a move + re-export. Guarded by the full suite staying green.

## Contracts (SDD)

```ts
// One overlay row = one puzzle delta. Mirrors the builder/import record
// shape (LabyrinthRecord) plus routing + audit fields.
export type ContentKind = "exercise" | "labyrinth";

export interface ContentOverlayRow {
  id: string;                 // puzzle id (PK with kind)
  kind: ContentKind;
  piece: PieceId;
  fen: string;
  target: string;
  mover: string | null;
  tier: ExerciseTier;         // "easy" | "medium" | "hard"
  tags: string[] | null;
  explanation: string | null;
  order: number;
  disabled: boolean;          // soft-delete (already a builder concept)
  optimal_moves: number;      // BFS-verified at write time; stored for read-path trust
  updated_at: string;         // ISO; audit + cache-key hint
}

// The merged, ready-to-serve catalog (same shape the generated module exports).
export interface MergedCatalog {
  exercises: Record<PieceId, Exercise[]>;
  labyrinths: Record<PieceId, Exercise[]>;
  descriptions: Record<string, string>;
  source: "baseline+overlay" | "baseline-only"; // observability
  overlayCount: number;
}

// Admin write request (builder → server). Reuses the dev-route record plus kind.
export interface ContentWriteRequest {
  kind: ContentKind;
  record: Omit<ContentOverlayRow, "optimal_moves" | "updated_at">; // server computes optimal_moves
}

export type ContentWriteResult =
  | { ok: true; saved: ContentOverlayRow; revalidated: boolean }
  | { ok: false; errors: string[] };   // validation / auth / db failures
```

### DB schema (migration)
```sql
create table if not exists content_overlay (
  id           text not null,
  kind         text not null check (kind in ('exercise','labyrinth')),
  piece        text not null,
  fen          text not null,
  target       text not null,
  mover        text,
  tier         text not null check (tier in ('easy','medium','hard')),
  tags         text[],
  explanation  text,
  "order"      int  not null default 0,
  disabled     boolean not null default false,
  optimal_moves int not null,
  updated_at   timestamptz not null default now(),
  primary key (kind, id)
);
-- Service-role only: no anon/auth RLS grants (server reads via service key).
alter table content_overlay enable row level security;
```

## Behavior
1. Given the founder saves a puzzle in the builder, when the admin write route
   accepts it, then the server BFS-validates it (same validator as the dev
   route), upserts a `content_overlay` row keyed by `(kind, id)`, and calls
   `revalidateTag("content")`.
2. Given a valid overlay exists, when a player loads the merged catalog, then
   the read path returns baseline merged with the overlay: a new id is appended
   (sorted by `(order, id)`), an id matching a baseline puzzle is **replaced**,
   and a row with `disabled:true` is **removed** from the merged pool.
3. Given the overlay is unavailable (no env / fetch error), when a player loads,
   then the read path returns `baseline-only` and the game is fully playable.
4. Given the merged catalog is cached, when no save has occurred, then player
   requests are served from cache with **zero DB hits**.
5. Given a non-admin calls the write route, when auth fails, then it returns
   403 and never writes.
6. Given an overlay row fails BFS validation at write time, then the route
   returns 400 with the error and never persists (the read path can trust
   `optimal_moves` without re-running BFS per request).

## Read-path integration (the hard part — phased)

### The injection seam, per consumer (red-team P0 read-path-sync)
The catalog is consumed **synchronously** at module load. The plan injects a
catalog instead of importing the global, with the **default argument = the
baseline import** so every existing call site and unit test is unchanged
(flag-off is byte-identical). Exact seam:

| Consumer | Today | Phase-2 seam |
|---|---|---|
| `lib/game/exercises.ts` | exports `EXERCISES`/`LABYRINTHS` consts | add `getCatalog(): {exercises,labyrinths,descriptions}` returning the baseline; keep the consts as the default export so nothing breaks |
| `lib/game/rotation.ts` | imports `EXERCISES` | functions gain `catalog = baselineExercises` param (default) |
| `lib/training/path.ts` | imports `EXERCISES` | already takes `progress`; add `pool = EXERCISES[piece]` param (default) |
| `lib/game/progress-adapter.ts` | imports `EXERCISES` | gains `pool` param (default baseline) |
| `lib/hub/derive-reward-tiles.ts` | imports `EXERCISES` | gains `catalog` param (default) |
| `hooks/use-exercise-progress.ts` | imports `EXERCISES` | reads injected pools from `CatalogContext` (falls back to baseline import when the provider is absent) |
| `hooks/use-rotation-steering.ts` | imports `EXERCISES` | same context read |
| `components/exercises/exercises-screen.tsx` | imports `GENERATED_*` | receives `pools` as a prop from the server boundary; wraps children in `CatalogProvider value={pools}` |

This is the same fan-out as the id-keying cluster's Task 2 (~9 files), driven by
`tsc` once the params are added. **Proof obligation:** with the flag OFF (no
provider, default args), the full suite must stay green and `tsc` clean — a hard
acceptance criterion, run before the read path is enabled.

### Hydration contract (red-team P0 hydration-mismatch)
`exercises-screen` is `"use client"`. To avoid SSR/client mismatch AND a
mis-keyed progress migration:
- The **server boundary** (`/exercises` route/segment) is the single source: it
  calls `getMergedCatalog()` and passes the merged `pools` as a prop.
- The client component renders **only** from the prop pools via `CatalogProvider`.
  It must NOT re-derive from its own baseline `GENERATED_*` import (that import is
  the fallback default only, used when no provider exists, e.g. isolated tests).
- `loadProgress` already keys progress by id off the catalog it is given — with
  the provider supplying one stable catalog for the whole render tree, server and
  client agree, so the id-keyed migration maps against one consistent order.

### Phases
- **Phase 0 — validator relocation.** Move shared validator/builder into
  `src/lib/content/` (see Architecture). No behavior change.
- **Phase 1 — write side only.** Migration + `ADMIN_TOKEN`-gated write route +
  `content_overlay` table + `revalidateTag`. Read path still serves the baseline.
  Builder gains a prod-safe "publish to live" save target (UI still non-prod).
- **Phase 2 — merged loader, injected.** `getMergedCatalog()` (cached, tagged) +
  the per-consumer seam above + the hydration contract. Behind
  `CONTENT_OVERLAY_ENABLED` (default off). Flag-off proves byte-identical.
- **Phase 3 — enable + observe.** Flip the flag in prod; log `source` +
  `overlayCount` + overlay fetch latency; baseline fallback stays the kill-switch
  path (`CONTENT_OVERLAY_ENABLED=false` fully bypasses the loader, no DB call).

## Edge cases
- **Descriptions merge** (red-team P2): an edited row's `explanation` overrides
  baseline `GENERATED_EXERCISE_DESCRIPTIONS[id]`; a disabled row drops its
  description. Mirrors the catalog merge exactly.
- **Edit keeps the overlay's `order`** (not the baseline's) — an overlay row is
  authoritative for its full field set; `(order, id)` tiebreak keeps it
  deterministic.
- **`tags` normalization** (red-team P2): store `null` (not `[]`) when empty, to
  match the sparse style the builder already sends (`undefined` when empty).
- Overlay row references a piece/id not in the baseline → treated as a NEW
  puzzle (append), not an error.
- Overlay `order` collides with a baseline order → `(order, id)` tiebreak keeps
  it deterministic (same rule as `buildCatalog`).
- DB returns a malformed row (hand-edited) → row is skipped, logged; the rest of
  the overlay still applies; never throws to the player.
- Disable of a baseline puzzle the player has progress on → id-keyed progress is
  untouched in localStorage; the puzzle just disappears from the pool (already
  the soft-delete behavior).
- Revalidation fails after a successful write → row is persisted; the next
  player request rebuilds the cache (eventual consistency); write result flags
  `revalidated:false` so the builder can surface a "saved, propagating" note.
- Supabase project paused (free tier) → `getSupabaseServer()` succeeds but the
  query errors/times out → baseline-only, logged.
- Concurrent saves of the same id → last-write-wins on the `(kind,id)` PK
  (acceptable; single founder author).

## Acceptance criteria
- [ ] **Phase 0:** shared validator/builder lives in `src/lib/content/`; both the dev route and `scripts/import-puzzles.ts` import it; full suite green (no behavior change). A test asserts an `app/` route can import it (no `scripts/` dependency).
- [ ] Migration `content_overlay` applies cleanly (local `supabase start` + commit; hosted apply is CI/deploy).
- [ ] Write route returns 503 when `ADMIN_TOKEN` is unset, 403 on a bad/absent `x-admin-token`, 400 on malformed/unsolvable records — never persisting in any of these.
- [ ] A valid authed write upserts the `(kind,id)` row and calls `revalidateTag("content")`; result reports `revalidated`.
- [ ] Write route is rate-limited and audit-logs each write.
- [ ] `getMergedCatalog()` merges: append-new, replace-edit (overlay `order` wins), remove-disabled, descriptions merged, sorted `(order,id)`; **re-runs BFS on overlay rows and drops any unsolvable / optimal_moves-mismatch row**; returns `baseline-only` on null client / fetch error / ≤2s timeout / malformed row.
- [ ] **Cache-bust test** (red-team P1): after a write + `revalidateTag`, the next `getMergedCatalog()` reflects the change; a warm cache performs **zero DB hits** (asserted via mock).
- [ ] With `CONTENT_OVERLAY_ENABLED` OFF, the read path is byte-identical to today (no provider, default args) — full suite green + `tsc` clean.
- [ ] With the flag ON and an empty overlay, the merged catalog equals the baseline.
- [ ] Game is fully playable with `SUPABASE_URL` unset (fallback path).
- [ ] Pool-size change from a live addition flows through `getExerciseCount`; a player who completed the senda is not jarringly "re-opened" (behavior confirmed/decided).

## Out of scope / future
- Progress in DB (cross-device) — separate spec.
- Realtime subscriptions.
- A non-founder authoring console / role system.
- Moving the baseline itself into the DB (retiring the generated module).

## Resolved (was open)
- **Admin identity** → `ADMIN_TOKEN` server-only env (decided; wallet-sig is a
  future upgrade). See Architecture decision 3.
- **Phase 1 write path** → the write route is prod-safe (`ADMIN_TOKEN`-gated)
  from Phase 1; the builder UI stays non-prod until Phase 2 reads exist.

## Open questions
- Senda re-open UX (P1 order-collision-pools): when a live addition grows a pool
  the player already completed, do we (a) leave it completed and surface the new
  exercise as an optional extra, or (b) re-open the senda? Default (a) unless the
  founder wants (b). Decide before Phase 2 enable.
- `updated_at` role: audit-only for now; promote to a conditional-fetch cache key
  only if egress becomes a concern (free tier: not yet).
