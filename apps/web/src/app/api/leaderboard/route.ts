import { NextResponse } from "next/server";
import { fetchLeaderboard } from "@/lib/server/leaderboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type { LeaderboardRow } from "@/lib/server/leaderboard";

export async function GET() {
  try {
    const rows = await fetchLeaderboard();
    return NextResponse.json(rows);
  } catch {
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
