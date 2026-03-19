import { ImageResponse } from "next/og";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { victoryAbi } from "@/lib/contracts/victory";
import { clampMoves, clampTime, formatPlayer, truncateId } from "@/lib/og/og-utils";

export const runtime = "edge";

const W = 1200;
const H = 630;

const DIFFICULTY_LABEL: Record<number, string> = { 1: "EASY", 2: "MEDIUM", 3: "HARD" };

// R2: cache headers
const SUCCESS_HEADERS = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  "CDN-Cache-Control": "public, s-maxage=86400",
};
const ERROR_HEADERS = { "Cache-Control": "no-store" };

// R5: module-scope client reuse
const contractAddress = process.env.NEXT_PUBLIC_VICTORY_NFT_ADDRESS as `0x${string}` | undefined;
const client = contractAddress
  ? createPublicClient({ chain: celo, transport: http() })
  : null;

// R3: error card — "Victory not found" with 404 + no-store
function errorCard() {
  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          color: "#e4f6fb",
          background: "linear-gradient(160deg, #0a1424 0%, #0b1628 40%, #0f1d35 70%, #0a1424 100%)",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", fontSize: 36, fontWeight: 700, color: "rgba(94,234,212,0.5)", letterSpacing: "0.04em", marginBottom: 16 }}>
          Victory not found
        </div>
        <div style={{ display: "flex", fontSize: 16, fontWeight: 400, color: "rgba(160,205,225,0.4)", marginBottom: 32 }}>
          This victory may not exist yet
        </div>
        <div style={{ display: "flex", fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(20,184,166,0.35)" }}>
          CHESSCITO
        </div>
      </div>
    ),
    { width: W, height: H, status: 404, headers: ERROR_HEADERS },
  );
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // R1: input validation
  const raw = params.id;
  if (!raw || !/^\d{1,78}$/.test(raw)) {
    return new Response("Invalid token ID", { status: 400 });
  }
  const tokenId = BigInt(raw);

  if (!client || !contractAddress) {
    return errorCard();
  }

  let moves: string;
  let time: string;
  let difficulty: string;
  let player: string;

  try {
    const [victoryData, owner] = await Promise.all([
      client.readContract({
        address: contractAddress,
        abi: victoryAbi,
        functionName: "victories",
        args: [tokenId],
      }),
      client.readContract({
        address: contractAddress,
        abi: victoryAbi,
        functionName: "ownerOf",
        args: [tokenId],
      }),
    ]);

    const [diff, totalMoves, timeMs] = victoryData as [number, number, number];
    moves = clampMoves(totalMoves);        // R8: value clamping
    time = clampTime(timeMs);              // R8: value clamping
    difficulty = DIFFICULTY_LABEL[diff] ?? "EASY";
    player = formatPlayer(owner as string); // R11: player formatting
  } catch {
    return errorCard(); // R3: no fake stats
  }

  const displayId = truncateId(raw); // R11: ID truncation

  return new ImageResponse(
    (
      <div
        style={{
          width: W,
          height: H,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          color: "#e4f6fb",
          background: "linear-gradient(160deg, #0a1424 0%, #0b1628 40%, #0f1d35 70%, #0a1424 100%)",
          position: "relative",
        }}
      >
        {/* Headline */}
        <div style={{ display: "flex", fontSize: 72, fontWeight: 900, letterSpacing: "0.06em", color: "#5eead4", lineHeight: 1, marginBottom: 20 }}>
          CHECKMATE
        </div>

        {/* Performance */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 36, fontWeight: 700, color: "#f5f5f5", letterSpacing: "0.04em", marginBottom: 20 }}>
          {`${moves} MOVES \u2022 ${time}`}
        </div>

        {/* Difficulty pill */}
        <div style={{ display: "flex", padding: "6px 24px", borderRadius: 20, border: "1px solid rgba(160,205,225,0.15)", background: "rgba(255,255,255,0.04)", fontSize: 14, fontWeight: 600, letterSpacing: "0.12em", color: "rgba(160,205,225,0.5)", marginBottom: 32 }}>
          {difficulty}
        </div>

        {/* Challenge line */}
        <div style={{ display: "flex", fontSize: 28, fontWeight: 600, color: "#fbbf24", letterSpacing: "0.02em", marginBottom: 28 }}>
          Can you beat this?
        </div>

        {/* Player + Victory ID */}
        <div style={{ display: "flex", fontSize: 16, fontWeight: 400, color: "rgba(160,205,225,0.4)", marginBottom: 8 }}>
          {`Victory #${displayId} \u2022 by ${player}`}
        </div>

        {/* Brand */}
        <div style={{ display: "flex", fontSize: 14, fontWeight: 700, letterSpacing: "0.15em", color: "rgba(20,184,166,0.35)" }}>
          CHESSCITO
        </div>
      </div>
    ),
    { width: W, height: H, headers: SUCCESS_HEADERS },
  );
}
