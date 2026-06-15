import {
  fetchLeaderboardFromDb,
  fetchPlayerRankFromDb,
  type LeaderboardRow as DbRow,
} from "@/lib/supabase/queries";
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
