import { ImageResponse } from "next/og";
import sharp from "sharp";
import { clampMoves, clampTime } from "@/lib/og/og-utils";
import { CardShell, CARD_WIDTH as W, CARD_HEIGHT as H } from "@/lib/og/card-shell";
import { BoardRender } from "@/lib/og/board-render";
import { loadCinzelFont } from "@/lib/og/font-loader";
import {
  parseIntParam,
  parseEnumParam,
  sanitizeFen,
  readSearchParams,
} from "@/lib/og/validators";

export const runtime = "nodejs";

const DIFFICULTY_LABEL = { easy: "EASY", medium: "MEDIUM", hard: "HARD" } as const;
const RESULT_LABEL = {
  win: "VICTORY",
  draw: "DRAW",
  loss: "LOSS",
} as const;
const TITLE_LABEL = {
  win: "CHECKMATE",
  draw: "STALEMATE",
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
  const fen = sanitizeFen(params.get("fen"));

  // WebP variants of the same assets — Satori accepts WebP cleanly,
  // and the .webp files don't carry the colormap PNG metadata that
  // newer @vercel/og runtimes reject ("Unsupported image type:
  // unknown"). Source PNGs stay around for non-OG consumers via
  // image-set() picture fallbacks; only the OG endpoints switch.
  const mascotUrl = new URL("/art/favicon-wolf.webp", req.url).toString();
  const panelBgUrl = new URL("/art/screen-mission/panel-mision-icon.webp", req.url).toString();
  const origin = new URL(req.url).origin;

  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  const resultPill = `${DIFFICULTY_LABEL[difficulty]} \u2022 ${clampMoves(moves)} MOVES \u2022 ${clampTime(timeMs)}`;

  const pngResponse = new ImageResponse(
    (
      <CardShell
        bgUrl={null}
        panelBgUrl={panelBgUrl}
        mascotUrl={mascotUrl}
        footer="Chesscito \u2022 Arena match"
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
            {/* Small top label: VICTORY / DRAW / LOSS */}
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
              {RESULT_LABEL[result]}
            </div>

            {/* Main title: CHECKMATE / STALEMATE / GOOD FIGHT */}
            <div
              style={{
                display: "flex",
                fontSize: 48,
                fontFamily: useCinzel ? "Cinzel" : "serif",
                fontWeight: 700,
                letterSpacing: "0.08em",
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 3px 0 rgba(255, 245, 215, 0.90)",
                marginBottom: 24,
              }}
            >
              {TITLE_LABEL[result]}
            </div>

            {/* Board snapshot — compact but readable */}
            {fen ? (
              <div
                style={{
                  display: "flex",
                  marginBottom: 24,
                }}
              >
                <BoardRender
                  fen={fen}
                  origin={origin}
                  size={560}
                  flipped={flipped}
                />
              </div>
            ) : null}

            {/* Result pill: EASY · 9 MOVES · 0:09 */}
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
                  fontSize: 28,
                  fontWeight: 800,
                  fontFamily: useCinzel ? "Cinzel" : "serif",
                  letterSpacing: "0.04em",
                  color: "rgba(63, 34, 8, 0.95)",
                }}
              >
                {resultPill}
              </span>
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

  const pngBuffer = Buffer.from(await pngResponse.arrayBuffer());
  const jpegBuffer = await sharp(pngBuffer).jpeg({ quality: 80 }).toBuffer();

  return new Response(new Uint8Array(jpegBuffer), {
    headers: {
      "Content-Type": "image/jpeg",
      ...SUCCESS_HEADERS,
    },
  });
}
