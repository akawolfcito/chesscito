import type { ReactNode } from "react";
import { THEME_CONFIG } from "@/lib/theme";

type ParsedPiece = { piece: string; color: "w" | "b"; rank: number; file: number };

/**
 * Parse the board portion of a FEN string into a flat list of pieces
 * with rank (0 = top = rank 8) and file (0 = left = file a) indices.
 * Returns an empty list for malformed input — caller renders the empty
 * board as a fallback.
 */
export function parseFenBoard(fen: string): ParsedPiece[] {
  const boardPart = fen.split(" ")[0] ?? "";
  const ranks = boardPart.split("/");
  if (ranks.length !== 8) return [];

  const pieces: ParsedPiece[] = [];
  for (let r = 0; r < 8; r++) {
    let file = 0;
    for (const ch of ranks[r]) {
      if (file > 7) return [];
      if (/[1-8]/.test(ch)) {
        file += Number(ch);
        continue;
      }
      if (!/[prnbqkPRNBQK]/.test(ch)) return [];
      const color = ch === ch.toUpperCase() ? "w" : "b";
      pieces.push({ piece: ch.toLowerCase(), color, rank: r, file });
      file += 1;
    }
  }
  return pieces;
}

const PIECE_FILENAME: Record<string, string> = {
  p: "pawn",
  r: "rook",
  n: "knight",
  b: "bishop",
  q: "queen",
  k: "king",
};

/** Overlay marker positioned on a specific square (e.g. capture-target star). */
export type BoardOverlay = {
  rank: number; // 0 = top (rank 8), 7 = bottom (rank 1)
  file: number; // 0 = file a, 7 = file h
  iconUrl: string;
};

type BoardRenderProps = {
  /** FEN string — only the board portion is consumed. */
  fen: string;
  /** Absolute origin used to build piece PNG URLs. */
  origin: string;
  /** Rendered edge length in px. */
  size: number;
  /** Render from black's perspective (player chose black). */
  flipped?: boolean;
  /** Extra markers painted above the pieces (stars for capture targets,
   *  move-to hints, etc). */
  overlays?: BoardOverlay[];
};

const LIGHT_SQUARE = "rgb(245, 234, 198)"; // warm cream
const DARK_SQUARE = "rgb(118, 150, 86)";   // candy olive-green

/**
 * Board renderer for Satori. Draws a flat 8×8 grid of candy-cream /
 * olive-green squares (no PNG frame, so piece coords line up with the
 * grid exactly — avoids the inset-calibration we'd otherwise need for
 * board-ch.png's decorative border + a/1 labels). Piece PNGs + overlay
 * icons are positioned as percentages of the board edge.
 */
export function BoardRender({
  fen,
  origin,
  size,
  flipped = false,
  overlays = [],
}: BoardRenderProps): ReactNode {
  const pieces = parseFenBoard(fen);
  const pct = 100 / 8;
  const piecesBase = origin + THEME_CONFIG.piecesBase;

  return (
    <div
      style={{
        position: "relative",
        width: size,
        height: size,
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.28)",
        border: "4px solid rgb(92, 128, 66)",
      }}
    >
      {/* 8×8 grid — rows top (rank 8) to bottom (rank 1) */}
      {Array.from({ length: 8 }).map((_, row) => (
        <div
          key={"row-" + row}
          style={{
            display: "flex",
            flex: 1,
          }}
        >
          {Array.from({ length: 8 }).map((__, col) => {
            const isLight = (row + col) % 2 === 0;
            return (
              <div
                key={"c-" + row + "-" + col}
                style={{
                  flex: 1,
                  display: "flex",
                  background: isLight ? LIGHT_SQUARE : DARK_SQUARE,
                }}
              />
            );
          })}
        </div>
      ))}
      {pieces.map((p, i) => {
        const r = flipped ? 7 - p.rank : p.rank;
        const f = flipped ? 7 - p.file : p.file;
        const pieceFile = p.color + "-" + PIECE_FILENAME[p.piece] + ".png";
        const src = piecesBase + "/" + pieceFile;
        return (
          <div
            key={"p-" + i}
            style={{
              position: "absolute",
              top: r * pct + "%",
              left: f * pct + "%",
              width: pct + "%",
              height: pct + "%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              height={Math.round((size / 8) * 0.9)}
              style={{ display: "flex" }}
            />
          </div>
        );
      })}
      {overlays.map((o, i) => {
        const r = flipped ? 7 - o.rank : o.rank;
        const f = flipped ? 7 - o.file : o.file;
        return (
          <div
            key={"o-" + i}
            style={{
              position: "absolute",
              top: r * pct + "%",
              left: f * pct + "%",
              width: pct + "%",
              height: pct + "%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={o.iconUrl}
              alt=""
              height={Math.round((size / 8) * 0.75)}
              style={{ display: "flex" }}
            />
          </div>
        );
      })}
    </div>
  );
}
