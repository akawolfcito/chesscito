import {
  fetchLeaderboardFromDb,
  fetchPlayerRankFromDb,
  fetchWeeklyLeaderboardFromDb,
  fetchWeeklyPlayerRankFromDb,
  type LeaderboardRow as DbRow,
  type WeeklyLeaderboardRow as WeeklyDbRow,
} from "@/lib/supabase/queries";
import type { WeekWindow } from "@/lib/leaderboard/week-window";
import type { ScoreSaveSurface } from "@/lib/scores/save-authorization";
import {
  deriveAvatarVariant,
  deriveRowId,
  type AvatarVariant,
} from "@/lib/identity/identity-lite";
import { truncateWallet } from "@/lib/profile/display-name";

export type LeaderboardRow = {
  rank: number;
  /** Opaque dedupe key (deriveRowId) — NOT a wallet. */
  rowId: string;
  /** Server-derived from the FULL wallet; client formats nickname + avatar. */
  variant: AvatarVariant;
  score: number;
  isVerified?: boolean;
  /** Player has at least one on-chain score (Scoreboard contract). */
  hasOnchain?: boolean;
  /** ONLY on the caller's own row: their truncated address (they already know
   *  it). Foreign rows never carry it — wallets do not leave the server. */
  walletShort?: string;
};

function toApiRow(r: DbRow, opts: { own?: boolean } = {}): LeaderboardRow {
  const wallet = r.player.toLowerCase();
  const row: LeaderboardRow = {
    rank: r.rank,
    rowId: deriveRowId(wallet),
    variant: deriveAvatarVariant(wallet),
    score: r.total_score,
    isVerified: r.is_verified,
    hasOnchain: r.has_onchain ?? false,
  };
  if (opts.own) {
    row.walletShort = truncateWallet(wallet as `0x${string}`);
  }
  return row;
}

export async function fetchLeaderboard(): Promise<LeaderboardRow[]> {
  const rows = await fetchLeaderboardFromDb();
  return rows.map((r) => toApiRow(r));
}

/** The caller's own row with its real rank over the FULL ranking —
 *  visible even outside the top-10 cut (QA G4 2026-06-11). Carries
 *  `walletShort` since the caller already knows their own address. */
export async function fetchPlayerRank(
  player: string,
): Promise<LeaderboardRow | null> {
  const row = await fetchPlayerRankFromDb(player);
  return row ? toApiRow(row, { own: true }) : null;
}

// ---------------------------------------------------------------------------
// Weekly (Slice 2B)
// ---------------------------------------------------------------------------

/** Which ranking a request wants. Absent = "alltime": the pre-Slice-2
 *  endpoint had no param and returned the all-time board. */
export type LeaderboardWindow = "weekly" | "alltime";

export type LeaderboardResponse = {
  window: LeaderboardWindow;
  /** Top 10, matching the all-time cut. */
  rows: LeaderboardRow[];
  /** The caller's own row, ranked over the UNCUT set. Null when they have no
   *  rows IN THIS WINDOW — on weekly that is the ordinary state for someone
   *  who has not played since Monday, not an error and not a zero. */
  player: LeaderboardRow | null;
  /** Weekly only. ISO 8601 UTC — lets the client label the window and notice a
   *  rollover without re-deriving the week itself. */
  weekStart?: string;
  weekEnd?: string;
  /** Weekly only. Echoed so the client can refuse to render the other
   *  product's board if the deployment env ever drifts. */
  surface?: ScoreSaveSurface;
};

/**
 * The weekly mapper. NOT `toApiRow`, for two independent reasons:
 *
 *  1. `toApiRow` writes `hasOnchain: r.has_onchain ?? false`. A weekly row has
 *     no such column, so the coalesce would emit a PRESENT field asserting
 *     "this player has no on-chain score" — exactly the claim the off-chain
 *     asymmetry forbids. And `false` passes every falsy assertion, so the
 *     obvious test would not catch it.
 *  2. It reads `r.player`, while the weekly relation returns `wallet`. A silent
 *     `undefined` would flow into `deriveRowId`.
 */
function toWeeklyApiRow(
  r: WeeklyDbRow,
  opts: { own?: boolean } = {},
): LeaderboardRow {
  const wallet = r.wallet.toLowerCase();
  const row: LeaderboardRow = {
    rank: r.rank,
    rowId: deriveRowId(wallet),
    variant: deriveAvatarVariant(wallet),
    score: r.total_score,
    isVerified: r.is_verified,
  };
  if (opts.own) {
    row.walletShort = truncateWallet(wallet as `0x${string}`);
  }
  return row;
}

/** The weekly board for ONE surface. The caller resolves the surface — this
 *  never reads the env, so a test can ask for either product. */
export async function fetchWeeklyLeaderboard(
  surface: ScoreSaveSurface,
  window: WeekWindow,
): Promise<LeaderboardRow[]> {
  const rows = await fetchWeeklyLeaderboardFromDb(
    surface,
    window.start,
    window.end,
  );
  return rows.map((r) => toWeeklyApiRow(r));
}

/** The caller's own weekly row. `player` may arrive checksummed; the query
 *  layer lowercases it before it reaches a column that only stores lowercase. */
export async function fetchWeeklyPlayerRank(
  player: string,
  surface: ScoreSaveSurface,
  window: WeekWindow,
): Promise<LeaderboardRow | null> {
  const row = await fetchWeeklyPlayerRankFromDb(
    player,
    surface,
    window.start,
    window.end,
  );
  return row ? toWeeklyApiRow(row, { own: true }) : null;
}
