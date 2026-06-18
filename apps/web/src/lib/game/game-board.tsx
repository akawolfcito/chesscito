"use client";

/**
 * GameBoard — programmatic chess board (no background image).
 *
 * Promoted from the dev PoC (`app/dev/_components/procedural-board.tsx`) into
 * the prod path (db-content board-procedural-migration, Phase 0). The 8×8
 * textured tiles ARE the board (CSS grid), so cell alignment is guaranteed by
 * construction; a candy-frame PNG (transparent center) overlays on top with the
 * grid inset to its measured opening; coordinates ride the frame band.
 *
 * Phase 0 is a behavior-preserving move + a11y (role=grid) + asset relocation to
 * `/art/board` (png+webp+avif via image-set). No surface consumes it yet — the
 * exercise/arena/thumbnail boards migrate per-surface, flag-gated, in later
 * phases (orientation + an absolute overlay layer land with their first real
 * consumer). The dev PoC + labyrinth-builder import it today.
 *
 * NOTE (placeholders): the tiles + frame are dev-grade placeholders; surfaces
 * stay on the image board until final art lands (founder 2026-06-17).
 */
import type { CSSProperties, ReactNode } from "react";

import { cellCenter, pieceWidth } from "@/lib/game/board-geometry";

export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
export const RANKS = [8, 7, 6, 5, 4, 3, 2, 1]; // top → bottom

// Measured inner opening of borde-tablero-chesscito1.png (1040×1028).
export const BOARD_INSET = { top: 3.4, right: 3.56, bottom: 3.99, left: 3.65 };
export const BOARD_INNER_W = 100 - BOARD_INSET.left - BOARD_INSET.right; // 92.79
export const BOARD_INNER_H = 100 - BOARD_INSET.top - BOARD_INSET.bottom; // 92.61

const ASSET = "/art/board";

/** One cached image-set per tile color (avif → webp → png), not 64 requests. */
function tileImageSet(name: string): string {
  return [
    `url("${ASSET}/${name}.avif") type("image/avif")`,
    `url("${ASSET}/${name}.webp") type("image/webp")`,
    `url("${ASSET}/${name}.png") type("image/png")`,
  ].join(", ");
}
const TILE_LIGHT = tileImageSet("casilla-clara");
const TILE_DARK = tileImageSet("casilla-oscura");

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

/** Per-surface overlay inset (red-team P0 piece-drift). The overlay region is
 *  NOT one global inset — each surface passes its own so pieces don't drift when
 *  its framing differs (the thumbnail inset is asymmetric today). Defaults to the
 *  frame opening BOARD_INSET. */
export type OverlayInset = { top: number; right: number; bottom: number; left: number };

export interface BoardOverlayGeometry {
  /** Center of a logical cell as % of the OVERLAY region. file 0–7, rank 1–8
   *  (chess rank). Mirrors the existing `cellCenter(file, rank - 1)` contract so
   *  pieces/floats positioned via this helper land on the same cell as today. */
  center(file: number, rank: number): { leftPct: number; topPct: number };
  /** Cell edge length as % of the region (uniform 12.5% grid). */
  cellSizePct: number;
  /** Piece width as % of the region (from board-geometry, not re-hardcoded). */
  pieceWidthPct: number;
}

export interface GameBoardProps {
  /** Board orientation. "white" = a8 top-left / h1 bottom-right (default);
   *  "black" flips both axes (arena, when the player is black). renderCell /
   *  onCellClick still receive LOGICAL (file, rank) regardless. */
  orientation?: "white" | "black";
  /** Overlay content for a cell (markers, sprites). file 0–7, rank 1–8. */
  renderCell?: (file: number, rank: number, square: string) => ReactNode;
  /** Absolute overlay layer (pieces, capture floats, select hints) positioned
   *  via the supplied geometry against the frame-opening inset region. Renders
   *  above the tiles, below the candy frame. */
  renderOverlay?: (geo: BoardOverlayGeometry) => ReactNode;
  /** Inset for the overlay region (default BOARD_INSET = frame opening). */
  overlayInset?: OverlayInset;
  /** Click handler — when set, cells become buttons. */
  onCellClick?: (file: number, rank: number, square: string) => void;
  showCoordinates?: boolean;
  darkColor?: string;
  lightColor?: string;
  /** Max board width (CSS). Default 23.5rem (390px mobile cap). */
  maxWidth?: string;
}

export function GameBoard({
  renderCell,
  renderOverlay,
  overlayInset = BOARD_INSET,
  onCellClick,
  orientation = "white",
  showCoordinates = true,
  darkColor = "#7fb24a",
  lightColor = "#efe6c4",
  maxWidth = "23.5rem",
}: GameBoardProps) {
  const clickable = !!onCellClick;
  const black = orientation === "black";

  // View order (what the grid draws), in LOGICAL terms. White: a8 top-left,
  // h1 bottom-right. Black flips both axes (h1 top-left, a8 bottom-right) —
  // parity with the arena `vf = 7 - file` / `vr = 7 - rank` flip. renderCell /
  // onCellClick still receive LOGICAL (file, rank); only the layout changes.
  const fileOrder = black ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7]; // left → right
  const rankOrder = black ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1]; // top → bottom

  const overlayGeometry: BoardOverlayGeometry = {
    // rank is the chess rank (1–8). White reuses cellCenter(file, rank - 1);
    // black flips view coords (7 - file, 7 - rankIdx) so pieces track the tiles.
    center(file, rank) {
      const rankIdx = rank - 1;
      const vf = black ? 7 - file : file;
      const vr = black ? 7 - rankIdx : rankIdx;
      const { x, y } = cellCenter(vf, vr);
      return { leftPct: x, topPct: y };
    },
    cellSizePct: 12.5,
    pieceWidthPct: pieceWidth(),
  };
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
        role="grid"
        aria-label="Chess board"
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
        {rankOrder.map((rank) =>
          fileOrder.map((file) => {
            const sq = `${FILES[file]}${rank}`;
            const dark = isDarkSquare(file, rank);
            const cellStyle: CSSProperties = {
              position: "relative",
              padding: 0,
              border: "none",
              backgroundColor: dark ? darkColor : lightColor,
              backgroundImage: dark ? TILE_DARK : TILE_LIGHT,
              backgroundSize: "100% 100%",
              cursor: clickable ? "pointer" : "default",
            };
            const content = renderCell?.(file, rank, sq);
            // a11y parity with the image board: cells are gridcells named
            // "Square a1" (not bare "a1") so screen readers + consumer tests
            // see no regression when a surface flips onto this substrate.
            const cellLabel = `Square ${sq}`;
            return clickable ? (
              <button
                key={sq}
                type="button"
                role="gridcell"
                onClick={() => onCellClick!(file, rank, sq)}
                aria-label={cellLabel}
                title={sq}
                // Drag-to-move drop resolution walks up from elementFromPoint to
                // the nearest [data-square]; expose it so overlay pieces resolve.
                data-square={sq}
                style={cellStyle}
              >
                {content}
              </button>
            ) : (
              <div
                key={sq}
                role="gridcell"
                aria-label={cellLabel}
                title={sq}
                data-square={sq}
                style={cellStyle}
              >
                {content}
              </div>
            );
          }),
        )}
      </div>

      {/* Candy frame — supplied PNG (transparent center). Sits ABOVE the tiles
          (z1) but BELOW the overlay pieces (z4), mirroring the old image board
          where pieces painted on top of the (baked-in) frame — so a piece on an
          edge rank/file overhangs the border instead of being clipped by it. */}
      <picture>
        <source srcSet={`${ASSET}/borde-tablero-chesscito1.avif`} type="image/avif" />
        <source srcSet={`${ASSET}/borde-tablero-chesscito1.webp`} type="image/webp" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${ASSET}/borde-tablero-chesscito1.png`}
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
      </picture>

      {/* Absolute overlay layer (pieces, capture floats, select hints) — inset
          to the same frame opening as the grid so cellCenter percentages
          resolve identically. ABOVE the tiles, frame, and labels (z4) so pieces
          are never clipped by the border. */}
      {renderOverlay && (
        <div
          style={{
            position: "absolute",
            top: `${overlayInset.top}%`,
            right: `${overlayInset.right}%`,
            bottom: `${overlayInset.bottom}%`,
            left: `${overlayInset.left}%`,
            zIndex: 4,
            pointerEvents: "none",
          }}
        >
          {renderOverlay(overlayGeometry)}
        </div>
      )}

      {/* Coordinate labels ON the frame band — follow the view order so they
          flip with the board under orientation="black". */}
      {showCoordinates &&
        rankOrder.map((rank, row) => (
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
        fileOrder.map((file, col) => (
          <span
            key={`file-${FILES[file]}`}
            style={{
              ...LABEL_STYLE,
              left: `${BOARD_INSET.left + (BOARD_INNER_W * (col + 0.5)) / 8}%`,
              top: `${100 - BOARD_INSET.bottom / 2}%`,
              transform: "translate(-50%, -50%)",
              zIndex: 3,
            }}
          >
            {FILES[file]}
          </span>
        ))}
    </div>
  );
}
