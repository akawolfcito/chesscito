import { NextResponse } from "next/server";
import { fetchLeaderboard, fetchPlayerRank } from "@/lib/server/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type { LeaderboardRow } from "@/lib/server/leaderboard";

/**
 * GET /api/leaderboard            → LeaderboardRow[] (legacy shape)
 * GET /api/leaderboard?player=0x… → { rows, player } where `player` is
 *   the caller's own row with its REAL rank over the full ranking
 *   (QA G4 2026-06-11), or null when they have no saves yet.
 */
export async function GET(request: Request) {
  try {
    const player = new URL(request.url).searchParams.get("player");
    const rows = await fetchLeaderboard();
    if (!player) {
      return NextResponse.json(rows);
    }
    const own = await fetchPlayerRank(player);
    return NextResponse.json({ rows, player: own });
  } catch (err) {
    console.error("[leaderboard] error:", err);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
