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
/** F8 anti-cheat heuristic #1 — minimum plausible ms per move. A real game
 *  can't be played faster than this; a hand-crafted transcript submitted in
 *  one shot would report a tiny timeMs for many moves. Generous floor so
 *  legitimate fast games are never rejected (tune against real arena data). */
const MIN_MS_PER_MOVE = 250;

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

/** Replays the SAN transcript from the standard starting position to assert
 *  the moves are LEGAL chess, and returns the server-derived move count —
 *  never trust the client's totalMoves. Throws only on an illegal move.
 *
 *  F8 (2026-06-14): the checkmate / mate-by-player asserts were removed so
 *  ANY outcome (win/draw/lose/resign) can be saved as a collectible — the
 *  VictoryNFT contract encodes no result, and forging buys only vanity (no
 *  reward is tied to the token). Anti-cheat posture is "legal submitted game"
 *  + the timing heuristic in POST. See spec
 *  docs/superpowers/specs/2026-06-14-save-any-match-collectible.md. */
function replayForLegality(moveHistory: string[]): number {
  const chess = new Chess();
  for (const san of moveHistory) {
    try {
      chess.move(san);
    } catch {
      throw new Error("Illegal move in transcript");
    }
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
    // playerColor is still validated (rejects missing/invalid) but is now
    // inert — F8 removed the mate-by-player check, so do NOT re-add a result
    // assertion here without revisiting the spec.
    parsePlayerColor(body.playerColor);

    const derivedTotalMoves = replayForLegality(moveHistory);
    const totalMoves = parseInteger(derivedTotalMoves, "totalMoves", 1, 10_000);

    // F8 heuristic #1 — reject an implausibly fast cadence (a one-shot forged
    // transcript reports a tiny timeMs for many moves). Number() coerces the
    // parseInteger return (bigint|number) uniformly.
    if (Number(timeMs) < Number(totalMoves) * MIN_MS_PER_MOVE) {
      throw new Error("Implausible move cadence");
    }

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
