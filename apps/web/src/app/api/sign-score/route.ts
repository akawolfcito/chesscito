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
      levelId?: number;
      score?: number;
      timeMs?: number;
    };
    const player = parseAddress(body.player);
    await enforceRateLimit(getRequestIp(request), player);

    const levelId = parseInteger(body.levelId, "levelId", 1, 10_000);
    // Max score: 15 stars × 100 pts = 1500 per piece level
    const score = parseInteger(body.score, "score", 0, 1_500);
    const timeMs = parseInteger(body.timeMs, "timeMs", 1, 3_600_000);
    const nonce = createNonce();
    const deadline = createDeadline();
    const { chainId, scoreboardAddress, signer } = getDemoConfig();

    const signature = await signer.signTypedData(
      {
        name: "Scoreboard",
        version: "1",
        chainId,
        verifyingContract: scoreboardAddress,
      },
      {
        ScoreSubmission: [
          { name: "player", type: "address" },
          { name: "levelId", type: "uint256" },
          { name: "score", type: "uint256" },
          { name: "timeMs", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        player,
        levelId,
        score,
        timeMs,
        nonce,
        deadline,
      }
    );

    return NextResponse.json({
      player,
      levelId: levelId.toString(),
      score: score.toString(),
      timeMs: timeMs.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sign score submission";
    const status = message === "Rate limit exceeded" ? 429 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
