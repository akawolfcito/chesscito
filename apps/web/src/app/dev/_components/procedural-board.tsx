"use client";

/**
 * ProceduralBoard — dev-only programmatic chess board (no bg image).
 *
 * The 8×8 textured tiles ARE the board, so cell alignment is guaranteed by
 * construction. The candy frame PNG (transparent center) overlays on top with
 * the grid inset to its measured opening. Coordinates ride the frame band.
 *
 * Reused by /dev/board-procedural (PoC) and /dev/labyrinth-builder (preview).
 * Consumers overlay per-cell content (piece sprite, goal star, walls…) via the
 * `renderCell` render-prop and handle clicks via `onCellClick`.
 */
import type { CSSProperties, ReactNode } from "react";

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const RANKS = [8, 7, 6, 5, 4, 3, 2, 1]; // top → bottom

// Measured inner opening of borde-tablero-chesscito1.png (1040×1028).
export const BOARD_INSET = { top: 3.4, right: 3.56, bottom: 3.99, left: 3.65 };
export const BOARD_INNER_W = 100 - BOARD_INSET.left - BOARD_INSET.right; // 92.79
export const BOARD_INNER_H = 100 - BOARD_INSET.top - BOARD_INSET.bottom; // 92.61

const TILE_LIGHT = "/dev/tablero/casilla-clara.png";
const TILE_DARK = "/dev/tablero/casilla-oscura.png";
const BORDER = "/dev/tablero/borde-tablero-chesscito1.png";

const LABEL_STYLE: CSSProperties = {
  position: "absolute",
  fontSize: "1rem",
  fontWeight: 900,
  lineHeight: 1,
  color: "#d9f17e",
  WebkitTextStrokeWidth: "2px",
  WebkitTextStrokeColor: "#1c300a",
  paintOrder: "stroke",
  pointerEvents: "none",
  userSelect: "none",
};

export function isDarkSquare(file: number, rank: number): boolean {
  return (file + (8 - rank)) % 2 === 0;
}

export interface ProceduralBoardProps {
  /** Overlay content for a cell (markers, sprites). file 0–7, rank 1–8. */
  renderCell?: (file: number, rank: number, square: string) => ReactNode;
  /** Click handler — when set, cells become buttons. */
  onCellClick?: (file: number, rank: number, square: string) => void;
  showCoordinates?: boolean;
  darkColor?: string;
  lightColor?: string;
  /** Max board width (CSS). Default 23.5rem (390px mobile cap). */
  maxWidth?: string;
}

export function ProceduralBoard({
  renderCell,
  onCellClick,
  showCoordinates = true,
  darkColor = "#7fb24a",
  lightColor = "#efe6c4",
  maxWidth = "23.5rem",
}: ProceduralBoardProps) {
  const clickable = !!onCellClick;
  return (
    <div
      style={{
        width: `min(100%, ${maxWidth})`,
        aspectRatio: "1 / 1",
        position: "relative",
      }}
    >
      {/* 8×8 textured grid, inset to the frame opening (below the border) */}
      <div
        style={{
          position: "absolute",
          top: `${BOARD_INSET.top}%`,
          right: `${BOARD_INSET.right}%`,
          bottom: `${BOARD_INSET.bottom}%`,
          left: `${BOARD_INSET.left}%`,
          display: "grid",
          gridTemplateColumns: "repeat(8, 1fr)",
          gridTemplateRows: "repeat(8, 1fr)",
          zIndex: 1,
        }}
      >
        {RANKS.map((rank) =>
          FILES.map((file, col) => {
            const sq = `${file}${rank}`;
            const dark = isDarkSquare(col, rank);
            const cellStyle: CSSProperties = {
              position: "relative",
              padding: 0,
              border: "none",
              backgroundColor: dark ? darkColor : lightColor,
              backgroundImage: `url(${dark ? TILE_DARK : TILE_LIGHT})`,
              backgroundSize: "100% 100%",
              cursor: clickable ? "pointer" : "default",
            };
            const content = renderCell?.(col, rank, sq);
            return clickable ? (
              <button
                key={sq}
                type="button"
                onClick={() => onCellClick!(col, rank, sq)}
                title={sq}
                style={cellStyle}
              >
                {content}
              </button>
            ) : (
              <div key={sq} title={sq} style={cellStyle}>
                {content}
              </div>
            );
          }),
        )}
      </div>

      {/* Candy frame — supplied PNG, transparent center, on top */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={BORDER}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />

      {/* Coordinate labels ON the frame band */}
      {showCoordinates &&
        RANKS.map((rank, row) => (
          <span
            key={`rank-${rank}`}
            style={{
              ...LABEL_STYLE,
              left: `${BOARD_INSET.left / 2}%`,
              top: `${BOARD_INSET.top + (BOARD_INNER_H * (row + 0.5)) / 8}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 3,
            }}
          >
            {rank}
          </span>
        ))}
      {showCoordinates &&
        FILES.map((file, col) => (
          <span
            key={`file-${file}`}
            style={{
              ...LABEL_STYLE,
              left: `${BOARD_INSET.left + (BOARD_INNER_W * (col + 0.5)) / 8}%`,
              top: `${100 - BOARD_INSET.bottom / 2}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 3,
            }}
          >
            {file}
          </span>
        ))}
    </div>
  );
}
