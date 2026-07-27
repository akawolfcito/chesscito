/**
 * The purchased Season Pass row, read the same way everywhere.
 *
 * Two routes need it now (status and focus-day) and they must agree on what
 * "no pass" means, because one of them writes progress attributed to the
 * season this row carries. A second copy of this query is a second chance to
 * disagree.
 */

import type { SupabaseServer } from "./focus-ledger-init";

export type SeasonPassRow = {
  expires_at: string;
  season_id: string;
  supporter_status: string | null;
  shields_credited: number | null;
};

/** `unavailable` is not `row: null`. One means the wallet has no pass; the
 *  other means we could not find out, and they must never collapse. */
export type SeasonPassRowRead =
  | { status: "ok"; row: SeasonPassRow | null }
  | { status: "unavailable"; code?: string };

export async function readSeasonPassRow(
  supabase: SupabaseServer,
  wallet: string,
): Promise<SeasonPassRowRead> {
  try {
    const { data, error } = await supabase
      .from("lite_season_passes")
      .select("expires_at, season_id, supporter_status, shields_credited")
      .eq("wallet", wallet)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return { status: "unavailable", code: error.code };
    return { status: "ok", row: (data as SeasonPassRow | null) ?? null };
  } catch (e) {
    return { status: "unavailable", code: String(e) };
  }
}
