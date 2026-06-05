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

/** Per-result hero icon — candy-forest 3D scenes that mirror the
 *  in-app vocabulary. `loss` reuses the checkmate scene because the
 *  event IS a checkmate (just from the other side); the title +
 *  avatar emotion carry the loss framing. */
const RESULT_ICON = {
  win: "/art/new-assets-chesscito/games/checkmate-game001.png",
  draw: "/art/new-assets-chesscito/games/stalemate-game001.png",
  loss: "/art/new-assets-chesscito/games/checkmate-game001.png",
} as const;

/** Per-result avatar emotion (see feedback_avatar_emotion_selection).
 *  Picked by who the surface addresses post-game:
 *  win → sharer celebrates → feliz
 *  draw → reflection → pensativo
 *  loss → loss processing → triste */
const RESULT_AVATAR = {
  win: "/art/new-assets-chesscito/fun/avatar-feliz.png",
  draw: "/art/new-assets-chesscito/fun/avatar-pensativo.png",
  loss: "/art/new-assets-chesscito/fun/avatar-triste.png",
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

  // PNG (RGBA). WebP rendered empty in Satori on @vercel/og preview
  // runtime; PNGs work after the colormap → RGBA re-encode in adb19ae4.
  const mascotUrl = new URL(RESULT_AVATAR[result], req.url).toString();
  const resultIconUrl = new URL(RESULT_ICON[result], req.url).toString();
  const panelBgUrl = new URL("/art/screen-mission/panel-mision-icon.png", req.url).toString();
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
        footer={"Chesscito \u2022 Arena match"}
        useCinzel={useCinzel}
        hideWordmark
        mascotMode="half-body"
        mascotScale={0.6}
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

            {/* Result icon — candy-forest 3D scene (checkmate /
                stalemate) that mirrors the in-app vocabulary. Acts as
                the hero emblem when no fen is supplied; shrinks to a
                small overlay when the board takes the focus. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resultIconUrl}
              alt=""
              width={fen ? 200 : 460}
              height={fen ? 200 : 460}
              style={{
                marginBottom: 22,
                filter: "drop-shadow(0 10px 22px rgba(120, 65, 5, 0.35))",
              }}
            />

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
                  size={380}
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
