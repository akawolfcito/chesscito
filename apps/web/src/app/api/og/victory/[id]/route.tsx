import { ImageResponse } from "next/og";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import sharp from "sharp";
import { victoryAbi } from "@/lib/contracts/victory";
import { clampMoves, clampTime, formatPlayer, truncateId } from "@/lib/og/og-utils";
import { CardShell, CARD_WIDTH as W, CARD_HEIGHT as H } from "@/lib/og/card-shell";
import { loadCinzelFont } from "@/lib/og/font-loader";
import { resolveOgThemeAsset } from "@/lib/og/theme-assets";

export const runtime = "nodejs";

const DIFFICULTY_LABEL: Record<number, string> = { 1: "Easy", 2: "Medium", 3: "Hard" };

const CHALLENGE_TAGLINE =
  "Train your mind with short chess challenges. Designed with MiniPay in mind.";
const CHALLENGE_LINE = "Can you beat this?";

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
function errorCard(useCinzel: boolean, bgUrl: string | null, mascotUrl: string | null) {
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

  // PNG (RGBA). WebP rendered empty in Satori; PNGs work after the
  // colormap → RGBA re-encode in adb19ae4.
  // Aligned with the in-app /victory/[id] page (b7f0f0f2): swap the
  // forest backdrop + heráldico BADGE for the panel-mision cream
  // shell + page-mirroring content (headline → stats row → challenge
  // block with avatar-confiado peek). Mascot is rendered INSIDE the
  // heroSlot (matches the in-app coach-section avatar), not by
  // CardShell — see mascotMode="none".
  const panelBgUrl = resolveOgThemeAsset(req.url, "shared.mission-panel");
  const avatarUrl = resolveOgThemeAsset(req.url, "shared.feedback-confident");
  // Stat-pill icons reuse the same triplet basenames as the in-app
  // <CandyIcon name="star" /> and <CandyIcon name="time" />. Pawn
  // sprite mirrors the page's w-pawn pill.
  const starIconUrl = resolveOgThemeAsset(req.url, "shared.star");
  const timeIconUrl = resolveOgThemeAsset(req.url, "shared.time");
  const pawnIconUrl = resolveOgThemeAsset(req.url, "board.piece.white.pawn");
  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  if (!client || !contractAddress) {
    return errorCard(useCinzel, panelBgUrl, avatarUrl);
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
    return errorCard(useCinzel, panelBgUrl, avatarUrl); // R3: no fake stats
  }

  const displayId = truncateId(raw); // R11: ID truncation
  const fontFamily = useCinzel ? "Cinzel" : "serif";

  // Stat-pill atom — solid cream background, amber border, picture
  // triplet for the icon (Satori falls through AVIF/WebP → PNG).
  // Mirrors `.candy-stat-pill` from globals.css.
  function StatPill({ iconUrl, label }: { iconUrl: string | null; label: string }) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 24px",
          borderRadius: 999,
          background: "rgb(255, 245, 215)",
          border: "2px solid rgba(220, 165, 50, 0.65)",
          boxShadow: "0 3px 8px rgba(120, 65, 5, 0.18)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {iconUrl ? <img src={iconUrl} alt="" width={44} height={44} style={{ objectFit: "contain" }} /> : null}
        <span
          style={{
            fontSize: 38,
            fontWeight: 800,
            fontFamily,
            color: "rgba(63, 34, 8, 0.95)",
            letterSpacing: "0.02em",
          }}
        >
          {label}
        </span>
      </div>
    );
  }

  const pngResponse = new ImageResponse(
    (
      <CardShell
        bgUrl={null}
        panelBgUrl={panelBgUrl}
        mascotUrl={avatarUrl}
        footer={`Victory #${displayId} \u2022 by ${player}`}
        useCinzel={useCinzel}
        hideWordmark
        mascotMode="none"
        softenPanel
        heroSlot={
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 860,
              height: 860,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* HEADLINE — "Checkmate in {moves} moves", same as
                in-app metaCheckmate copy. Fantasy-brown family. Sized
                to fit a single line at 1080px wide. */}
            <div
              style={{
                display: "flex",
                fontSize: 64,
                fontFamily,
                fontWeight: 700,
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 3px 0 rgba(255, 245, 215, 0.90)",
                letterSpacing: "0.02em",
                marginBottom: 36,
                textAlign: "center",
              }}
            >
              Checkmate in {moves} moves
            </div>

            {/* STATS ROW — ★ Difficulty / ♟ Moves / ⏱ Time using the
                same `/art/redesign/icons/*` + `/art/redesign/pieces/w-pawn`
                assets as the in-app candy-stat-pill row. */}
            <div
              style={{
                display: "flex",
                gap: 22,
                marginBottom: 56,
              }}
            >
              <StatPill iconUrl={starIconUrl} label={difficulty} />
              <StatPill iconUrl={pawnIconUrl} label={moves} />
              <StatPill iconUrl={timeIconUrl} label={time} />
            </div>

            {/* CHALLENGE BLOCK — Coach-section pattern from the page:
                challengeLine as focal headline + avatar-confiado peek.
                Page tagline dropped — at OG render size only Cinzel
                is registered, so body copy would read as decorative
                small-caps rather than a paragraph. The headline +
                title + stats already tell the full story; the avatar
                carries the challenge tone. */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                paddingInline: 24,
                width: 820,
              }}
            >
              <div
                style={{
                  display: "flex",
                  fontSize: 72,
                  fontFamily,
                  fontWeight: 700,
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 2px 0 rgba(255, 245, 215, 0.85)",
                  flex: 1,
                  lineHeight: 1.05,
                }}
              >
                {CHALLENGE_LINE}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {avatarUrl ? <img
                src={avatarUrl}
                alt=""
                width={420}
                height={510}
                style={{
                  filter: "drop-shadow(0 12px 24px rgba(120, 65, 5, 0.40))",
                }}
              /> : null}
            </div>
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
