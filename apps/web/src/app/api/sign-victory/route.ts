import { NextResponse } from "next/server";
import { Chess } from "chess.js";

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

/** Hard cap on the SAN transcript. A normal Arena game finishes well
 *  under 200 ply; 300 leaves headroom for shuffling endgames without
 *  letting an attacker burn CPU on a multi-thousand-move payload. */
const MAX_MOVE_HISTORY = 300;
/** Conservative SAN upper bound — castling ("O-O-O") fits in 5,
 *  promotion + capture + check ("exd8=Q+") in 8. 12 is generous. */
const MAX_SAN_LENGTH = 12;

function parseMoveHistory(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new Error("moveHistory must be an array");
  }
  if (raw.length < 1) {
    throw new Error("moveHistory must contain at least one move");
  }
  if (raw.length > MAX_MOVE_HISTORY) {
    throw new Error(`moveHistory exceeds ${MAX_MOVE_HISTORY} moves`);
  }
  for (const move of raw) {
    if (typeof move !== "string" || move.length === 0 || move.length > MAX_SAN_LENGTH) {
      throw new Error("Invalid SAN move in moveHistory");
    }
  }
  return raw as string[];
}

function parsePlayerColor(raw: unknown): "w" | "b" {
  if (raw === "w" || raw === "b") return raw;
  throw new Error("playerColor must be 'w' or 'b'");
}

/** Replays the SAN transcript from the standard starting position and
 *  asserts a checkmate delivered by `playerColor`. Returns the move
 *  count derived from the verified array — never trust the client's
 *  totalMoves. Throws on any illegal move, non-mate ending, or mate
 *  delivered by the wrong side. */
function replayAndValidate(moveHistory: string[], playerColor: "w" | "b"): number {
  const chess = new Chess();
  for (const san of moveHistory) {
    try {
      chess.move(san);
    } catch {
      throw new Error("Illegal move in transcript");
    }
  }
  if (!chess.isCheckmate()) {
    throw new Error("Transcript does not end in checkmate");
  }
  const opponentColor = playerColor === "w" ? "b" : "w";
  if (chess.turn() !== opponentColor) {
    throw new Error("Player did not deliver the mating move");
  }
  return moveHistory.length;
}

export async function POST(request: Request) {
  try {
    enforceOrigin(request);

    const body = (await request.json()) as {
      player?: string;
      difficulty?: number;
      moveHistory?: unknown;
      playerColor?: unknown;
      timeMs?: number;
    };

    const player = parseAddress(body.player);
    await enforceRateLimit(getRequestIp(request), player);

    const difficulty = parseInteger(body.difficulty, "difficulty", 1, 3);
    const timeMs = parseInteger(body.timeMs, "timeMs", 1, 3_600_000);
    const moveHistory = parseMoveHistory(body.moveHistory);
    const playerColor = parsePlayerColor(body.playerColor);

    const derivedTotalMoves = replayAndValidate(moveHistory, playerColor);
    const totalMoves = parseInteger(derivedTotalMoves, "totalMoves", 1, 10_000);

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
      totalMoves: totalMoves.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not sign victory claim";
    const status = message === "Rate limit exceeded" ? 429 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
