import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client for the discovery app (www.chesscito.com).
 *
 * Port of `apps/web/src/lib/supabase/server.ts`, hardened for a project that
 * had NO secrets before this file existed. That property is the reason for
 * every constraint below — it is cheaper to keep than to recover:
 *
 *  - `import "server-only"` makes a client-component import a BUILD error,
 *    not a runtime surprise. Next.js resolves the specifier through its own
 *    compiled copy, so there is no package to install.
 *  - Both variables are read WITHOUT the `NEXT_PUBLIC_` prefix. A prefixed
 *    name is inlined into the browser bundle at build time, which is exactly
 *    how a service role key leaks. There is a guard test for the prefix.
 *  - Nothing here exports, returns, logs or interpolates an env value. The
 *    only thing that escapes this module is the client object itself.
 *
 * Returns `null` when either variable is missing, and NEVER throws on import
 * or on call: the Phase C aggregator degrades to `EMPTY_PUBLIC_STATS` and the
 * page renders em-dashes. Deleting the two variables is therefore a complete,
 * deploy-free rollback — see docs/plans/2026-08-04-stats-consolidation-execution-plan.md
 * (Phase B).
 *
 * Reads go through `service_role`, which is the only role holding EXECUTE on
 * the eight `stats_*` RPCs (`anon` and `authenticated` are revoked; verified
 * against the real database by `scripts/ops/verify-stats-rpcs.ts`).
 */
/**
 * Every request this client makes is opted OUT of Next's Data Cache.
 *
 * `supabase-js` goes through `fetch`, and Next 14 caches `fetch` inside a
 * Server Component by default — silently, and with a cache that **does NOT get
 * purged by a deploy**. A stale census once survived 18 h 34 min *and a full
 * deploy* because of exactly this. Caching /stats is a real goal, but it is
 * Phase E's, it belongs at the page level where its TTL and its invalidation
 * are visible, and it must never be something the data layer did by accident.
 *
 * So: `no-store` here, explicitly, on the client every read shares.
 */
const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

export function getSupabaseServer(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    global: { fetch: noStoreFetch },
    auth: {
      // A service-role client is stateless and request-scoped: there is no
      // user session to keep, refresh, or recover from a URL fragment. All
      // three are off explicitly rather than by default, so a future
      // supabase-js default flip cannot silently turn one back on.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
