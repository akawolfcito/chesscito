import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";
import { insertScore } from "@/lib/supabase/queries";
import { enforceOrigin } from "@/lib/server/demo-signing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    enforceOrigin(request);

    const body = (await request.json()) as {
      player?: string;
      levelId?: number;
      score?: number;
      timeMs?: number;
      txHash?: string;
    };

    const { player, levelId, score, timeMs, txHash } = body;

    if (!player || !isAddress(player)) {
      return NextResponse.json({ error: "Invalid player address" }, { status: 400 });
    }
    if (typeof levelId !== "number" || levelId < 1 || levelId > 6) {
      return NextResponse.json({ error: "Invalid levelId" }, { status: 400 });
    }
    if (typeof score !== "number" || score <= 0) {
      return NextResponse.json({ error: "Invalid score" }, { status: 400 });
    }
    if (typeof timeMs !== "number" || timeMs <= 0) {
      return NextResponse.json({ error: "Invalid timeMs" }, { status: 400 });
    }
    if (!txHash || !txHash.startsWith("0x")) {
      return NextResponse.json({ error: "Invalid txHash" }, { status: 400 });
    }

    await insertScore({
      player: player.toLowerCase(),
      level_id: levelId,
      score,
      time_ms: timeMs,
      tx_hash: txHash,
    });

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not cache score";
    const status = message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
