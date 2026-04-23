import { ImageResponse } from "next/og";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import sharp from "sharp";
import { victoryAbi } from "@/lib/contracts/victory";
import { clampMoves, clampTime, formatPlayer, truncateId } from "@/lib/og/og-utils";
import { CardShell } from "@/lib/og/card-shell";
import { loadCinzelFont } from "@/lib/og/font-loader";

export const runtime = "nodejs";

const W = 1200;
const H = 630;

const DIFFICULTY_LABEL: Record<number, string> = { 1: "EASY", 2: "MEDIUM", 3: "HARD" };

// R2: cache headers — one-day edge cache, week-long stale-while-revalidate
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

// R3: error card — candy-light branded "Victory not found"
function errorCard(useCinzel: boolean, bgUrl: string, mascotUrl: string) {
  return new ImageResponse(
    (
      <CardShell
        bgUrl={bgUrl}
        mascotUrl={mascotUrl}
        chip="Victory not found"
        useCinzel={useCinzel}
      />
    ),
    { width: W, height: H, status: 404, headers: ERROR_HEADERS },
  );
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  // R1: input validation
  const raw = params.id;
  if (!raw || !/^\d{1,78}$/.test(raw)) {
    return new Response("Invalid token ID", { status: 400 });
  }
  const tokenId = BigInt(raw);

  const bgUrl = new URL("/art/redesign/bg/bg-ch.png", req.url).toString();
  const mascotUrl = new URL("/art/favicon-wolf.png", req.url).toString();
  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  if (!client || !contractAddress) {
    return errorCard(useCinzel, bgUrl, mascotUrl);
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
    return errorCard(useCinzel, bgUrl, mascotUrl); // R3: no fake stats
  }

  const displayId = truncateId(raw); // R11: ID truncation
  const badgeUrl = new URL("/art/badge-chesscito.png", req.url).toString();

  const pngResponse = new ImageResponse(
    (
      <CardShell
        bgUrl={bgUrl}
        mascotUrl={mascotUrl}
        chip={`Checkmate \u2022 ${difficulty} \u2022 ${moves} moves \u2022 ${time}`}
        footer={`Victory #${displayId} \u2022 by ${player}`}
        useCinzel={useCinzel}
        heroSlot={
          <div
            style={{
              position: "relative",
              display: "flex",
              width: 440,
              height: 440,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 440,
                height: 440,
                borderRadius: 9999,
                background:
                  "radial-gradient(circle, rgba(245, 158, 11, 0.32) 0%, rgba(217, 180, 74, 0.14) 50%, transparent 80%)",
                display: "flex",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={badgeUrl}
              alt=""
              width={360}
              height={360}
              style={{
                position: "relative",
                filter: "drop-shadow(0 12px 22px rgba(120, 65, 5, 0.38))",
              }}
            />
          </div>
        }
      />
    ),
    {
      width: W,
      height: H,
      ...(cinzelData
        ? {
            fonts: [{
              name: "Cinzel",
              data: cinzelData,
              weight: 700 as const,
              style: "normal" as const,
            }],
          }
        : {}),
    },
  );

  // Convert Satori's uncompressed PNG (~1.3MB) to JPEG (~50-80KB)
  const pngBuffer = Buffer.from(await pngResponse.arrayBuffer());
  const jpegBuffer = await sharp(pngBuffer).jpeg({ quality: 80 }).toBuffer();

  return new Response(new Uint8Array(jpegBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      ...SUCCESS_HEADERS,
    },
  });
}
