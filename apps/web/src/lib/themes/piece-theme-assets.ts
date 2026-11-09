import type { ChessPieceId, PieceColor } from "@/lib/game/types";

import type { ThemeAssetKey } from "./theme-registry";
import { useCurrentThemeAssets } from "./use-current-theme-asset";

export const PIECE_THEME_SLOTS = {
  w: {
    rook: "board.piece.white.rook",
    bishop: "board.piece.white.bishop",
    knight: "board.piece.white.knight",
    pawn: "board.piece.white.pawn",
    queen: "board.piece.white.queen",
    king: "board.piece.white.king",
  },
  b: {
    rook: "board.piece.black.rook",
    bishop: "board.piece.black.bishop",
    knight: "board.piece.black.knight",
    pawn: "board.piece.black.pawn",
    queen: "board.piece.black.queen",
    king: "board.piece.black.king",
  },
} as const satisfies Record<PieceColor, Record<ChessPieceId, ThemeAssetKey>>;

const PIECE_SLOT_LIST = Object.values(PIECE_THEME_SLOTS).flatMap((color) =>
  Object.values(color),
);

export function pieceThemeSlot(
  color: PieceColor,
  piece: ChessPieceId,
): ThemeAssetKey {
  return PIECE_THEME_SLOTS[color][piece];
}

export function useThemePieceAssets(): Record<
  PieceColor,
  Record<ChessPieceId, string>
> {
  const assets = useCurrentThemeAssets(PIECE_SLOT_LIST);
  return {
    w: {
      rook: assets[PIECE_THEME_SLOTS.w.rook],
      bishop: assets[PIECE_THEME_SLOTS.w.bishop],
      knight: assets[PIECE_THEME_SLOTS.w.knight],
      pawn: assets[PIECE_THEME_SLOTS.w.pawn],
      queen: assets[PIECE_THEME_SLOTS.w.queen],
      king: assets[PIECE_THEME_SLOTS.w.king],
    },
    b: {
      rook: assets[PIECE_THEME_SLOTS.b.rook],
      bishop: assets[PIECE_THEME_SLOTS.b.bishop],
      knight: assets[PIECE_THEME_SLOTS.b.knight],
      pawn: assets[PIECE_THEME_SLOTS.b.pawn],
      queen: assets[PIECE_THEME_SLOTS.b.queen],
      king: assets[PIECE_THEME_SLOTS.b.king],
    },
  };
}
