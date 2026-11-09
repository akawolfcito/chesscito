import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { insertVictory } from "@/lib/supabase/queries";
import { enforceOrigin } from "@/lib/server/demo-signing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    enforceOrigin(request);

    const body = (await request.json()) as {
      player?: string;
      tokenId?: string;
      difficulty?: number;
      totalMoves?: number;
      timeMs?: number;
      txHash?: string;
    };

    const { player, tokenId, difficulty, totalMoves, timeMs, txHash } = body;

    if (!player || !isAddress(player)) {
      return NextResponse.json({ error: "Invalid player address" }, { status: 400 });
    }
    if (!tokenId || typeof tokenId !== "string" || !tokenId.length) {
      return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
    }
    if (typeof difficulty !== "number" || difficulty < 1 || difficulty > 3) {
      return NextResponse.json({ error: "Invalid difficulty" }, { status: 400 });
    }
    if (typeof totalMoves !== "number" || totalMoves <= 0) {
      return NextResponse.json({ error: "Invalid totalMoves" }, { status: 400 });
    }
    if (typeof timeMs !== "number" || timeMs <= 0) {
      return NextResponse.json({ error: "Invalid timeMs" }, { status: 400 });
    }
    if (!txHash || !txHash.startsWith("0x")) {
      return NextResponse.json({ error: "Invalid txHash" }, { status: 400 });
    }

    await insertVictory({
      player: player.toLowerCase(),
      token_id: Number(tokenId),
      difficulty,
      total_moves: totalMoves,
      time_ms: timeMs,
      tx_hash: txHash,
      minted_at: new Date().toISOString(),
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cache victory";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
