import { NextResponse } from "next/server";

import { fetchLeaderboard } from "@/lib/server/leaderboard";

export const runtime = "nodejs";

export type { LeaderboardRow } from "@/lib/server/leaderboard";

export async function GET() {
  try {
    const rows = await fetchLeaderboard();
    return NextResponse.json(rows, {
      headers: { "Cache-Control": "s-maxage=60, stale-while-revalidate=120" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch leaderboard";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
