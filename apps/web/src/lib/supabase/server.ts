import { createClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client using service role key.
 * NEVER import this from client components.
 *
 * Supabase stores derived data only — on-chain remains source of truth
 * for scores, badges, and victories.
 *
 * Returns null if env vars are missing (graceful degradation).
 */
export type SupabaseServerOptions = {
  /**
   * ⛔ OPT OUT OF NEXT'S DATA CACHE. Required for any read whose answer must be
   * the CURRENT row.
   *
   * In the App Router, Next patches `fetch` and caches GET responses by
   * default, and `supabase-js` talks to PostgREST through `fetch`. So a
   * `select` is cached like any other GET, ACROSS REQUESTS AND USERS, and the
   * route keeps answering a snapshot long after the row changed.
   *
   * ⚠️ `export const dynamic = "force-dynamic"` does NOT prevent this: it
   * forces dynamic RENDERING, not fresh data. And `next dev` does not apply the
   * cache at all, which is why this is invisible locally and only appears on a
   * real build.
   *
   * Measured on preview, 2026-08-16: a duel row was `active / version 2` in the
   * database while `GET /api/duel/[id]` kept answering `awaiting-opponent /
   * version 1` — with `x-vercel-cache: MISS`, so the route was running and the
   * staleness was underneath it.
   *
   * ⚠️ Opt-in rather than the default ON PURPOSE: this factory is shared by
   * many routes, and flipping the behaviour for all of them during a feature
   * freeze is a change nobody asked for. Whether the others also need it is a
   * real question — see `docs/audits/2026-08-16-supabase-fetch-cache.md`.
   */
  freshReads?: boolean;
};

/**
 * Server-only Supabase client using service role key.
 * NEVER import this from client components.
 *
 * Supabase stores derived data only — on-chain remains source of truth
 * for scores, badges, and victories.
 *
 * Returns null if env vars are missing (graceful degradation).
 */
export function getSupabaseServer(options: SupabaseServerOptions = {}) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
    ...(options.freshReads
      ? {
          global: {
            fetch: (input: RequestInfo | URL, init?: RequestInit) =>
              fetch(input, { ...init, cache: "no-store" }),
          },
        }
      : {}),
  });
}
