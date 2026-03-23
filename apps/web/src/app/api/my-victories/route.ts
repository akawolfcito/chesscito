import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http, isAddress, parseAbiItem } from "viem";
import { celo } from "viem/chains";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RPC_URL = process.env.CELO_RPC_URL ?? "https://forno.celo.org";
const VICTORY_NFT = process.env.NEXT_PUBLIC_VICTORY_NFT_ADDRESS as
  | `0x${string}`
  | undefined;

const EVENT_SCAN_START = 61_250_000n;
const CHUNK_SIZE = 50_000n;

const VictoryMintedEvent = parseAbiItem(
  "event VictoryMinted(address indexed player, uint256 indexed tokenId, uint8 difficulty, uint16 totalMoves, uint32 timeMs, address indexed token, uint256 totalAmount)"
);

export type MyVictoryRow = {
  tokenId: string;
  player: string;
  difficulty: number;
  totalMoves: number;
  timeMs: number;
  timestamp: number;
};

export async function GET(request: NextRequest) {
  const player = request.nextUrl.searchParams.get("player");

  if (!player || !isAddress(player)) {
    return NextResponse.json(
      { error: "Missing or invalid player address" },
      { status: 400 }
    );
  }

  if (!VICTORY_NFT) {
    return NextResponse.json([], {
      headers: { "Cache-Control": "s-maxage=60" },
    });
  }

  try {
    const client = createPublicClient({
      chain: celo,
      transport: http(RPC_URL),
    });

    const latest = await client.getBlockNumber();
    const logs = [];
    for (let from = EVENT_SCAN_START; from <= latest; from += CHUNK_SIZE) {
      const to =
        from + CHUNK_SIZE - 1n > latest ? latest : from + CHUNK_SIZE - 1n;
      const chunk = await client.getLogs({
        address: VICTORY_NFT,
        event: VictoryMintedEvent,
        args: { player: player as `0x${string}` },
        fromBlock: from,
        toBlock: to,
      });
      logs.push(...chunk);
    }

    // Sort newest first
    const sorted = logs.sort((a, b) => {
      const blockDiff = Number(b.blockNumber - a.blockNumber);
      return blockDiff !== 0 ? blockDiff : b.logIndex - a.logIndex;
    });

    // Resolve timestamps
    const uniqueBlocks = [
      ...new Set(sorted.map((l) => l.blockNumber.toString())),
    ].map(BigInt);
    const blocks = await Promise.all(
      uniqueBlocks.map((n) => client.getBlock({ blockNumber: n }))
    );
    const tsMap = new Map<bigint, number>();
    for (const block of blocks) {
      tsMap.set(block.number, Number(block.timestamp));
    }

    const rows: MyVictoryRow[] = sorted.map((log) => ({
      tokenId: log.args.tokenId!.toString(),
      player: log.args.player!,
      difficulty: Number(log.args.difficulty!),
      totalMoves: Number(log.args.totalMoves!),
      timeMs: Number(log.args.timeMs!),
      timestamp: tsMap.get(log.blockNumber) ?? 0,
    }));

    return NextResponse.json(rows, {
      headers: {
        "Cache-Control": "s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch victories" }, { status: 500 });
  }
}
