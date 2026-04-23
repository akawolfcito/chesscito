import { ImageResponse } from "next/og";
import sharp from "sharp";
import { clampMoves, clampTime } from "@/lib/og/og-utils";
import { CardShell } from "@/lib/og/card-shell";
import { BoardRender } from "@/lib/og/board-render";
import { loadCinzelFont } from "@/lib/og/font-loader";
import {
  parseIntParam,
  parseEnumParam,
  sanitizeName,
  sanitizeFen,
  readSearchParams,
} from "@/lib/og/validators";

export const runtime = "nodejs";

const W = 1200;
const H = 630;

const DIFFICULTY_LABEL = { easy: "EASY", medium: "MEDIUM", hard: "HARD" } as const;
const RESULT_TITLE = {
  win: "VICTORY!",
  draw: "DRAW",
  loss: "GOOD FIGHT",
} as const;

const SUCCESS_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, s-maxage=3600",
};

export async function GET(req: Request) {
  const params = readSearchParams(req);

  const moves = parseIntParam(params.get("moves"), 1, 999, 1);
  const timeMs = parseIntParam(params.get("time"), 0, 5999000, 0);
  const difficulty = parseEnumParam(params.get("diff"), ["easy", "medium", "hard"] as const);
  const result = parseEnumParam(params.get("result"), ["win", "draw", "loss"] as const);
  const flipped = params.get("color") === "b";
  const name = sanitizeName(params.get("name"), 20);
  const fen = sanitizeFen(params.get("fen"));

  const bgUrl = new URL("/art/redesign/bg/bg-ch.png", req.url).toString();
  const mascotUrl = new URL("/art/favicon-wolf.png", req.url).toString();
  const origin = new URL(req.url).origin;

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
        title={RESULT_TITLE[result]}
        subtitle={`${clampMoves(moves)} moves \u2022 ${clampTime(timeMs)}`}
        difficulty={DIFFICULTY_LABEL[difficulty]}
        footer={footer}
        useCinzel={useCinzel}
        rightSlot={
          fen ? (
            <BoardRender
              fen={fen}
              origin={origin}
              size={420}
              flipped={flipped}
            />
          ) : undefined
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
