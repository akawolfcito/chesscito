import { extractWeaknessTags } from "./weakness-tags.js";
import { toCoachGameResult } from "./types.js";
import type {
  CoachAnalysisRow,
  CoachGameResult,
  CoachResponse,
  Mistake,
  WeaknessTag,
} from "./types.js";
import { getSupabaseServer } from "../supabase/server.js";

const ROW_SOFT_CAP = 200;

export type PersistAnalysisPayload = {
  gameId: string;
  difficulty: "easy" | "medium" | "hard";
  result: CoachGameResult;
  totalMoves: number;
  response: CoachResponse;
};

/**
 * Best-effort `extractWeaknessTags` — returns `[]` on any throw.
 *
 * Rationale: a tag-derivation throw must NOT silently drop a row that a
 * paying user generated (red-team P1-7). The row gets preserved with an
 * empty tag set; the caller is expected to log a `coach_tag_extraction_failed`
 * warning for observability when it cares.
 */
export function extractWeaknessTagsSafe(
  mistakes: Mistake[],
  totalMoves: number,
  result: CoachGameResult,
): { tags: WeaknessTag[]; error: Error | null } {
  try {
    return { tags: extractWeaknessTags(mistakes, totalMoves, result), error: null };
  } catch (err) {
    return { tags: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Insert a Coach analysis into Supabase with first-wins semantics.
 *
 * - Maps `payload.result` through `toCoachGameResult()` so the schema check
 *   `result in ('win','lose','draw','resigned')` cannot drift (§5).
 * - `upsert(rows, { onConflict: "wallet,game_id", ignoreDuplicates: true })`
 *   matches the supabase-js v2 idiom already in `lib/supabase/queries.ts`
 *   for first-wins concurrent multi-device writes (red-team P1-9).
 * - Tag derivation is fail-soft; row inserts even if extraction throws
 *   (red-team P1-7).
 * - Soft cap of 200 rows per wallet enforced post-insert (Task 4 — added
 *   by the next commit; this commit's implementation is happy-path only).
 *
 * Spec §6.1 / §15 (P1-2, P1-7, P1-9).
 */
export async function persistAnalysis(
  wallet: string,
  payload: PersistAnalysisPayload,
): Promise<void> {
  // Validate result up-front — throws on bad input (loud failure at the seam).
  const result = toCoachGameResult(payload.result);

  // Defense-in-depth: assert wallet shape at the function seam. The soft-cap
  // subquery below interpolates `wallet` verbatim into a SQL literal; an
  // upstream caller forgetting to validate would let a malformed value reach
  // the SQL string. Wallets are already lowercased upstream — keep this in
  // sync with that contract.
  if (!/^0x[0-9a-f]{40}$/.test(wallet)) {
    throw new Error(`persistAnalysis: wallet must be 0x[0-9a-f]{40} (got ${JSON.stringify(wallet)})`);
  }

  const supabase = getSupabaseServer();
  if (!supabase) return;

  const { tags } = extractWeaknessTagsSafe(payload.response.mistakes, payload.totalMoves, result);

  const row: CoachAnalysisRow = {
    wallet,
    game_id: payload.gameId,
    // created_at + expires_at are stripped before insert so the column
    // defaults (now() / now() + 1y) apply. PR 3 backfill writes them
    // explicitly per P1-6.
    created_at: "",
    expires_at: "",
    kind: "full",
    difficulty: payload.difficulty,
    result,
    total_moves: payload.totalMoves,
    summary_text: payload.response.summary,
    mistakes: payload.response.mistakes,
    lessons: payload.response.lessons,
    praise: payload.response.praise,
    weakness_tags: tags,
  };

  const { created_at: _ca, expires_at: _ea, ...insertRow } = row;

  const { error } = await supabase
    .from("coach_analyses")
    .upsert(insertRow as unknown as CoachAnalysisRow, {
      onConflict: "wallet,game_id",
      ignoreDuplicates: true,
    });

  if (error) {
    throw new Error(`persistAnalysis upsert failed: ${error.message}`);
  }

  // Soft-cap cleanup (red-team P1-2): cap any single wallet at 200 rows.
  // Rationale: 200 × ~5 KB ≈ 1 MB per wallet regardless of activity volume.
  // Fail-soft — count errors don't block; the cap re-checks on next write.
  const { count, error: countError } = await supabase
    .from("coach_analyses")
    .select("*", { count: "exact", head: true })
    .eq("wallet", wallet);

  if (countError) {
    // Fail-soft: cap re-checks on next write.
    return;
  }
  if ((count ?? 0) <= ROW_SOFT_CAP) return;

  // Delete rows where game_id is NOT in the most recent 200 for this wallet.
  // Uses Postgres-side subquery via `.not('game_id', 'in', '(...)')` —
  // supabase-js renders the third arg verbatim into the SQL.
  const subquery = `(select game_id from coach_analyses where wallet = '${wallet}' order by created_at desc limit ${ROW_SOFT_CAP})`;
  const { error: delError } = await supabase
    .from("coach_analyses")
    .delete()
    .eq("wallet", wallet)
    .not("game_id", "in", subquery);
  if (delError) {
    // Fail-soft: the cap re-checks on next write. PR 3 will add a
    // `coach_soft_cap_delete_failed` log line at this seam.
    return;
  }
}
