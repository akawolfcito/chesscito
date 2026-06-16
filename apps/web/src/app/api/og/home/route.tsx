import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CardShell, CARD_WIDTH as W, CARD_HEIGHT as H } from "@/lib/og/card-shell";
import { loadCinzelFont } from "@/lib/og/font-loader";

export const runtime = "nodejs";

// Home / root share preview. Replaces the stale v1 (dark-blue wizard)
// `/art/og-home.jpg` with a candy-branded card rendered through the SAME
// CardShell the in-app share cards use (1080×1350 portrait, smart-cropped by
// Twitter): candy board hero + CHESSCITO wordmark + a short plain-language
// tagline chip + Wolfcito mascot. No new static asset required (founder
// 2026-06-16). Brand name is "Chesscito".
const TAGLINE = "Learn chess, move by move";

const SUCCESS_HEADERS = {
  "Content-Type": "image/jpeg",
  // One-day edge cache, week-long stale-while-revalidate (mirrors /api/og/victory).
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
  "CDN-Cache-Control": "public, s-maxage=86400",
};

export async function GET(req: Request) {
  // PNG assets only — WebP renders empty in the Satori runtime (see
  // board-render perf notes). Board is the canonical candy board; mascot is
  // the confident Wolfcito reused from the victory OG.
  const boardUrl = new URL("/art/chesscito-board.png", req.url).toString();
  const mascotUrl = new URL(
    "/art/new-assets-chesscito/fun/avatar-confiado.png",
    req.url,
  ).toString();
  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  const pngResponse = new ImageResponse(
    (
      <CardShell
        bgUrl={null}
        mascotUrl={mascotUrl}
        chip={TAGLINE}
        footer="chesscito.com"
        useCinzel={useCinzel}
        heroSlot={
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={boardUrl}
            alt=""
            width={760}
            height={760}
            style={{
              objectFit: "contain",
              filter: "drop-shadow(0 16px 30px rgba(120, 65, 5, 0.35))",
            }}
          />
        }
      />
    ),
    {
      width: W,
      height: H,
      ...(cinzelData
        ? {
            fonts: [
              {
                name: "Cinzel",
                data: cinzelData,
                weight: 700 as const,
                style: "normal" as const,
              },
            ],
          }
        : {}),
    },
  );

  // Satori emits an uncompressed PNG (~1.3MB) → re-encode to JPEG (~50-80KB).
  const pngBuffer = Buffer.from(await pngResponse.arrayBuffer());
  const jpegBuffer = await sharp(pngBuffer).jpeg({ quality: 82 }).toBuffer();

  return new Response(new Uint8Array(jpegBuffer), { headers: SUCCESS_HEADERS });
}
