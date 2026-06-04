import { NextResponse } from "next/server";
import { ethers } from "ethers";

import {
  createDeadline,
  createNonce,
  enforceOrigin,
  enforceRateLimit,
  getDemoConfig,
  getLabyrinthBadgesAddress,
  getRequestIp,
  parseAddress,
} from "@/lib/server/demo-signing";
import { LABYRINTHS, labyrinthStars } from "@/lib/game/exercises";
import { resolveLabyrinthMintPolicy } from "@/lib/game/labyrinth-mint-policy";
import type { Exercise } from "@/lib/game/types";

export const runtime = "nodejs";

function findLabyrinth(labyrinthId: unknown): Exercise | null {
  if (typeof labyrinthId !== "string" || labyrinthId.length === 0) return null;
  for (const list of Object.values(LABYRINTHS)) {
    for (const ex of list) {
      if (ex.id === labyrinthId) return ex;
    }
  }
  return null;
}

export async function POST(request: Request) {
  try {
    enforceOrigin(request);

    const body = (await request.json()) as {
      player?: string;
      labyrinthId?: string;
      moves?: number;
      campaignId?: string;
    };

    const player = parseAddress(body.player);
    await enforceRateLimit(getRequestIp(request), player);

    const exercise = findLabyrinth(body.labyrinthId);
    if (!exercise) {
      throw new Error("Invalid labyrinthId");
    }
    const labyrinthId = exercise.id;
    const optimal = exercise.optimalMoves;

    const moves = body.moves;
    if (
      typeof moves !== "number"
      || !Number.isInteger(moves)
      || moves < optimal
      || moves > optimal * 5
    ) {
      throw new Error("Invalid moves");
    }

    const stars = labyrinthStars(moves, optimal);
    const policy = resolveLabyrinthMintPolicy(exercise);

    if (!policy.mintable) {
      throw new Error("Labyrinth is not mintable");
    }
    if (stars < policy.minStarsToMint) {
      throw new Error("Stars below mint threshold");
    }

    let campaignId: string | null = null;
    if (typeof body.campaignId === "string" && body.campaignId.length > 0) {
      if (policy.campaignId === null || policy.campaignId !== body.campaignId) {
        throw new Error("Invalid campaignId");
      }
      // TODO(phase-D): validate campaign window (open/close deadlines).
      campaignId = body.campaignId;
    }

    const nonce = createNonce();
    const deadline = createDeadline();
    const { chainId, signer } = getDemoConfig();
    const labyrinthBadgesAddress = getLabyrinthBadgesAddress();

    const verifyingContract = labyrinthBadgesAddress;

    const labyrinthIdHash = ethers.id(labyrinthId);
    const campaignIdHash = campaignId ? ethers.id(campaignId) : ethers.ZeroHash;

    const signature = await signer.signTypedData(
      {
        name: "LabyrinthBadges",
        version: "1",
        chainId,
        verifyingContract,
      },
      {
        LabyrinthMint: [
          { name: "player", type: "address" },
          { name: "labyrinthId", type: "bytes32" },
          { name: "moves", type: "uint256" },
          { name: "stars", type: "uint256" },
          { name: "campaignId", type: "bytes32" },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" },
        ],
      },
      {
        player,
        labyrinthId: labyrinthIdHash,
        moves: BigInt(moves),
        stars: BigInt(stars),
        campaignId: campaignIdHash,
        nonce,
        deadline,
      },
    );

    return NextResponse.json({
      player,
      labyrinthId,
      moves: moves.toString(),
      stars,
      campaignId,
      nonce: nonce.toString(),
      deadline: deadline.toString(),
      signature,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not sign labyrinth claim";
    const status =
      message === "Rate limit exceeded" ? 429 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
