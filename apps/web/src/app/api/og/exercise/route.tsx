import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CardShell } from "@/lib/og/card-shell";
import { loadCinzelFont } from "@/lib/og/font-loader";
import {
  parseIntParam,
  parseEnumParam,
  sanitizeName,
  readSearchParams,
} from "@/lib/og/validators";
import { THEME_CONFIG } from "@/lib/theme";

export const runtime = "nodejs";

const W = 1200;
const H = 630;

const PIECE_LABEL = {
  rook: "Rook",
  bishop: "Bishop",
  knight: "Knight",
  pawn: "Pawn",
  queen: "Queen",
  king: "King",
} as const;

const TYPE_TITLE = {
  "piece-complete": "PIECE COMPLETE",
  "badge-earned": "BADGE UNLOCKED",
} as const;

const SUCCESS_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, s-maxage=3600",
};

export async function GET(req: Request) {
  const qs = readSearchParams(req);

  const piece = parseEnumParam(
    qs.get("piece"),
    ["rook", "bishop", "knight", "pawn", "queen", "king"] as const,
  );
  const stars = parseIntParam(qs.get("stars"), 0, 15, 0);
  const maxStars = 15;
  const type = parseEnumParam(
    qs.get("type"),
    ["piece-complete", "badge-earned"] as const,
  );
  const name = sanitizeName(qs.get("name"), 20);

  const bgUrl = new URL("/art/redesign/bg/bg-ch.png", req.url).toString();
  const mascotUrl = new URL("/art/favicon-wolf.png", req.url).toString();
  const pieceFile = "w-" + piece + ".png";
  const pieceUrl = new URL(THEME_CONFIG.piecesBase + "/" + pieceFile, req.url).toString();

  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  const footer = name
    ? `chesscito.vercel.app \u2022 by ${name}`
    : "chesscito.vercel.app";

  const pngResponse = new ImageResponse(
    (
      <CardShell
        bgUrl={bgUrl}
        mascotUrl={mascotUrl}
        title={TYPE_TITLE[type]}
        subtitle={`${PIECE_LABEL[piece]} \u2022 ${stars}/${maxStars} stars`}
        footer={footer}
        useCinzel={useCinzel}
        rightSlot={
          <div
            style={{
              position: "relative",
              display: "flex",
              width: 360,
              height: 360,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: 360,
                height: 360,
                borderRadius: 9999,
                background:
                  "radial-gradient(circle, rgba(245, 158, 11, 0.35) 0%, rgba(217, 180, 74, 0.15) 45%, rgba(217, 180, 74, 0.04) 70%, transparent 85%)",
                display: "flex",
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pieceUrl}
              alt=""
              width={260}
              height={260}
              style={{
                position: "relative",
                filter: "drop-shadow(0 10px 20px rgba(120, 65, 5, 0.35))",
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

  const pngBuffer = Buffer.from(await pngResponse.arrayBuffer());
  const jpegBuffer = await sharp(pngBuffer).jpeg({ quality: 80 }).toBuffer();

  return new Response(new Uint8Array(jpegBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      ...SUCCESS_HEADERS,
    },
  });
}
