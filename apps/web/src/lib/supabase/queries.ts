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
  /** Player has at least one ON-CHAIN score (`scores` table). Appended
   *  2026-06-11 (leaderboard on-chain marker); older deployments may
   *  omit it, so consumers treat absence as false. */
  has_onchain?: boolean;
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
      .select("rank, player, total_score, is_verified, has_onchain");
    return (viewData as LeaderboardRow[]) ?? [];
  }

  return (data as LeaderboardRow[]) ?? [];
}

/**
 * Fetch the player's own combined-leaderboard row with its REAL rank
 * over the full ranking (`get_player_rank` / `leaderboard_full_v`) —
 * visible even outside the top-10 cut (QA G4 2026-06-11). Null when
 * the player has no saves yet or Supabase is unconfigured.
 */
export async function fetchPlayerRankFromDb(
  player: string,
): Promise<LeaderboardRow | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_player_rank", {
    p_player: player.toLowerCase(),
  });

  if (error) {
    // Same divergence rule as fetchLeaderboardFromDb: the fallback
    // reads the SAME view the RPC reads.
    const { data: viewData } = await supabase
      .from("leaderboard_full_v")
      .select("rank, player, total_score, is_verified, has_onchain")
      .eq("player", player.toLowerCase())
      .limit(1);
    return ((viewData as LeaderboardRow[]) ?? [])[0] ?? null;
  }

  return ((data as LeaderboardRow[]) ?? [])[0] ?? null;
}

/**
 * How many players are RANKED, all-time — the population, not the board.
 *
 * Counts `leaderboard_full_v`, the uncut relation `get_player_rank` ranks over,
 * so the number the hero shows and the rank the footer shows come from the same
 * set. `leaderboard_combined_v` is the top-10 cut and would answer 10 forever.
 *
 * `head: true` means PostgREST returns the count in a header and transfers no
 * rows, so this stays cheap as the population grows.
 *
 * NULL IS "UNKNOWN", DELIBERATELY, AND IT IS NOT ZERO. The caller must omit the
 * figure rather than substitute one: `rows.length` is the defect this replaces
 * (it announced "10 players" to a player ranked 13th), and 0 would claim an
 * empty board over a visibly populated one.
 */
export async function fetchLeaderboardTotalFromDb(): Promise<number | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { count, error } = await supabase
    .from("leaderboard_full_v")
    .select("player", { count: "exact", head: true });

  if (error) return null;
  return count ?? null;
}

/**
 * How many wallets are ranked THIS WEEK on ONE surface.
 *
 * The surface filter is load-bearing: `leaderboard_weekly_full_v` cross-joins
 * learn and play, so an unfiltered count merges the two products into a single
 * population while every score-shaped assertion still passes.
 *
 * TAKES NO WINDOW, BECAUSE THE VIEW HAS NONE TO TAKE. It always computes the
 * CURRENT UTC week (see the migration header), which is the same week the
 * endpoint asks the RPCs for. The one seam: a request that crosses Monday
 * 00:00 UTC between the ranking query and this one gets the new week's count
 * over the old week's rows. It self-corrects on the next fetch, and the
 * alternative — a counting RPC that takes the window — is a migration this fix
 * deliberately does not need. If a "past weeks" board ever ships, this stops
 * being adequate and must take the window.
 */
export async function fetchWeeklyLeaderboardTotalFromDb(
  surface: string,
): Promise<number | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const { count, error } = await supabase
    .from("leaderboard_weekly_full_v")
    .select("wallet", { count: "exact", head: true })
    .eq("surface", surface);

  if (error) return null;
  return count ?? null;
}

/**
 * A row of the WEEKLY ranking (Slice 2A).
 *
 * Not `LeaderboardRow`, and the difference is not cosmetic:
 *   - the identity column is `wallet` (the name `score_attempts` uses), not
 *     `player` (the name the on-chain `scores` union uses);
 *   - there is no `has_onchain`, because the weekly board reads no on-chain
 *     source. Absent, not false — see the migration header.
 */
export type WeeklyLeaderboardRow = {
  rank: number;
  wallet: string;
  total_score: number;
  is_verified: boolean;
};

/** The weekly RPCs take the window as ISO strings; one place to build them. */
function weeklyArgs(surface: string, weekStart: Date, weekEnd: Date) {
  return {
    p_surface: surface,
    p_week_start: weekStart.toISOString(),
    p_week_end: weekEnd.toISOString(),
  };
}

/**
 * The weekly board, cut at 10 by the RPC.
 *
 * The fallback reads `leaderboard_weekly_full_v` filtered by the SAME surface,
 * for the same reason the all-time fallback reads the same view the RPC reads:
 * two paths that can disagree eventually will. Dropping the surface filter here
 * would merge Learn and Play into one board while every other assertion still
 * passed.
 */
export async function fetchWeeklyLeaderboardFromDb(
  surface: string,
  weekStart: Date,
  weekEnd: Date,
): Promise<WeeklyLeaderboardRow[]> {
  const supabase = getSupabaseServer();
  if (!supabase) return [];

  const { data, error } = await supabase.rpc(
    "get_weekly_leaderboard",
    weeklyArgs(surface, weekStart, weekEnd),
  );

  if (error) {
    const { data: viewData } = await supabase
      .from("leaderboard_weekly_full_v")
      .select("rank, wallet, total_score, is_verified")
      .eq("surface", surface)
      .order("rank", { ascending: true })
      .limit(10);
    return (viewData as WeeklyLeaderboardRow[]) ?? [];
  }

  return (data as WeeklyLeaderboardRow[]) ?? [];
}

/**
 * The caller's own weekly row, ranked over the UNCUT set so rank 11+ is visible
 * in the footer while absent from the board.
 *
 * `player` is lowercased HERE, at the boundary closest to SQL, mirroring
 * `fetchPlayerRankFromDb`. `score_attempts.wallet` is check-constrained to
 * lowercase hex, so a checksummed address — which is what wagmi hands the
 * client — matches zero rows and returns null. Null is a SPECIFIED, valid state
 * on the weekly board ("you have not played this week"), so that bug renders a
 * friendly call to action instead of an error, and no fixture would catch it:
 * the constraint forces test rows lowercase.
 */
export async function fetchWeeklyPlayerRankFromDb(
  player: string,
  surface: string,
  weekStart: Date,
  weekEnd: Date,
): Promise<WeeklyLeaderboardRow | null> {
  const supabase = getSupabaseServer();
  if (!supabase) return null;

  const wallet = player.toLowerCase();

  const { data, error } = await supabase.rpc("get_weekly_player_rank", {
    p_player: wallet,
    ...weeklyArgs(surface, weekStart, weekEnd),
  });

  if (error) {
    const { data: viewData } = await supabase
      .from("leaderboard_weekly_full_v")
      .select("rank, wallet, total_score, is_verified")
      .eq("surface", surface)
      .eq("wallet", wallet)
      .limit(1);
    return ((viewData as WeeklyLeaderboardRow[]) ?? [])[0] ?? null;
  }

  return ((data as WeeklyLeaderboardRow[]) ?? [])[0] ?? null;
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
