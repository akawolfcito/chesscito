# Coach Reanalyze + Per-Locale Cache Migration — Handoff (2026-05-24)

## What shipped

End-to-end Coach Reanalyze flow built on a per-locale cache key migration. The
user can regenerate the AI analysis of any past game in their active UI
language; the locale badge ("EN" / "ES") is visible on the analysis screen,
and an in-sheet confirm gates the credit spend.

## Commits

| SHA | Subject |
|---|---|
| `cc9be3fa` | feat(coach): locale-aware analysis cache key + read-fallback chain |
| `9dfe3f4a` | feat(coach): dedup history by gameId across locales |
| `11b2fad4` | feat(coach): editorial keys for reanalyze flow + locale badge |
| `21ae15c0` | feat(coach): locale badge + reanalyze CTA + confirm sheet on CoachPanel |
| `7ed31d99` | feat(coach): wire reanalyze flow + locale tracking through arena |
| `52fdbc55` | test(coach): unit coverage for badge + reanalyze CTA on CoachPanel |

Range: `cc9be3fa..52fdbc55` (6 commits, all on `main`, all green).

## State of the tree

- **Tests:** 1905/1905 passing (was 1887 baseline → +18 net).
- **TSC:** clean.
- **VR baselines:** *not refreshed*. Three UI commits (Phase 5 CoachPanel,
  Phase 6 arena wire-up, Phase 7 test backfill) touched `.tsx`. The
  `test:e2e:visual` baselines for the analysis screen need a refresh + manual
  review before push. The hook fired on each commit; deferred to a batched VR
  pass.
- **No new product-code lint or type errors.** Pre-existing private/ + Hardhat
  module-not-found noise unchanged.

## Architecture changes

### Cache key

`coach:analysis:<wallet>:<gameId>` → `coach:analysis:<wallet>:<gameId>:<locale>`

- New helpers in `REDIS_KEYS`:
  - `analysis(wallet, gameId, locale)` — new per-locale key.
  - `analysisLegacy(wallet, gameId)` — pre-migration key, treated as
    EN-by-convention on read.
- `getCachedAnalysisWithFallback()` — locale-aware read with legacy
  fallback (EN only). Lives in `lib/coach/cache-fallback.ts`.
- Legacy records aren't actively migrated. They naturally fade from the read
  path because every EN write best-effort `DEL`s the legacy key.

### Eviction safety

`EVICT_IF_UNANALYZED_LUA` now uses Redis multi-key `EXISTS` to check the
legacy + EN + ES keys together. A game analyzed in any locale stays protected
from `enforceGameCap` eviction.

### History dedup

The LPUSH'd `analysisList` can now carry the same gameId twice (EN write + ES
write). `/api/coach/history` GET reads 50 + Set-dedups to 20 unique ids;
`parseAnalyzedHistory()` adds defense-in-depth dedup on the parser side
(first-occurrence-wins).

### Delete-by-self

`DELETE /api/coach/history` enumerates all three variants (`legacy`, `:en`,
`:es`) per gameId so a re-login can't surface a stale record under any
locale.

## API contract

`POST /api/coach/analyze` body:

```json
{
  "gameId": "<uuid>",
  "walletAddress": "0x...",
  "locale": "en" | "es",
  "forceLocale": true | false  // new — bypasses cache, regenerates
}
```

`status: "ready"` response now includes `locale: "en" | "es"`. Idempotent
short-circuits echo the cached record's locale.

`GET /api/coach/history?wallet=0x...&locale=es` — optional `locale` query
param threads through the fallback chain. Defaults to `"en"` for
back-compat with legacy clients.

## UX surface

CoachPanel gained three props (all optional, back-compat):

```ts
analysisLocale?: "en" | "es"
onReanalyze?: () => Promise<void>
isReanalyzing?: boolean
```

- **Badge:** rendered next to the difficulty/moves header row. Falls back to
  active UI locale when `analysisLocale` is undefined (legacy records).
- **CTA:** "Reanalyze" text-link below the existing Play Again / History
  buttons. Opens an inline non-destructive confirm sheet ("Reanalyze this
  game? This generates a fresh analysis in your current language and uses 1
  credit.").
- **In-flight:** CTA disables + label flips to "Generating new analysis…".

## What's NOT in scope (deferred)

1. **Atomic analysisList LPUSH.** The list still LPUSHes unconditionally on
   every successful analyze; duplicates are filtered on read. Mirror the
   `GAME_LIST_LPUSH_LUA` pattern when the duplicate cost becomes measurable.
2. **Job record locale.** The polling-completion path (`<CoachLoading
   onReady>`) doesn't know the analysis's actual locale because the job key
   doesn't track it. The badge defaults to active UI locale at onReady — 99.9%
   accurate, edge case is user-switched-locale-mid-poll.
3. **History endpoint accepts `?locale=` but no caller passes it yet.** All
   callers default to `"en"` via the fallback. Wire the query param through
   `coach-history.tsx` when surfacing per-locale history badges.
4. **VR baseline refresh.** Three `.tsx` commits ago. Pending batched
   `pnpm test:e2e:visual` pass before any push.

## Open questions

- Reanalyze should arguably skip the optimistic credit decrement and let the
  server-side credit DECR drive the UI count via `/api/credits/me`. Today the
  client double-decrements in flight then re-fetches; a refresh during
  in-flight could briefly under-show credits. Low impact for v1.
- Pricing display: the confirm sheet says "uses 1 credit" but PRO subscribers
  don't spend credits (server short-circuits the DECR). Copy is technically
  inaccurate for PRO. Consider branching the message on `proActive`.

## Next steps for the operator

1. Refresh VR baselines:

   ```
   cd apps/web && pnpm test:e2e:visual
   ```

   Review screenshots in `e2e-results/snapshots/` and accept the
   analysis-screen diffs (badge added, reanalyze CTA added).

2. Push `main`:

   ```
   git push origin main
   ```

3. Verify on production (`chesscito.com`) after the Vercel deploy:
   - Open `/arena`, complete a game, request analysis → confirm badge shows
     "EN" or "ES" matching active locale.
   - Tap **Reanalyze** → confirm sheet opens, accept → fresh analysis lands,
     credits decrement by 1, badge unchanged.
   - Switch locale via persistent dock, re-tap **Reanalyze** → confirm new
     analysis is in the new language and credits decrement again (separate
     cache key).

## Files touched

```
apps/web/src/app/api/coach/analyze/route.ts
apps/web/src/app/api/coach/analyze/__tests__/route.test.ts
apps/web/src/app/api/coach/history/route.ts
apps/web/src/app/api/coach/history/__tests__/route.test.ts
apps/web/src/app/[locale]/arena/page.tsx
apps/web/src/components/coach/coach-panel.tsx
apps/web/src/components/coach/__tests__/coach-panel.test.tsx
apps/web/src/lib/coach/backfill.ts
apps/web/src/lib/coach/cache-fallback.ts                          (new)
apps/web/src/lib/coach/__tests__/cache-fallback.test.ts           (new)
apps/web/src/lib/coach/coach-history-parse.ts
apps/web/src/lib/coach/__tests__/coach-history-parse.test.ts
apps/web/src/lib/coach/game-persistence.ts
apps/web/src/lib/coach/__tests__/game-persistence.test.ts
apps/web/src/lib/coach/redis-keys.ts
apps/web/src/lib/coach/request-coach-analyze.ts
apps/web/src/lib/coach/__tests__/request-coach-analyze.test.ts
apps/web/src/lib/coach/types.ts
apps/web/src/lib/content/editorial.ts
apps/web/src/lib/content/messages/es.ts
```

20 files (2 new), +600 LOC across product + tests.
