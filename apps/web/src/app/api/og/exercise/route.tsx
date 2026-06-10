import { ImageResponse } from "next/og";
import sharp from "sharp";
import { CardShell, CARD_WIDTH as W, CARD_HEIGHT as H } from "@/lib/og/card-shell";
import { BoardRender, type BoardOverlay } from "@/lib/og/board-render";
import { loadCinzelFont } from "@/lib/og/font-loader";
import {
  parseIntParam,
  parseEnumParam,
  readSearchParams,
  sanitizeName,
  parseSquare,
} from "@/lib/og/validators";
import { buildExerciseFen, toAlgebraic } from "@/lib/og/exercise-fen";
import {
  ogExerciseCardCopy,
  type OgExerciseAchievementType,
} from "@/lib/og/exercise-card-copy";
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
    ["piece-complete", "badge-earned", "score-saved", "daily"] as const,
  );

  // Non-daily card copy (eyebrow / title / tagline / footer). score-saved
  // is the leaderboard-first lane that no longer borrows the piece-mastered
  // template. Daily keeps its own bespoke layout below.
  const card =
    type !== "daily"
      ? ogExerciseCardCopy(type as OgExerciseAchievementType, PIECE_LABEL[piece], stars)
      : null;

  // PNG (RGBA). WebP rendered empty in Satori; PNGs work after the
  // colormap → RGBA re-encode in adb19ae4.
  // Swap from favicon-wolf to avatar-chesscito so the share card
  // mascot matches the in-app Hub / popup avatar family. PRO version
  // lives at /art/hub/chesscito-avatar-new-light but the share card
  // is anonymous (no auth context at render time) → use the default.
  const mascotUrl = new URL("/art/scene-rooted/avatar-chesscito.png", req.url).toString();
  const panelBgUrl = new URL("/art/screen-mission/panel-mision-icon.png", req.url).toString();
  const pieceFile = "w-" + piece + ".png";
  const pieceUrl = new URL(THEME_CONFIG.piecesBase + "/" + pieceFile, req.url).toString();

  const cinzelData = await loadCinzelFont(req.url);
  const useCinzel = Boolean(cinzelData);

  /* Daily share card — parse optional params */
  const puzzleName = type === "daily" ? sanitizeName(qs.get("name"), 40) : null;
  const startRaw = type === "daily" ? qs.get("start") : null;
  const targetRaw = type === "daily" ? qs.get("target") : null;
  const solvedParam = type === "daily" ? qs.get("solved") : null;
  const streak = type === "daily" ? parseIntParam(qs.get("streak"), 0, 999, 0) : 0;
  const solved = solvedParam === "true";

  const startPos = type === "daily" && startRaw ? parseSquare(startRaw) : null;
  const targetPos = type === "daily" && targetRaw ? parseSquare(targetRaw) : null;

  let dailyOverlays: BoardOverlay[] = [];
  let dailyFen: string | null = null;
  if (type === "daily" && startPos && targetPos) {
    dailyFen = buildExerciseFen(piece, startPos);
    const starUrl = new URL("/art/redesign/icons/star.png", req.url).toString();
    dailyOverlays = [{ rank: 7 - targetPos.rank, file: targetPos.file, iconUrl: starUrl }];
  }

  /* Score badge — golden pill with inline SVG star + "X / Y STARS".
     Inline SVG (not emoji) because emoji glyphs render as empty boxes
     in Satori. Mirrors the in-app candy-stat-pill family used by the
     migrated badge popup. */
  const scoreBadge = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 28px",
        borderRadius: 999,
        background: "rgba(255, 245, 215, 0.88)",
        border: "2px solid rgba(245, 158, 11, 0.40)",
        boxShadow: "0 3px 10px rgba(120, 65, 5, 0.15)",
      }}
    >
      <svg
        width={28}
        height={28}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M12 2 L14.6 8.6 L21.6 9.1 L16.2 13.7 L17.8 20.6 L12 16.9 L6.2 20.6 L7.8 13.7 L2.4 9.1 L9.4 8.6 Z"
          fill="rgb(245, 158, 11)"
          stroke="rgb(180, 100, 5)"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      </svg>
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
        panelBgUrl={panelBgUrl}
        mascotUrl={mascotUrl}
        footer={type === "daily" ? "Chesscito \u2022 Daily Tactic" : (card?.footer ?? "Chesscito")}
        useCinzel={useCinzel}
        hideWordmark={type !== "daily"}
        mascotMode={type !== "daily" ? "half-body" : "circle"}
        softenPanel
        heroSlot={
          type === "daily" && dailyFen ? (
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
              {/* Tagline — small faded label */}
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  fontFamily: useCinzel ? "Cinzel" : "serif",
                  fontWeight: 700,
                  letterSpacing: "0.18em",
                  color: "rgba(110, 65, 15, 0.45)",
                  textShadow: "0 2px 0 rgba(255, 245, 215, 0.85)",
                  marginBottom: 12,
                }}
              >
                DAILY TACTIC
              </div>

              {/* Board — initial position with target star */}
              <div
                style={{
                  display: "flex",
                  marginBottom: 20,
                }}
              >
                <BoardRender
                  fen={dailyFen}
                  origin={new URL(req.url).origin}
                  size={680}
                  overlays={dailyOverlays}
                />
              </div>

              {/* Puzzle name */}
              {puzzleName && (
                <div
                  style={{
                    display: "flex",
                    fontSize: 34,
                    fontFamily: useCinzel ? "Cinzel" : "serif",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    color: "rgba(63, 34, 8, 0.95)",
                    textShadow: "0 2px 0 rgba(255, 245, 215, 0.90)",
                    marginBottom: 8,
                    textAlign: "center",
                    maxWidth: 700,
                  }}
                >
                  {puzzleName}
                </div>
              )}

              {/* CTA line */}
              <div
                style={{
                  display: "flex",
                  fontSize: 24,
                  fontFamily: useCinzel ? "Cinzel" : "serif",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  color: "rgba(110, 65, 15, 0.55)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.85)",
                  marginBottom: solved && streak > 0 ? 10 : 0,
                  textAlign: "center",
                }}
              >
                {solved ? "I solved today\u2019s puzzle. Can you?" : "Can you solve today\u2019s puzzle?"}
              </div>

              {/* Solved + streak pill — only when solved=true */}
              {solved && (
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
                  {streak > 0 && (
                    <span
                      style={{
                        fontSize: 18,
                        fontWeight: 600,
                        fontFamily: useCinzel ? "Cinzel" : "serif",
                        color: "rgba(110, 65, 15, 0.65)",
                      }}
                    >
                      Streak: {streak}
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
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
                {card?.eyebrow ?? ""}
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
                {card?.title ?? ""}
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

              {/* Tagline — mirrors the in-app popup subtitle so the share
                  preview reads as a continuation of the celebration, not a
                  separate branded card. */}
              <div
                style={{
                  display: "flex",
                  marginTop: 22,
                  fontSize: 28,
                  fontFamily: useCinzel ? "Cinzel" : "serif",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                  color: "rgba(63, 34, 8, 0.85)",
                  textShadow: "0 2px 0 rgba(255, 245, 215, 0.85)",
                  maxWidth: 760,
                  textAlign: "center",
                }}
              >
                {card?.tagline ?? ""}
              </div>
            </div>
          )
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
