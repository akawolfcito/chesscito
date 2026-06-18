# Spec — content-staging-model

**Date**: 2026-06-17
**Status**: draft (red-team P0s folded — see `-redteam.md`; ready for /tdd once the
3 founder open questions are answered)

## Problem
Today the db-backed-content overlay is gated by a per-deployment on/off flag
(`CONTENT_OVERLAY_ENABLED`). To target a specific environment you point the
builder's `OVERLAY_PUBLISH_BASE_URL` at that deployment and carry an `ADMIN_TOKEN`
per environment, and the same Supabase is shared across localhost/preview/prod —
so the only thing differentiating environments is the read-flag + the
per-deployment Next.js cache. There is no notion of content *maturity*: a row is
either applied everywhere the flag is on, or nowhere, and there is no way to edit
a live puzzle without immediately affecting (or pulling) the version players see.

A content lifecycle (`draft → preview → published`) attached to **versioned
rows** solves this: one write surface, one `ADMIN_TOKEN`, promotion is a status
change, and a puzzle can have a **live `published` version AND an in-progress
`draft` of the same id at the same time** — editing never disturbs prod until you
promote.

## Goal
Replace the on/off overlay flag with **per-id, per-stage versioned overlay rows**
and a per-environment read-filter, so content promotes `draft → preview →
published` from a single authenticated write surface, and editing a live puzzle
produces a separate draft that does not affect prod until promoted.

## Non-goals
- Version *history* / rollback to a previous published version (promotion
  overwrites the published row; the prior content is not retained).
- Scheduled / timed publishing.
- Per-user roles or an audit log of who-promoted-what (only `updated_at`).
- Hosting a dedicated `builder.chesscito.com` write surface (the model supports
  one write surface; *where* it runs is a later ops decision).
- Changing the baseline⊕overlay merge math, the re-BFS trust-but-verify, or the
  baseline-fallback behavior (all preserved; only row *selection* changes).
- A builder promote/demote UI (this spec is the data + API layer; buttons are a
  thin follow-up — see Out of scope).

## Contracts (SDD)

```ts
// lib/content/overlay-types.ts — additions / changes

/** Content maturity ladder. Lower rank = less mature (closer to "being edited"). */
export type ContentStage = "draft" | "preview" | "published";
export const STAGE_RANK: Record<ContentStage, number> = {
  draft: 0,
  preview: 1,
  published: 2,
};

/** One overlay row = one VERSION of a puzzle at a stage. The same (kind,id) may
 *  now have multiple rows (e.g. a live `published` + an in-progress `draft`).
 *  Primary key is (kind, id, stage). */
export interface ContentOverlayRow {
  // …existing fields (id, kind, piece, fen, target, mover, tier, tags,
  //   explanation, order, disabled, optimal_moves, updated_at)…
  stage: ContentStage;
}

/** Builder Save. New/edited content always lands at `draft`; the published row
 *  (if any) is untouched. Server defaults stage to "draft". */
export interface ContentWriteRequest {
  kind: ContentKind;
  record: Omit<ContentOverlayRow, "optimal_moves" | "updated_at" | "stage">;
}

/** Promote (from < to) or demote (from > to). Moves the `from`-version to `to`,
 *  replacing+superseding anything at `to` or below for that id (see Behavior 4). */
export interface ContentStageRequest {
  kind: ContentKind;
  id: string;
  from: ContentStage;
  to: ContentStage;
}

export type ContentStageResult =
  | { ok: true; from: ContentStage; to: ContentStage;
      /** Per-target revalidate outcome, keyed by deployment label. */
      revalidated: Record<string, boolean> }
  | { ok: false; errors: string[] };
```

```ts
// lib/content/stage.ts — new pure + env helpers

/** Maturity floor this deployment displays, from CONTENT_STAGE. null when
 *  unset/invalid → read path serves baseline-only (this IS the kill-switch;
 *  replaces CONTENT_OVERLAY_ENABLED). */
export function envStageFloor(): ContentStage | null;

/** Stages visible to an env at `floor` (floor and above):
 *  draft→[draft,preview,published]; preview→[preview,published];
 *  published→[published]. */
export function visibleStages(floor: ContentStage): ContentStage[];

/** Two-version resolution: from all rows an env can see, pick ONE per (kind,id)
 *  — the freshest version that has reached this env = the LOWEST stage-rank that
 *  is still >= the env's floor. Returns one row per id (input to mergeOverlay). */
export function resolveVisibleRows(
  rows: ContentOverlayRow[],
  floor: ContentStage,
): ContentOverlayRow[];
```

```ts
// Revalidate fan-out config (server env, JSON; label → deployment base URL).
// On ANY stage change the promote endpoint POSTs each target's
// /api/admin/revalidate with the shared ADMIN_TOKEN.
// CONTENT_REVALIDATE_TARGETS='{"preview":"https://preview.chesscito.com","prod":"https://www.chesscito.com"}'
```

## Behavior

1. **Edit / create (Save)** — `POST /api/admin/content` upserts a row at
   `stage='draft'` for `(kind,id)`. Any `published`/`preview` row for that id is
   left intact. Only envs with floor `draft` (dev/localhost) display the draft.
2. **Per-env resolution** — for each id, an env shows the row returned by
   `resolveVisibleRows`: among rows with stage-rank ≥ the env's floor, the one
   with the **lowest** stage-rank (the freshest version that has reached this
   env). So during editing: dev shows the draft, prod still shows published.
3. **Promote** — `POST /api/admin/content/stage {kind,id,from,to}` with `to>from`
   moves the `from` row up: it becomes the `to` version.
4. **Replace + supersede on stage change (single transaction)** — applying a row
   at stage `to` for an id **deletes every other row for that id at stage-rank ≤
   rank(to)** (the one being moved excepted), then sets the moved row's stage to
   `to`. This:
   - replaces the existing `published` when promoting to published, and
   - removes any now-stale lower-stage rows (e.g. a leftover `preview` when you
     promote a draft straight to published), so no env ever resolves to stale
     content below the new frontier.
   - **MUST run as one Postgres transaction** (red-team P0): the delete + the
     stage update are wrapped in a `plpgsql` function `promote_content(kind, id,
     from_stage, to_stage)` invoked via `rpc(...)`. Doing it as two Supabase
     client calls risks deleting the live `published` row and leaving the new
     version un-promoted on a partial failure → the puzzle vanishes from prod.
5. **Fan-out (stage change only)** — promote/demote fans out
   `revalidateTag('content')` to **all** `CONTENT_REVALIDATE_TARGETS` (cheap;
   guarantees both the source env, e.g. on demotion, and the destination env are
   busted). A plain Save (draft upsert, no stage change) triggers **no** fan-out —
   only the writer's local revalidate so the author sees their draft.
6. **Read filter by env** — prod (`CONTENT_STAGE=published`) queries
   `stage='published'`; preview queries `('preview','published')`; dev queries
   all three; then `resolveVisibleRows` collapses to one row per id.
7. **Kill-switch** — `CONTENT_STAGE` unset/invalid → baseline-only (no DB query,
   no `ExerciseCatalogProvider` mounted), byte-identical to the compiled baseline.
8. **Demote / un-publish a single item** — `stage {to:'draft'}` from `published`
   moves the live version back to draft (replacing any existing draft); prod loses
   it on the fan-out and falls back to baseline (baseline-origin) or drops it
   (overlay-only). Removal-while-keeping-published uses the existing `disabled`
   flag riding a promoted row.
9. **Pre-existing rows** default to `draft` on migration → invisible above dev
   until promoted. Re-BFS trust-but-verify is unchanged for every stage.

### Worked example (editing a live puzzle)
`X` published = v1 (all envs show v1) → Save edit → draft = v2 (dev shows v2,
preview+prod show v1) → promote draft→preview (preview+dev show v2, prod v1) →
promote preview→published (deletes old published v1; all envs show v2).

### `disabled` × stage × env truth table (red-team P0)
`disabled` is a per-row flag that rides its version up the ladder. The resolved
row (Behavior 2) is what the env applies; a resolved `disabled` row **removes**
that id from the merged pool (falls back to baseline for baseline-origin ids,
or drops the id for overlay-only ids). Removal of a LIVE item therefore = author
a `disabled` draft → promote it to published (it supersedes the live row).

| Rows for id (stage:disabled) | dev shows | preview shows | prod shows |
|---|---|---|---|
| `published:false` | v (published) | v | v |
| `published:false`, `draft:false`(v2) | v2 (draft) | published | published |
| `published:false`, `draft:true` | removed (baseline/none) | published | published |
| `published:true` | removed | removed | removed |
| `preview:false`(v2), `published:false`(v1) | v2 | v2 | v1 |
| `preview:true`, `published:false` | removed | removed | published |

Key invariants: a `disabled` row only affects envs that **resolve** to it (≥
floor + min-rank); prod is never affected by a `disabled` draft/preview; removing
a live item requires promoting the `disabled` flag to `published`.

## Edge cases
- **Promote with no `from` row** → 404, `ok:false`.
- **Invalid `CONTENT_STAGE`** (typo `prod`): kill-switch (baseline-only) — drops
  ALL overlay content on that env. Must `console.warn` loudly so the outage is
  visible (red-team P0).
- **Partial fan-out failure**: a target's `/api/admin/revalidate` is non-200 /
  times out. The stage change already committed; return `ok:true` with that
  target `false`. DB is the source of truth; operator re-triggers.
- **Concurrent stage change of same id** from two writers: last write wins; the
  supersede-delete (Behavior 4) runs in a single transaction so an id never ends
  with two rows at the same stage.
- **`disabled` across versions**: a row's `disabled` flag rides its stage. To
  remove a published item, promote a `disabled` draft to published (it supersedes
  the live row and removes the puzzle from prod's pool).
- **Fan-out token / SSRF**: targets come from a server env; the `ADMIN_TOKEN`
  header is sent only to the configured https hosts. Never echo the token.
- **Stale-cache backstop**: a missed fan-out must self-heal — `getMergedCatalog`
  keeps a `revalidate` maxAge backstop.
- **Migration on the shared DB**: applied once; PK changes `(kind,id)` →
  `(kind,id,stage)`; `stage … default 'draft'` backfills existing rows (no PK
  collision — each id had one row).

## Rollout (operational — red-team P0)
The migration widens the PK and the code swaps `CONTENT_OVERLAY_ENABLED` for
`CONTENT_STAGE`; on the shared Supabase a careless order can flip live content.
Ordered runbook:
1. **Verify** the current `CONTENT_OVERLAY_ENABLED` value in **preview AND prod**
   (Vercel env). If it is `true` anywhere with rows expected live, those rows must
   be set `stage='published'` (not the default `draft`) as part of step 2, or they
   silently disappear when the new read path turns on.
2. **Apply** the migration to the shared hosted Supabase (commit-only in dev;
   `supabase db push` is the deploy step).
3. **Set envs** per deployment BEFORE shipping the code: `CONTENT_STAGE`
   (prod=`published`, preview=`preview`, local=`draft`), `ADMIN_TOKEN` (same secret
   everywhere — fan-out reuses it), `CONTENT_REVALIDATE_TARGETS`,
   `OVERLAY_PUBLISH_BASE_URL` (local).
4. **Deploy** the new code. With `CONTENT_STAGE` set, each env reads its tier; with
   it unset, an env is baseline-only (safe).
5. **Drop** `CONTENT_OVERLAY_ENABLED` from code + Vercel only after the above is
   verified live.
Rollback at any point: unset `CONTENT_STAGE` on an env → instant baseline-only, no
redeploy. The migration ships a down-script (PK narrow + drop column).

## Acceptance criteria
- [ ] Migration: `content_overlay` gains `stage text not null default 'draft'
      check (stage in ('draft','preview','published'))`; PK becomes
      `(kind,id,stage)`; existing rows → draft.
- [ ] `ContentStage`, `STAGE_RANK`, `visibleStages`, `envStageFloor`,
      `resolveVisibleRows` exist + unit-tested (incl. min-rank resolution with a
      published+draft pair → dev picks draft, prod picks published).
- [ ] Read path filters by `visibleStages(floor)` then `resolveVisibleRows`; one
      unit test per env tier asserts the resolved pool. Prod never resolves a
      draft/preview row.
- [ ] `CONTENT_STAGE` unset/invalid → baseline-only, **zero DB hits**, no provider
      mounted; a loud `console.warn` fires on an invalid (non-empty) value.
- [ ] `CONTENT_OVERLAY_ENABLED` fully removed (code + env docs); `/exercises`
      boundary gates on `envStageFloor()`.
- [ ] Save defaults `stage='draft'`, leaves any published/preview row intact, and
      triggers **no** fan-out (mock asserts zero target calls).
- [ ] Promote is a `plpgsql` RPC `promote_content(...)` running delete+update in
      ONE transaction; an integration test (local Supabase) asserts a partial
      failure / concurrent promote never leaves the id with a deleted-published +
      un-promoted-new state.
- [ ] `POST /api/admin/content/stage` (ADMIN_TOKEN-gated) calls the RPC and fans
      out to **all** targets; returns a per-target `revalidated` map. Tests:
      promote draft→published replaces the live row; draft→published with a stale
      preview deletes the preview; demote; `from===to` rejected; 404; bad token.
- [ ] `disabled` × stage × env truth table holds — one test per row of the table
      (notably: a `disabled` draft never affects prod; removing a live item needs a
      `disabled` row promoted to published).
- [ ] Migration ships a down-script (PK narrow to `(kind,id)` + drop `stage`).
- [ ] Partial fan-out failure → `ok:true`, failed target `false`, change still
      committed. Test.
- [ ] `/api/admin/revalidate` (ADMIN_TOKEN-gated, rate-limited) busts the
      `content` tag; 503 token-unset, 403 bad-token. Test.
- [ ] `getMergedCatalog` has a `revalidate` maxAge backstop.
- [ ] Re-BFS drop behavior unchanged for a published row failing validation. Test.

## Out of scope / future
- Builder promote/demote UI (buttons calling `/api/admin/content/stage`).
- Version history / rollback to a prior published version.
- `builder.chesscito.com` as the canonical write surface.
- Scheduled publishing.

## Open questions
1. **Targets config shape**: one `CONTENT_REVALIDATE_TARGETS` JSON env (chosen)
   vs discrete `…_PREVIEW_URL` / `…_PROD_URL` (simpler in the Vercel UI). Confirm.
2. **maxAge backstop value**: 300s? Long enough to lean on fan-out, short enough
   to self-heal a missed bust. Confirm.
3. **Skip-stage promotes**: allow `draft→published` directly (Behavior 4 cleans up
   any preview), or force the linear `draft→preview→published`? (Recommended:
   allow; the supersede rule keeps it safe.)
