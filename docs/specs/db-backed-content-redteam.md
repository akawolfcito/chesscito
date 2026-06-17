# Red Team Review — db-backed-content

**Date**: 2026-06-17
**Reviewer mindset**: hostile QA + senior engineer

## Findings

### P0 — Must address before implementation

- **[read-path-sync] The synchronous-import assumption is load-bearing and the spec underestimates it.** `EXERCISES`/`LABYRINTHS` are module-level `const`s evaluated at import. Pure libs (`rotation.ts`, `path.ts`, `progress-adapter.ts`) import them at top level, and the client hooks call those libs. Phase 2's "thread merged pools via context + make hooks take a param" is not a small prop drill — it is an API change to every catalog-consuming function with its own test fixtures (the same fan-out Task 2 of the id-keying cluster hit: ~9 files). **Blocking:** the spec must enumerate the exact injection seam per consumer (which functions gain a `catalog` param, which read context) and confirm the default-to-baseline keeps all existing unit tests green, BEFORE coding. Otherwise Phase 2 balloons.

- **[hydration-mismatch] Server-fetched merged catalog + client component = hydration risk.** `exercises-screen` is `"use client"`. If the server boundary passes a merged catalog that differs from the baseline the client bundle still contains, the first client render can mismatch SSR (React hydration error), and the id-keyed progress migration (`loadProgress`) keys off the *current* catalog — a catalog that changes between server and client could mismap. **Blocking:** spec must pin a single source per render (server-provided pools are authoritative; client must NOT re-derive from its baseline import) and define the hydration contract.

- **[admin-auth-undefined] The write path is the entire security surface and the auth mechanism is an open question, not a decision.** A prod write route that mutates live content is the highest-risk addition in the whole feature. Leaving "wallet-sig vs ADMIN_TOKEN" unresolved means the P0 security control is unspecified. **Blocking:** pick the mechanism in the spec, define where the secret lives (server-only env per CLAUDE.md — never `NEXT_PUBLIC_`), and the exact check. Also: rate-limit + audit log the route.

### P1 — Should address

- **[optimal-moves-trust] Storing `optimal_moves` and trusting it at read time is a poisoning vector.** If a row is hand-edited in the DB (or a future bug writes a wrong value), the read path serves an unverified puzzle — wrong star thresholds, or an unsolvable "live" puzzle the BFS would have rejected. Risk: a broken puzzle ships live with no build gate. Mitigation to spec: either re-validate on read (cost) or document that the DB is service-role-only + the write route is the sole writer + add a cheap integrity check (re-run BFS for overlay rows only — there are few — inside the cached loader, so it is paid once per revalidation, not per request).

- **[revalidate-scope] `revalidateTag("content")` correctness depends on every cached read using that exact tag, and on Next 14 App Router cache semantics.** If the `/exercises` route is statically rendered, or a fetch isn't tagged, the revalidation silently no-ops and "live" content never appears — the headline feature fails invisibly. Risk: ship a feature that looks done but doesn't propagate. Spec must define the exact caching primitive (`unstable_cache` vs `fetch` tags vs route segment config) and an acceptance test that a write actually busts the cache.

- **[free-tier-pause-latency] Free-tier wake-from-pause is slow, not instant.** When the project has been paused, the first query after a save can take seconds-to-timeout. The cached loader will block that one request (or fall back to baseline and the save appears "lost" until the next revalidation). Spec says baseline-only on timeout but doesn't define the timeout or that the founder's own save (which writes successfully) may not be readable for a while. Risk: confusing "I saved but don't see it" founder experience. Spec a short query timeout + a builder "saved; may take a moment to appear" affordance.

- **[order-collision-pools] Append-new + replace-edit changes pool size, which interacts with `BADGE_THRESHOLD` and senda-completion.** A live-added exercise grows a pool from e.g. 10→11; `getExerciseCount` changes; badge math (`total >= 10`) and "all done" checks shift under a player mid-session. Not wrong, but unspecified. Confirm the merged pool size flows through `getExerciseCount` and that a player who completed the senda doesn't get it "re-opened" jarringly by a live addition.

### P2 — Nice to clarify

- **[descriptions-merge] `descriptions` map merge isn't specified.** An edited explanation must override the baseline `GENERATED_EXERCISE_DESCRIPTIONS[id]`; a disabled row must drop its description. State the merge rule explicitly (mirror the catalog merge).
- **[updated_at-cachekey] `updated_at` is in the contract but its role is vague.** Is it a cache key, an observability field, or both? If used for conditional fetch, define it; else mark audit-only.
- **[migration-naming] Follow the `YYYYMMDDHHMMSS_name.sql` convention in `apps/web/supabase/migrations/` and the commit-only-in-dev workflow (hosted apply is CI/deploy).**
- **[tags-empty-array] `tags text[]` vs `null` vs `[]` — normalize one (the builder sends `undefined` when empty). Pick `null` to match the sparse style and avoid `[] != null` churn.**

## Categories audited

### Contract gaps
- `ContentOverlayRow` is complete and typed (no `any`). Good. But `MergedCatalog.source` as a union is observability-only — ensure it's logged, not branched on by game logic.
- No error type enumerated for the read path — it never errors (falls back), but the loader should return a discriminated result internally for logging.

### Behavioral ambiguity
- "Replace a baseline puzzle by id" — does an overlay edit preserve the baseline `order`, or take the overlay's `order`? (Spec implies overlay's; confirm, since it affects sequence.)
- Behavior 4 ("zero DB hits when warm") is only true if the caching primitive is correct — see P1 revalidate-scope.

### Hidden assumptions
- Assumes the builder write path can compute `optimal_moves` server-side with the same validator the dev route uses — verify that validator is importable in a prod route (it lives in `scripts/`, which may not be in the app's prod build graph). **This is a real trap:** `import-puzzles.ts` is under `scripts/`; importing it into an `app/` route may pull dev-only deps or fail the bundle. Confirm or relocate the shared validator into `src/lib`.
- Assumes Supabase env present in prod (it is, per existing usage) but the feature must degrade when absent.

### Backward compatibility
- Flag-off path must be byte-identical (acceptance criterion exists — good).
- No change to stored localStorage progress shape — id-keyed, unaffected. Good.

### Security & data
- Service-role-only table (no RLS grants to anon) is correct. Confirm no client ever queries `content_overlay` directly.
- Admin write route is the crux — see P0 admin-auth-undefined.
- Input validation: the write route must validate piece/tier/kind/FEN and run BFS before persist (reuse dev-route logic).

### Test coverage gaps
- Add a test that the validator lives somewhere importable by both the dev route and the new prod route (no `scripts/` import from `app/`).
- Add a cache-busting test (write → revalidate → next read reflects it) — without it, the feature's core claim is untested.

### Operational readiness
- Log `source` + `overlayCount` + overlay fetch latency. Without it, a silent fall-to-baseline (paused DB) is invisible.
- Rollback: the flag (`CONTENT_OVERLAY_ENABLED=false`) is the kill switch — confirm it fully bypasses the loader (no DB call) when off.

## Resolution (2026-06-17, post-revision)
All three P0s + the key P1s were folded into `db-backed-content.md`:
- **read-path-sync** → per-consumer injection-seam table + default-arg=baseline + a hard "flag-off byte-identical" acceptance criterion.
- **hydration-mismatch** → explicit hydration contract (server pools authoritative via `CatalogProvider`; client never re-derives).
- **admin-auth** → `ADMIN_TOKEN` server-only + rate-limit + audit log; 503/403 paths specified.
- **optimal-moves-trust** → BFS re-verified in the cached loader, mismatches dropped.
- **revalidate-scope** → `unstable_cache` tagged `"content"` + a cache-bust acceptance test.
- **validator-in-scripts** → Phase 0 relocates the shared validator to `src/lib/content/`.
- **free-tier-pause** → ≤2s overlay timeout + builder "propagating" affordance.

**Updated verdict: READY for /tdd (Phase 0 → Phase 1).** Remaining open items are non-blocking product calls (senda re-open UX; `updated_at` as a future cache key).

## Original verdict
**NEEDS REVISION** — resolve the three P0s in the spec first:
1. Enumerate the exact read-path injection seam per consumer (sync→inject) + prove flag-off keeps tests green.
2. Pin the hydration contract (server pools authoritative; client must not re-derive).
3. Decide the admin-auth mechanism + secret location + rate-limit/audit.

Also fold in P1 **optimal-moves-trust**, **revalidate-scope** (name the caching primitive + a cache-bust test), and the hidden-assumption trap that the **BFS validator must move out of `scripts/` into `src/lib`** so a prod route can import it. After these, the phased plan (write-side → injected loader → flag flip) is sound and ready for `/tdd` on Phase 1.
