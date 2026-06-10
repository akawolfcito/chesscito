import { getSupabaseServer } from "./server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScoreRow = {
  player: string;
  level_id: number;
  score: number;
  time_ms: number;
  tx_hash: string;
};

export type VictoryRow = {
  token_id: number;
  player: string;
  difficulty: number;
  total_moves: number;
  time_ms: number;
  tx_hash: string;
  minted_at: string;
};

export type LeaderboardRow = {
  rank: number;
  player: string;
  total_score: number;
  is_verified: boolean;
};

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/**
 * Insert a score row. Duplicate tx_hash is silently ignored (client-submitted).
 */
export async function insertScore(row: ScoreRow): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;

  await supabase.from("scores").upsert(
    { ...row, player: row.player.toLowerCase() },
    { onConflict: "tx_hash", ignoreDuplicates: true }
  );
}

/**
 * Insert a victory row. Duplicate tx_hash is silently ignored (client-submitted).
 */
export async function insertVictory(row: VictoryRow): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;

  await supabase.from("victories").upsert(
    { ...row, player: row.player.toLowerCase() },
    { onConflict: "tx_hash", ignoreDuplicates: true }
  );
}

/**
 * Upsert a score row with full overwrite semantics (cron / authoritative sync).
 * Does NOT use ignoreDuplicates so the cron can correct on-chain data.
 */
export async function upsertScoreAuthoritative(row: ScoreRow): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;

  await supabase
    .from("scores")
    .upsert(
      { ...row, player: row.player.toLowerCase() },
      { onConflict: "tx_hash" }
    );
}

/**
 * Upsert a victory row with full overwrite semantics (cron / authoritative sync).
 * Does NOT use ignoreDuplicates so the cron can correct on-chain data.
 */
export async function upsertVictoryAuthoritative(
  row: VictoryRow
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;

  await supabase
    .from("victories")
    .upsert(
      { ...row, player: row.player.toLowerCase() },
      { onConflict: "tx_hash" }
    );
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Fetch the full leaderboard from the `leaderboard_combined_v` view
 * (legacy on-chain `scores` + off-chain `score_saves`).
 */
export async function fetchLeaderboardFromDb(): Promise<LeaderboardRow[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  // Use RPC to query the view — more reliable than direct view access
  // which can fail if PostgREST schema cache is stale
  const { data, error } = await supabase.rpc("get_leaderboard");

  if (error) {
    // Fallback: direct view access. Must hit the SAME source the RPC
    // reads (`leaderboard_combined_v`) so the two never diverge
    // (Slice 4 — P1 leaderboard-view-undefined).
    const { data: viewData } = await supabase
      .from("leaderboard_combined_v")
      .select("rank, player, total_score, is_verified");
    return (viewData as LeaderboardRow[]) ?? [];
  }

  return (data as LeaderboardRow[]) ?? [];
}

/**
 * Fetch the 10 most recent victory mints (Hall of Fame).
 */
export async function fetchHallOfFame(): Promise<VictoryRow[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data } = await supabase
    .from("victories")
    .select("token_id, player, difficulty, total_moves, time_ms, tx_hash, minted_at")
    .order("minted_at", { ascending: false })
    .limit(10);

  return (data as VictoryRow[]) ?? [];
}

/**
 * Fetch all victories for a specific player address (normalized to lowercase).
 */
export async function fetchPlayerVictories(
  player: string
): Promise<VictoryRow[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data } = await supabase
    .from("victories")
    .select("token_id, player, difficulty, total_moves, time_ms, tx_hash, minted_at")
    .eq("player", player.toLowerCase());

  return (data as VictoryRow[]) ?? [];
}

// ---------------------------------------------------------------------------
// Sync state
// ---------------------------------------------------------------------------

/**
 * Get a single sync state value by key.
 */
export async function getSyncState(key: string): Promise<string | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data } = await supabase
    .from("sync_state")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  return (data as { value: string } | null)?.value ?? null;
}

/**
 * Upsert a sync state key/value pair.
 */
export async function setSyncState(key: string, value: string): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;

  await supabase
    .from("sync_state")
    .upsert({ key, value }, { onConflict: "key" });
}

// ---------------------------------------------------------------------------
// Passport cache
// ---------------------------------------------------------------------------

/**
 * Bulk upsert passport verification status for a list of player addresses.
 * Player addresses are normalized to lowercase.
 */
export async function upsertPassportCache(
  entries: { player: string; is_verified: boolean }[]
): Promise<void> {
  const supabase = getSupabaseServer();
  if (!supabase) return;

  const normalized = entries.map((e) => ({
    ...e,
    player: e.player.toLowerCase(),
  }));

  await supabase
    .from("passport_cache")
    .upsert(normalized, { onConflict: "player" });
}

// ---------------------------------------------------------------------------
// Profile stats aggregate
// ---------------------------------------------------------------------------

export type ProfileStats = {
  trophies: number;
  arenaWins: number;
  nftsMinted: number;
  dailyStreak: number;
  puzzlesSolved: number;
};

/**
 * Aggregate stats for the Profile modal. Each field defaults to 0 on a
 * per-source failure so a single bad query never blanks the profile.
 *
 * Composition:
 * - `arenaWins`, `nftsMinted` — derived from `fetchPlayerVictories` (one
 *   row per victory mint; counts coincide for v1).
 * - `trophies`, `dailyStreak`, `puzzlesSolved` — client-side surfaces
 *   (badges read on-chain, daily streak + puzzle counters live in
 *   localStorage); defaulted server-side to 0 and overridden client-side
 *   by the consuming hook when those sources are available.
 */
export async function getProfileStats(
  address: `0x${string}` | string
): Promise<ProfileStats> {
  const player = address.toLowerCase();

  let arenaWins = 0;
  let nftsMinted = 0;
  try {
    const rows = await fetchPlayerVictories(player);
    arenaWins = rows.length;
    nftsMinted = rows.length;
  } catch {
    arenaWins = 0;
    nftsMinted = 0;
  }

  // client-side, defaulted server-side to 0 (on-chain badges)
  const trophies = 0;
  // client-side, defaulted server-side to 0 (localStorage streak)
  const dailyStreak = 0;
  // client-side, defaulted server-side to 0 (localStorage puzzle counters)
  const puzzlesSolved = 0;

  return { trophies, arenaWins, nftsMinted, dailyStreak, puzzlesSolved };
}
