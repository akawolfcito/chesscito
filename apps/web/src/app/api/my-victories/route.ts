import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { getPlayerVictories } from "@/lib/server/hof";
import { enforceOrigin } from "@/lib/server/demo-signing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try { enforceOrigin(request); } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const player = request.nextUrl.searchParams.get("player");

  if (!player || !isAddress(player)) {
    return NextResponse.json(
      { error: "Missing or invalid player address" },
      { status: 400 },
    );
  }

  const rows = await getPlayerVictories(player);
  return NextResponse.json(rows);
}
