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

    const body = (await request.json()) as { player?: string; levelId?: number };
    const player = parseAddress(body.player);
    await enforceRateLimit(getRequestIp(request), player, "/api/sign-badge");
    const levelId = parseInteger(body.levelId, "levelId", 1, 10_000);
    const nonce = createNonce();
    const deadline = createDeadline();
    const { chainId, badgesAddress, signer } = getDemoConfig();

    const signature = await signer.signTypedData(
      {
        name: "Badges",
        version: "1",
        chainId,
        verifyingContract: badgesAddress,
      },
      {
        BadgeClaim: [
          { name: "player", type: "address" },
          { name: "levelId", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        player,
        levelId,
        nonce,
        deadline,
      }
    );

    return NextResponse.json({
      player,
      levelId: levelId.toString(),
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sign badge claim";
    const status = message === "Rate limit exceeded" ? 429 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
