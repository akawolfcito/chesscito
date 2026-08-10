/**
 * Web Early Access — the only writer of `public.web_early_access`.
 *
 * Writes `waiting` rows and nothing else. There is deliberately no function
 * here that sets `allowlisted`: that value records an action taken in the Privy
 * dashboard, and the founder writes it by hand in the same session where they
 * take that action (see the manual-operations section of the handoff). An
 * `allowlist()` helper on this path would be a button the server could press on
 * behalf of a request, which is exactly the shape we are avoiding.
 *
 * The table grants nothing — Privy's allowlist is what grants. See
 * `lib/early-access/request.ts` for the full reasoning behind the vocabulary.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { EarlyAccessOutcome } from "@/lib/early-access/request";

export const WEB_EARLY_ACCESS_TABLE = "web_early_access";

export type EarlyAccessRequestInput = {
  /** Already normalized by `normalizeEarlyAccessEmail`. This module does not
   *  re-normalize: one owner for that rule, and the route is it. */
  email: string;
  /** Resolved from the deployment, never from the request body. */
  surface: "learn" | "play";
  /** Canonical acquisition source, re-sanitized by the route through the
   *  existing `normalizeSource` allow-list. Null when unattributable. */
  source: string | null;
};

export type EarlyAccessRecordResult =
  | { status: "recorded"; outcome: EarlyAccessOutcome }
  | { status: "unavailable" };

/**
 * Record a request for a key. Idempotent by construction.
 *
 * `ignoreDuplicates` issues `on conflict do nothing` against the email primary
 * key, so a second request neither creates a row nor moves `requested_at` —
 * the queue stays ordered by when somebody FIRST asked, which is the order the
 * founder works through. The `select` returns only rows actually inserted, so
 * an empty array is precisely "this email had already asked", with no second
 * round trip and no read-then-write race.
 *
 * Errors are collapsed to `unavailable`: the caller maps it to a 503 and the
 * screen tells the player to try again. A player must never see a database
 * error, and we must never fail open by pretending a lost request was saved.
 */
export async function recordEarlyAccessRequest(
  supabase: SupabaseClient,
  { email, surface, source }: EarlyAccessRequestInput,
): Promise<EarlyAccessRecordResult> {
  const { data, error } = await supabase
    .from(WEB_EARLY_ACCESS_TABLE)
    .upsert(
      // `status` is not passed: the column defaults to 'waiting' and this
      // module has no business naming any other value.
      { email, surface, source },
      { onConflict: "email", ignoreDuplicates: true },
    )
    .select("email");

  if (error) {
    return { status: "unavailable" };
  }

  return {
    status: "recorded",
    outcome: (data?.length ?? 0) > 0 ? "created" : "already-requested",
  };
}
