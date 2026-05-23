import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CardShell, CARD_WIDTH as W, CARD_HEIGHT as H } from "@/lib/og/card-shell";
import { BoardRender } from "@/lib/og/board-render";
import { loadCinzelFont } from "@/lib/og/font-loader";
import {
  parseIntParam,
  readSearchParams,
  sanitizeName,
  parseSquare,
} from "@/lib/og/validators";

export const runtime = "nodejs";

const SUCCESS_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  "CDN-Cache-Control": "public, s-maxage=3600",
};

function buildKrkFen(wk: string, wr: string, bk: string): string {
  const pieces: Record<string, string> = {};
  pieces[wk] = "K";
  pieces[wr] = "R";
  pieces[bk] = "k";

  const ranks: string[] = [];
  for (let r = 8; r >= 1; r--) {
    let row = "";
    for (let f = 0; f < 8; f++) {
      const sq = "abcdefgh"[f] + r;
      row += pieces[sq] ?? "1";
    }
    ranks.push(row.replace(/1+/g, (m) => m.length.toString()));
  }
  return ranks.join("/") + " w - - 0 1";
}

export async function GET(req: Request) {
  const qs = readSearchParams(req);

  const mode = qs.get("mode");
  if (mode !== "krk") {
    return new Response("Unsupported mode", { status: 400 });
  }

  const name = sanitizeName(qs.get("name"), 40) ?? "K+R vs K";
  const wk = qs.get("wk");
  const wr = qs.get("wr");
  const bk = qs.get("bk");

  if (!wk || !wr || !bk || wk.length !== 2 || wr.length !== 2 || bk.length !== 2) {
    return new Response("Missing or invalid position params", { status: 400 });
  }

  const wkPos = parseSquare(wk);
  const wrPos = parseSquare(wr);
  const bkPos = parseSquare(bk);
  if (!wkPos || !wrPos || !bkPos) {
    return new Response("Invalid square coordinates", { status: 400 });
  }

  const solved = qs.get("solved") === "true";
  const moves = parseIntParam(qs.get("moves"), 0, 999, 0);
  const limit = parseIntParam(qs.get("limit"), 1, 999, 0);

  const fen = buildKrkFen(wk, wr, bk);

  const mascotUrl = new URL("/art/favicon-wolf.png", req.url).toString();
  const panelBgUrl = new URL("/art/screen-mission/panel-mision-icon.png", req.url).toString();
  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  const heroSlot = (
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
      <div
        style={{
          display: "flex",
          fontSize: 24,
          fontFamily: useCinzel ? "Cinzel" : "serif",
          fontWeight: 700,
          letterSpacing: "0.18em",
          color: "rgba(110, 65, 15, 0.45)",
          textShadow: "0 2px 0 rgba(255, 245, 215, 0.85)",
          marginBottom: 8,
        }}
      >
        SPECIAL TRAINING
      </div>

      <div
        style={{
          display: "flex",
          fontSize: 42,
          fontFamily: useCinzel ? "Cinzel" : "serif",
          fontWeight: 700,
          letterSpacing: "0.08em",
          color: "rgba(63, 34, 8, 0.95)",
          textShadow: "0 2px 0 rgba(255, 245, 215, 0.90)",
          marginBottom: 14,
        }}
      >
        K+R vs K
      </div>

      <div style={{ display: "flex", marginBottom: 18 }}>
        <BoardRender
          fen={fen}
          origin={new URL(req.url).origin}
          size={560}
        />
      </div>

      {name && (
        <div
          style={{
            display: "flex",
            fontSize: 28,
            fontFamily: useCinzel ? "Cinzel" : "serif",
            fontWeight: 600,
            letterSpacing: "0.04em",
            color: "rgba(63, 34, 8, 0.80)",
            textShadow: "0 1px 0 rgba(255, 245, 215, 0.85)",
            marginBottom: moves > 0 ? 10 : 0,
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          {name}
        </div>
      )}

      <div
        style={{
          display: "flex",
          fontSize: 22,
          fontFamily: useCinzel ? "Cinzel" : "serif",
          fontWeight: 600,
          letterSpacing: "0.04em",
          color: "rgba(110, 65, 15, 0.55)",
          textShadow: "0 1px 0 rgba(255, 245, 215, 0.85)",
          marginBottom: moves > 0 ? 12 : 0,
          textAlign: "center",
        }}
      >
        {solved
          ? "I solved this endgame. Can you?"
          : "Can you force checkmate from this position?"}
      </div>

      {solved && moves > 0 && limit > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 20px",
            borderRadius: 999,
            background: "rgba(255, 245, 215, 0.90)",
            border: "2px solid rgba(245, 158, 11, 0.40)",
          }}
        >
          <span
            style={{
              fontSize: 20,
              fontWeight: 700,
              fontFamily: useCinzel ? "Cinzel" : "serif",
              letterSpacing: "0.04em",
              color: "rgba(63, 34, 8, 0.95)",
            }}
          >
            Solved!
          </span>
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              fontFamily: useCinzel ? "Cinzel" : "serif",
              color: "rgba(110, 65, 15, 0.65)",
            }}
          >
            {moves} / {limit} moves
          </span>
        </div>
      )}
    </div>
  );

  const pngResponse = new ImageResponse(
    (
      <CardShell
        bgUrl={null}
        panelBgUrl={panelBgUrl}
        mascotUrl={mascotUrl}
        chip="K+R vs K"
        footer="Chesscito \u2022 Special Training"
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
