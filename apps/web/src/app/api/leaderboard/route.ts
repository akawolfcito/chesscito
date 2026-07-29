import { NextResponse } from "next/server";
import {
  fetchLeaderboard,
  fetchPlayerRank,
  fetchWeeklyLeaderboard,
  fetchWeeklyPlayerRank,
  type LeaderboardResponse,
} from "@/lib/server/leaderboard";
import { currentWeekWindow } from "@/lib/leaderboard/week-window";
import { requireDeploymentSurface } from "@/lib/scores/deployment-surface";

export const runtime = "nodejs";

/** Must stay force-dynamic: a CDN-cached weekly board would keep serving last
 *  week's ranking after the Monday reset. */
export const dynamic = "force-dynamic";

export type { LeaderboardRow } from "@/lib/server/leaderboard";

/**
 * GET /api/leaderboard            → LeaderboardRow[] (legacy shape)
 * GET /api/leaderboard?player=0x… → { rows, player } where `player` is
 *   the caller's own row with its REAL rank over the full ranking
 *   (QA G4 2026-06-11), or null when they have no saves yet.
 *
 * GET /api/leaderboard?window=weekly|alltime[&player=0x…] → LeaderboardResponse
 *   (Slice 2B). Anything else in `window`, including the empty string, is a 400.
 *
 * THE TWO LEGACY SHAPES ARE FROZEN. A client that never sends `window` cannot
 * tell Slice 2 shipped — that is asserted, not assumed, by the first tests in
 * this route's spec file.
 *
 * NO `surface` PARAMETER, deliberately: the weekly board is surface-scoped
 * (parent D2) and a value the client picks is a value the client can lie about.
 *
 * THE FEATURE FLAG IS NOT READ HERE. `NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED` gates
 * the sheet, not the endpoint (parent D4), so the board can be smoke-tested in
 * production before any player sees it.
 */
export async function GET(request: Request) {
  // Named `search`, not `params`: this is the query string, not a dynamic
  // route's `params` prop, and tooling that pattern-matches the name keeps
  // mistaking one for the other.
  const search = new URL(request.url).searchParams;
  const player = search.get("player");
  const windowParam = search.get("window");

  // Absent is null (legacy); empty string is a client bug. Falling back to
  // all-time on an unknown value would hide a typo behind a plausible board.
  if (
    windowParam !== null &&
    windowParam !== "weekly" &&
    windowParam !== "alltime"
  ) {
    return NextResponse.json({ error: "Unknown window" }, { status: 400 });
  }

  try {
    if (windowParam === null) {
      const rows = await fetchLeaderboard();
      if (!player) {
        return NextResponse.json(rows);
      }
      const own = await fetchPlayerRank(player);
      return NextResponse.json({ rows, player: own });
    }

    if (windowParam === "alltime") {
      const rows = await fetchLeaderboard();
      const own = player ? await fetchPlayerRank(player) : null;
      return NextResponse.json({
        window: "alltime",
        rows,
        player: own,
      } satisfies LeaderboardResponse);
    }

    // Weekly. `requireDeploymentSurface` is resolved HERE, inside this branch,
    // and never at the top of the handler: an unset mode must not turn the
    // legacy responses above into 500s.
    const surface = requireDeploymentSurface();
    const window = currentWeekWindow(new Date());
    const rows = await fetchWeeklyLeaderboard(surface, window);
    const own = player
      ? await fetchWeeklyPlayerRank(player, surface, window)
      : null;

    return NextResponse.json({
      window: "weekly",
      rows,
      player: own,
      weekStart: window.start.toISOString(),
      weekEnd: window.end.toISOString(),
      surface,
    } satisfies LeaderboardResponse);
  } catch (err) {
    console.error("[leaderboard] error:", err);
    return NextResponse.json({ error: "Failed to fetch leaderboard" }, { status: 500 });
  }
}
