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
  /** Absolute URL to the board background asset. */
  boardUrl: string;
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

/**
 * Board renderer for Satori. Renders the painted board asset + piece
 * PNGs positioned by FEN coordinates, with optional overlay icons on
 * top for capture/target markers. Satori's flex subset can't express
 * the grid cleanly so each element is absolutely positioned as a
 * percentage of the board edge.
 */
export function BoardRender({
  fen,
  boardUrl,
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
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.28)",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={boardUrl}
        alt=""
        width={size}
        height={size}
        style={{ position: "absolute", top: 0, left: 0 }}
      />
      {pieces.map((p, i) => {
        const r = flipped ? 7 - p.rank : p.rank;
        const f = flipped ? 7 - p.file : p.file;
        const pieceFile = p.color + "-" + PIECE_FILENAME[p.piece] + ".png";
        const src = piecesBase + "/" + pieceFile;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={"p-" + i}
            src={src}
            alt=""
            width={size / 8}
            height={size / 8}
            style={{
              position: "absolute",
              top: r * pct + "%",
              left: f * pct + "%",
              width: pct + "%",
              height: pct + "%",
              display: "flex",
            }}
          />
        );
      })}
      {overlays.map((o, i) => {
        const r = flipped ? 7 - o.rank : o.rank;
        const f = flipped ? 7 - o.file : o.file;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={"o-" + i}
            src={o.iconUrl}
            alt=""
            width={size / 8}
            height={size / 8}
            style={{
              position: "absolute",
              top: r * pct + "%",
              left: f * pct + "%",
              width: pct + "%",
              height: pct + "%",
              display: "flex",
            }}
          />
        );
      })}
    </div>
  );
}
