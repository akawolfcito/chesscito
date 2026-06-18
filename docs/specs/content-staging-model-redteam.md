# Red Team Review — content-staging-model

**Date**: 2026-06-17
**Reviewer mindset**: hostile QA + senior engineer
**Spec reviewed**: `docs/specs/content-staging-model.md` (two-version model)

## Findings

### P0 — Must address before implementation

- **[atomicity] The promote "replace + supersede" (Behavior 4) MUST be a single
  Postgres transaction, not two Supabase client calls.** The spec describes
  "delete rows ≤ rank(to) except the moved one, then update the moved row's
  stage." Done as a JS `delete()` then `update()`, a failure (or a concurrent
  writer) between them can delete the live `published` row and leave the new one
  un-promoted → **the puzzle vanishes from prod**. Why blocking: silent prod
  content loss. Fix: implement promote as a `plpgsql` function (RPC) wrapping
  delete+update in one transaction; the route calls `rpc('promote_content', …)`.

- **[rollout sequencing] Removing `CONTENT_OVERLAY_ENABLED` while the migration
  changes the PK is a live-prod hazard.** During the deploy window the OLD code
  (no stage filter, `select('*')`) is still serving; if prod currently has
  `CONTENT_OVERLAY_ENABLED=true` with rows in the shared DB, those rows (now
  defaulted to `draft`) would be read by the old code with no stage filter and
  shown — or, if the flag is off, fine. Why blocking: we are not 100% sure of the
  current hosted flag state (the user's earlier "it worked in preview" was a
  misread). Fix: (a) **verify** the current `CONTENT_OVERLAY_ENABLED` value in
  preview AND prod before migrating; (b) define the ordered runbook: apply
  migration → set `CONTENT_STAGE` per env (prod=published) + `ADMIN_TOKEN` +
  `CONTENT_REVALIDATE_TARGETS` → deploy new code → only then drop the old flag.

- **[disabled × versions] The `disabled`-rides-a-stage semantics (Behavior 8 /
  edge case) is a correctness landmine and is under-specified.** If a `disabled`
  draft coexists with a live `published`, `resolveVisibleRows` picks the draft
  (min-rank) for dev → dev shows the item removed while prod still shows it. Is
  that intended? What about a `disabled` row at `published` (the actual
  un-publish)? Why blocking: removal is a destructive content op; ambiguous
  semantics will produce "puzzle still showing / puzzle gone" bugs. Fix: write the
  truth table (stage × disabled × env) explicitly and a test per cell.

### P1 — Should address

- **[builder Save semantics change] "Save" now means "save draft", not "publish
  live".** Today the user's mental model is Save = live. After this change a Save
  no longer reaches prod (needs a promote). Risk if ignored: the founder edits,
  sees nothing in prod, thinks it's broken (exactly the confusion this spec is
  meant to end). Fix: the builder must label it ("Saved as draft") and the
  promote UI (out of scope here) must land close behind — confirm the follow-up
  is scheduled, not indefinitely deferred.

- **[fan-out over-busts prod] — DISSOLVED (founder 2026-06-17).** The whole
  cross-deployment fan-out is dropped in favor of a short cache TTL (each env
  self-refreshes within 60s). This also removes the partial-fan-out-failure edge
  case, the `/api/admin/revalidate` endpoint, and the SSRF/token-leak surface
  below. _Original finding, for the record:_ fan-out to ALL targets busted prod's
  cache on a preview-only promote — needless churn. Fix would have been to scope
  to **affected** envs (those whose `resolveVisibleRows` output could change =
  stages between
  rank(from) and rank(to)); keep "all" only if simplicity is judged worth the
  churn (fine in pre-launch).

- **[cache key omits stage] `getMergedCatalog` is keyed `["content-merged-catalog"]`
  but the result now depends on `CONTENT_STAGE`.** Per-deployment this is safe
  (one stage per deployment), but branch/preview deployments sharing build infra
  could collide. Fix: include `envStageFloor()` in the `unstable_cache` key.

- **[promote `from` mismatch] If the client sends a `from` that no longer matches
  an existing row** (stale builder state), the spec returns 404 even when another
  version exists. Fix: 404 error message must list the id's existing stages so the
  builder can recover; consider rejecting `from===to` explicitly (no-op).

### P2 — Nice to clarify

- **[naming] `CONTENT_STAGE` vs the removed `CONTENT_OVERLAY_ENABLED`** — keep a
  consistent domain prefix (e.g. `CONTENT_OVERLAY_STAGE`) so ops doesn't confuse
  them during the cutover.
- **[observability] Extend `MergedCatalog`** with the resolved stage floor +
  per-id version-resolution count, so a "why is prod showing the old version"
  question is answerable from the response, not guesswork.
- **[targets shape] Open question #1** (JSON map vs discrete URL envs) leans JSON
  for one-var tidiness, but discrete vars are far easier to set/rotate in the
  Vercel dashboard and avoid a JSON-parse failure mode taking down all fan-out.
  Lean discrete.

## Categories audited

### Contract gaps
- `ContentStageRequest` allows `from===to` — define as rejected no-op.
- `resolveVisibleRows` must run BEFORE the BFS merge so per-request BFS cost stays
  one-row-per-id (verified against `merged-catalog.ts` — `mergeOverlay` BFS-checks
  each row; collapsing first keeps cost flat). ✓ not a finding, but assert in a test.
- No `any`/`unknown` smells in the new types.

### Behavioral ambiguity
- "Freshest version that reached this env" (min-rank ≥ floor) is well-defined and
  the worked example checks out across the lifecycle. Promote-skip (`draft→
  published` with a stale `preview`) is the one trap — covered by the supersede
  rule, but MUST have a dedicated test.

### Hidden assumptions
- Assumes the shared Supabase + per-deployment cache model (confirmed by user).
- Assumes `ADMIN_TOKEN` is the SAME across all deployments (fan-out reuses it). If
  tokens differ per env, fan-out revalidate gets 403 → document the single-token
  requirement.

### Backward compatibility
- PK change `(kind,id)`→`(kind,id,stage)`: safe for existing rows (each id unique →
  becomes `…,'draft'`). Existing `/api/admin/content` writes without `stage` still
  work (server defaults draft). The `/api/dev/publish` proxy is unchanged.

### Security & data
- RLS service-role-only preserved; client never reaches the table. ✓
- Rate-limit BOTH `/api/admin/content/stage` and `/api/admin/revalidate` (token
  leak → cache-bust DoS). ADMIN_TOKEN never logged/echoed.

### Operational readiness
- Rollback: set `CONTENT_STAGE` unset on an env → instant baseline-only (kill-
  switch) without redeploy. Good. The migration is additive + non-destructive
  (new column + PK widen) — but the PK change is not trivially reversible; include
  a down-migration note.
- Logging: loud warn on invalid `CONTENT_STAGE`; structured log on each promote
  (id, from, to, per-target revalidate result).

### Test coverage gaps
- Transactional promote (concurrent/failure) — needs an integration test against a
  local Supabase, not just unit mocks.
- disabled×stage truth table.
- new-puzzle (draft-only) does NOT leak to preview/prod.

## Verdict
**NEEDS REVISION → FOLDED (2026-06-17)** — the three P0s are now addressed in the
spec:
1. ✅ Promote = transactional `promote_content` RPC (Behavior 4 + acceptance).
2. ✅ Rollout/runbook sequencing + "verify current `CONTENT_OVERLAY_ENABLED`"
   (new "Rollout (operational)" section).
3. ✅ `disabled` × stage × env truth table + per-row tests (new section + criterion).

**READY for /tdd.** All 3 founder open questions are resolved (2026-06-17):
cross-deployment **fan-out dropped → cache TTL** (60s, each env self-refreshes),
which also dissolves the fan-out P1, the partial-failure edge case, the SSRF/token
surface, and the targets-shape P2. Skip-stage promotes allowed. Remaining P1s
(Save-as-draft labeling, cache key includes the stage floor, `from` mismatch
error) are documented and handled during /tdd; none block starting.
