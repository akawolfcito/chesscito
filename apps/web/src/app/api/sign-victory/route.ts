import { NextResponse } from "next/server";

import {
  createDeadline,
  createNonce,
  enforceOrigin,
  enforceRateLimit,
  getDemoConfig,
  getRequestIp,
  parseAddress,
  parseInteger,
} from "@/lib/server/demo-signing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    enforceOrigin(request);

    const body = (await request.json()) as {
      player?: string;
      difficulty?: number;
      totalMoves?: number;
      timeMs?: number;
    };

    const player = parseAddress(body.player);
    enforceRateLimit(getRequestIp(request), player);

    const difficulty = parseInteger(body.difficulty, "difficulty", 1, 3);
    const totalMoves = parseInteger(body.totalMoves, "totalMoves", 1, 10_000);
    const timeMs = parseInteger(body.timeMs, "timeMs", 1, 3_600_000);

    const nonce = createNonce();
    const deadline = createDeadline();
    const { chainId, victoryNFTAddress, signer } = getDemoConfig();

    const signature = await signer.signTypedData(
      {
        name: "VictoryNFT",
        version: "1",
        chainId,
        verifyingContract: victoryNFTAddress,
      },
      {
        VictoryMint: [
          { name: "player", type: "address" },
          { name: "difficulty", type: "uint8" },
          { name: "totalMoves", type: "uint16" },
          { name: "timeMs", type: "uint32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        player,
        difficulty,
        totalMoves,
        timeMs,
        nonce,
        deadline,
      }
    );

    return NextResponse.json({
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sign victory claim";
    const status = message === "Rate limit exceeded" ? 429 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
