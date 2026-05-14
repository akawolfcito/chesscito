import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CardShell, CARD_WIDTH as W, CARD_HEIGHT as H } from "@/lib/og/card-shell";
import { loadCinzelFont } from "@/lib/og/font-loader";
import {
  parseIntParam,
  parseEnumParam,
  readSearchParams,
} from "@/lib/og/validators";
import { THEME_CONFIG } from "@/lib/theme";

export const runtime = "nodejs";

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

  const mascotUrl = new URL("/art/favicon-wolf.png", req.url).toString();
  const pieceFile = "w-" + piece + ".png";
  const pieceUrl = new URL(THEME_CONFIG.piecesBase + "/" + pieceFile, req.url).toString();

  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  /* Main title — centered, uses the chip-label pattern from before but
     moved into the hero area where it reads as a proper card title
     rather than a small pill. */
  const chipLabel =
    type === "badge-earned"
      ? `${PIECE_LABEL[piece]} Ascendant`
      : `${PIECE_LABEL[piece]} Mastered`;

  /* Score badge — text-based, avoids star glyphs which rendered as
     empty boxes. Clean "X / 15 STARS" with a golden pill treatment
     that feels like a collectible card rarity marker. */
  const scoreBadge = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "10px 28px",
        borderRadius: 999,
        background: "rgba(255, 245, 215, 0.88)",
        border: "2px solid rgba(245, 158, 11, 0.40)",
        boxShadow: "0 3px 10px rgba(120, 65, 5, 0.15)",
      }}
    >
      <span
        style={{
          fontSize: 30,
          fontWeight: 800,
          fontFamily: useCinzel ? "Cinzel" : "serif",
          letterSpacing: "0.04em",
          color: "rgba(63, 34, 8, 0.95)",
        }}
      >
        {stars} / {maxStars} STARS
      </span>
    </div>
  );

  const pngResponse = new ImageResponse(
    (
      <CardShell
        bgUrl={null}
        mascotUrl={mascotUrl}
        footer="Chesscito · saved on Celo"
        useCinzel={useCinzel}
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
            {/* Type badge — structured achievement label */}
            <div
              style={{
                display: "flex",
                fontSize: 26,
                fontFamily: useCinzel ? "Cinzel" : "serif",
                fontWeight: 700,
                letterSpacing: "0.18em",
                color: "rgba(110, 65, 15, 0.50)",
                textShadow: "0 2px 0 rgba(255, 245, 215, 0.85)",
                marginBottom: 14,
              }}
            >
              {TYPE_TITLE[type]}
            </div>

            {/* Main title — piece name + mastery level */}
            <div
              style={{
                display: "flex",
                fontSize: 50,
                fontFamily: useCinzel ? "Cinzel" : "serif",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 3px 0 rgba(255, 245, 215, 0.90)",
                marginBottom: 30,
              }}
            >
              {chipLabel}
            </div>

            {/* Piece with contained glow — reduced from 420px */}
            <div
              style={{
                position: "relative",
                width: 340,
                height: 340,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 30,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  width: 400,
                  height: 400,
                  borderRadius: 9999,
                  background:
                    "radial-gradient(circle, rgba(245, 158, 11, 0.42) 0%, rgba(217, 180, 74, 0.18) 50%, transparent 78%)",
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pieceUrl}
                alt=""
                width={280}
                height={280}
                style={{
                  position: "relative",
                  filter: "drop-shadow(0 12px 24px rgba(120, 65, 5, 0.38))",
                }}
              />
            </div>

            {scoreBadge}
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
