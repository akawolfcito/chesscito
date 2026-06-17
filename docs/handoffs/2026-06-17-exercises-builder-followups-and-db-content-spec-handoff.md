# Handoff — exercises-builder follow-ups + DB-content spec/Phase 0 (2026-06-17)

## Shipped to `main` this session (4 PRs merged + 1 auto-merging)
| PR | What | State |
|----|------|-------|
| #120 | Exercises-builder + id-keyed progress (5-task cluster) + follow-up #1 (author description/tier/tags, silence i18n fallback) | ✅ merged |
| #121 | Builder soft-delete (disable/enable, reversible, catalog-excluded) | ✅ merged |
| (main) | `docs(spec)` db-backed-content + red-team | ✅ pushed `87df29e2` |
| #122 | db-backed-content **Phase 0** — prod-safe catalog builder in `src/lib/content/catalog.ts` | 🔄 auto-merge (CI) |

Suite **3862/3862** · `tsc` clean throughout. Generated module byte-identical after Phase 0.

## ▶ RESUME ("continuamos") = db-backed-content Phase 1
Spec **READY**: `docs/specs/db-backed-content.md` (+ `-redteam.md`, P0/P1 folded in).
Goal: builder-authored content goes live in prod **without redeploy**, cheap on free tier.

**Locked decisions:** baseline (compiled module) ⊕ Supabase **overlay** (deltas only) · on-demand `revalidateTag("content")` from the write route · `ADMIN_TOKEN` server-only gate · BFS re-verified in the cached loader · baseline fallback when DB unreachable (free-tier pause).

**Phase 0 DONE (#122):** validator extracted to `src/lib/content/catalog.ts`; `app/` routes can import it (proven by the dev route + tsc). Zero behavior change.

**Phase 1 (next — the "continuamos" entry point):**
1. Migration `content_overlay` table (`apps/web/supabase/migrations/<ts>_content_overlay.sql`) — schema in the spec. Commit-only in dev; hosted apply is CI.
2. `ADMIN_TOKEN`-gated write route (`app/api/admin/content/route.ts` or extend the dev route): 503 if env unset, 403 bad token, 400 unsolvable (reuse `buildCatalog` from `@/lib/content/catalog`), upsert `(kind,id)`, `revalidateTag("content")`, rate-limit + audit log.
3. Read path still serves the baseline this phase (no player-facing change yet).
4. TDD: route tests (503/403/400/200 + revalidate called); migration applies locally.

**Phase 2** (later): cached `getMergedCatalog()` + the per-consumer injection seam (table in the spec) + hydration contract, behind `CONTENT_OVERLAY_ENABLED` (default off, byte-identical). **Phase 3:** flip flag + observe.

**Open product calls before Phase 2 enable:** senda re-open UX when a live addition grows a completed pool (default: leave completed, surface new as optional); `updated_at` as a future cache key.

## Other backlog (unchanged)
- **Edge-walls** (walls on cell borders, not blocked cells) — queued assessment in `docs/backlog/2026-06-17-edge-walls-on-borders.md`. Multi-day, needs its own spec (replace-vs-coexist first).
- **VR for exercises surface** — N/A this cluster (no exercises baselines exist; changes behavior-preserving). Real gap = ADD baselines for exercises screen/drawer (backlog).
- Validate economy model #1 (`docs/product/2026-06-16-economy-and-monetization-strategy.md`).
- Builder: new exercises still can't author from a blank description requirement (optional by design; empty → generic "Exercise N", no warning).

## Process notes
- Background review subagents (named) did NOT relay reports via plain output — only idle pings. Verified Task 1/2 spec+quality inline instead. For subagent-driven flows, either tell agents to `SendMessage(to:"main")` or spawn nameless (final message returns directly).
- Builder live smoke = POST via dev API (the Save path) + 390px Playwright screenshot, then `git checkout` the 2 mutated files (`content/*.json` + generated). Dev server: `PORT=3947 pnpm dev` (run_in_background), poll log for "Ready".
- Vercel posttooluse hook flags the dev route's fs writes as a serverless anti-pattern — false positive (dev-only, 404s in prod; Phase 1 replaces it with Supabase).
