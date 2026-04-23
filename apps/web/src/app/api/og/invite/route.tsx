import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CardShell } from "@/lib/og/card-shell";
import { BoardRender } from "@/lib/og/board-render";
import { loadCinzelFont } from "@/lib/og/font-loader";
import {
  sanitizeName,
  sanitizeFen,
  parseEnumParam,
  parseSquare,
  readSearchParams,
} from "@/lib/og/validators";
import { THEME_CONFIG } from "@/lib/theme";

export const runtime = "nodejs";

const W = 1200;
const H = 630;

const SUCCESS_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, s-maxage=3600",
};

const PIECE_ALLOWED = ["rook", "bishop", "knight", "pawn", "queen", "king"] as const;
const PIECE_LABEL: Record<(typeof PIECE_ALLOWED)[number], string> = {
  rook: "Rook",
  bishop: "Bishop",
  knight: "Knight",
  pawn: "Pawn",
  queen: "Queen",
  king: "King",
};

export async function GET(req: Request) {
  const qs = readSearchParams(req);
  const from = sanitizeName(qs.get("from"), 20);
  const rawPiece = qs.get("piece");
  const piece = rawPiece && (PIECE_ALLOWED as readonly string[]).includes(rawPiece)
    ? (rawPiece as (typeof PIECE_ALLOWED)[number])
    : null;
  const fen = sanitizeFen(qs.get("fen"));
  const flipped = parseEnumParam(qs.get("color"), ["w", "b"] as const) === "b";
  const star = parseSquare(qs.get("star"));

  const mascotUrl = new URL("/art/favicon-wolf.png", req.url).toString();
  const badgeUrl = new URL("/art/badge-chesscito.png", req.url).toString();
  const starUrl = new URL("/art/redesign/icons/star.png", req.url).toString();
  const origin = new URL(req.url).origin;

  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  // Subtitle picks the most specific context the caller passed.
  // Chip picks the most specific context the caller passed.
  const chip = piece
    ? `${PIECE_LABEL[piece]} puzzle`
    : "Play with me";
  const footer = from
    ? `chesscito.vercel.app \u2022 by ${from}`
    : "chesscito.vercel.app";

  // Hero: board render when FEN provided, piece art when only piece,
  // badge art as the generic fallback.
  let heroSlot;
  if (fen) {
    const overlays = star
      ? [{ rank: 7 - star.rank, file: star.file, iconUrl: starUrl }]
      : [];
    heroSlot = (
      <BoardRender
        fen={fen}
        origin={origin}
        size={440}
        flipped={flipped}
        overlays={overlays}
      />
    );
  } else if (piece) {
    const pieceUrl = origin + THEME_CONFIG.piecesBase + "/w-" + piece + ".png";
    heroSlot = (
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
              "radial-gradient(circle, rgba(245, 158, 11, 0.30) 0%, rgba(217, 180, 74, 0.12) 50%, transparent 80%)",
            display: "flex",
          }}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pieceUrl}
          alt=""
          width={340}
          height={340}
          style={{
            position: "relative",
            filter: "drop-shadow(0 12px 22px rgba(120, 65, 5, 0.38))",
          }}
        />
      </div>
    );
  } else {
    heroSlot = (
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
              "radial-gradient(circle, rgba(245, 158, 11, 0.30) 0%, rgba(217, 180, 74, 0.12) 50%, transparent 80%)",
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
    );
  }

  const pngResponse = new ImageResponse(
    (
      <CardShell
        bgUrl={null}
        mascotUrl={mascotUrl}
        chip={chip}
        footer={footer}
        useCinzel={useCinzel}
        heroSlot={heroSlot}
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
