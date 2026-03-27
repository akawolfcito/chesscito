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
export function getSupabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    return null;
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
