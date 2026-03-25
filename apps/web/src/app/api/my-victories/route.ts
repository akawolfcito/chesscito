import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

import { getPlayerVictories } from "@/lib/server/hof-blockscout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const player = request.nextUrl.searchParams.get("player");

  if (!player || !isAddress(player)) {
    return NextResponse.json(
      { error: "Missing or invalid player address" },
      { status: 400 },
    );
  }

  const rows = await getPlayerVictories(player);

  return NextResponse.json(rows, {
    headers: {
      "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
    },
  });
}
