# Red Team Review — db-content-overlay-full

**Date**: 2026-06-17
**Reviewer mindset**: hostile QA + senior engineer

## Findings

### P0 — Must address before implementation

- **[token-leak-via-proxy-response]** The proxy must NOT echo `ADMIN_TOKEN`,
  the upstream `Authorization`/`x-admin-token` header, or the raw admin-route
  response (which on error may include DB connection strings) back to the
  builder client. `PublishResult.overlay.errors` must be sanitized to safe
  strings only. Why blocking: the whole point is the token never reaching the
  browser; a sloppy error passthrough defeats it.

- **[dev-route-helper-extraction]** Step 1 says "reuse the existing
  `/api/dev/labyrinth` logic via a shared helper." Today that logic lives
  *inside* the route handler (`route.ts:48-94`) doing fs read-modify-write +
  `renderGeneratedModule`. It must be extracted to a pure-ish helper
  (`writeBaselineRecord(kind, record): { id, errors }`) that BOTH the existing
  dev route and the new proxy call, or the two paths drift (one validates/regens,
  the other doesn't). Why blocking: without extraction the proxy either
  duplicates fs+BFS logic (divergence risk) or HTTP-calls its own dev route
  (fragile, double-parse). Guard with the dev-route tests staying green.

- **[labyrinth-gate-drift]** `exercises-screen.tsx:2878`
  (`LABYRINTHS.king.map((l) => l.id)`) feeds a gate/unlock computation, not just
  a render list. If that one reads merged but another nearby labyrinth read stays
  baseline, the gate and the displayed list disagree → a labyrinth shows but is
  locked (or vice versa). Why blocking: must audit ALL labyrinth-derived state in
  the screen (count, gate, "all complete" in `training/path.ts:140`) and inject
  consistently, not just the two grep hits.

### P1 — Should address

- **[partial-failure-idempotency]** Behavior 5: baseline OK + overlay FAIL. On
  retry, baseline write re-runs (idempotent upsert-by-id, fine) and overlay
  re-POSTs. But if overlay actually succeeded and only the *response* was lost
  (network blip after write), the retry double-writes the same `(kind,id)` —
  harmless (last-write-wins PK) but the `revalidated` flag and audit log fire
  twice. Risk if ignored: confusing audit trail; acceptable but document it.

- **[base-url-trailing-slash + same-origin]** `OVERLAY_PUBLISH_BASE_URL` string
  concat (`${base}/api/admin/content`) breaks on a trailing slash and on an
  unset value (`undefined/api/...` → fetch to a bogus URL throws). Normalize +
  fail-fast with a clear "overlay target not configured" message (Behavior 6).
  Risk if ignored: cryptic fetch errors masquerade as publish failures.

- **[descriptions-context-default-staleness]** The widened context default
  bakes `GENERATED_EXERCISE_DESCRIPTIONS` at module load. Fine, but the page
  provider must pass `merged.descriptions` (not re-derive) — confirm page.tsx
  threads all three fields, else descriptions silently fall back to baseline even
  with the flag ON (a half-wired provider is worse than none: looks enabled,
  isn't). Map to an explicit acceptance test (overlay description visible).

- **[useExerciseCatalog-rename-ripple]** Renaming the context object
  (`ExerciseCatalogContext` → `ContentCatalogContext`) and the provider
  (`ExerciseCatalogProvider` → `ContentCatalogProvider`) touches page.tsx + the
  context file + the page test (which mocks `ExerciseCatalogProvider` by name).
  Keep the provider rename minimal or alias it; update the Phase-2c page test
  mock in the same change or it false-fails. Risk if ignored: red test unrelated
  to real behavior.

### P2 — Nice to clarify

- **[builder-target-visibility]** The builder gives no visual cue WHERE it
  publishes (preview vs prod). A founder could publish to prod thinking it's
  preview. Consider surfacing the resolved `OVERLAY_PUBLISH_BASE_URL` host in the
  Save button/toast. (Open question 1 territory.)

- **[csv-bucket-coupling]** The dev write rebuilds the generated module from
  BOTH json buckets + the CSV (`route.ts:80-86`). The extracted helper must
  preserve that (a labyrinth save still re-reads exercises + CSV), or saving a
  labyrinth could regenerate a module missing CSV-sourced puzzles.

- **[concurrent-builder-saves]** Two rapid Saves (double-click) → two fs
  read-modify-write races on the same json. Pre-existing risk in the dev route,
  not introduced here, but the proxy's two-step (baseline→overlay) widens the
  window. Debounce the Save button.

## Categories audited

### Contract gaps
- `PublishResult` models partial failure explicitly (good). `overlay.errors` type
  is `string[]` — must be sanitized (P0). No `any`/`unknown` smells.
- `LabyrinthRecord` reused for the publish record — confirm it already carries
  `tier`/`tags`/`explanation`/`order`/`disabled` (it does; the builder sends them).

### Behavioral ambiguity
- "Reuse existing dev logic" was hand-wavy → pinned to helper extraction (P0).
- Partial-failure retry semantics clarified (P1).

### Hidden assumptions
- Assumes `ADMIN_TOKEN` is in the founder's LOCAL `.env` (separate from the
  Vercel-hosted value). The local token must match the **target** environment's
  token (preview token to publish to preview). Mismatch → 403. Document.
- Assumes the migration is applied on the target (else overlay POST 500s). Out of
  this spec's control but a publish precondition.

### Backward compatibility
- `useExerciseCatalog()` return shape preserved → 3 consumers + their tests
  unaffected. The rename ripple (P1) is the only compat risk.
- `resolveExerciseDescription` default arg → existing single caller + tests pass.
- Flag OFF path must stay byte-identical — same proof obligation as Phase 2c.

### Security & data
- Token-leak is the headline risk (P0). Proxy is dev-only (NODE_ENV 404) so the
  attack surface is the founder's machine, but error passthrough could still
  print secrets to a shared screen/log.
- No new PII. RLS unchanged (service-role server reads only).
- Rate-limit: the admin route already token-buckets; the proxy adds no new public
  surface.

### Test coverage gaps
- Every acceptance criterion is testable. Add explicit tests: (a) overlay
  labyrinth visible under flag ON, (b) overlay description visible, (c) proxy
  404 in prod, (d) proxy partial-failure shape, (e) no token in client bundle
  (assert the proxy reads env server-side; the builder never imports the token).
- `training/path.ts` "all labyrinths complete" under a grown labyrinth pool needs
  a test (mirrors the senda-(a) confirmation for exercises).

### Operational readiness
- Proxy logs both outcomes server-side (reuse the admin route's audit). Ensure it
  does NOT log the token.
- Rollback: this is all behind `CONTENT_OVERLAY_ENABLED`; flag OFF reverts the
  read path. The builder proxy is dev-only so it can't affect prod players.

## Verdict
**NEEDS REVISION (minor)** — the spec is sound and scoped, but three P0s must be
folded in before `/tdd`:
1. Sanitize proxy error output (no token/secret passthrough).
2. Extract the dev baseline-write into a shared helper (both routes call it).
3. Audit ALL labyrinth-derived state in the screen (incl. the king-gate at
   `:2878` and `training/path.ts:140`), not just the two obvious reads.

Fold these into the spec's Behavior/Acceptance sections, then it is READY for
`/tdd`. P1/P2 are implementation-time concerns, not spec blockers.
