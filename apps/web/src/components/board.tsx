"use client";

import { useEffect, useMemo, useState } from "react";

import { BoardSquare } from "@/components/board-square";
import {
  INITIAL_ROOK,
  arePositionsEqual,
  buildBoardSquares,
  getPositionLabel,
  getRookTargets,
  movePiece,
} from "@/lib/game/board";
import type { BoardPosition } from "@/lib/game/types";

function parseLabel(label: string): BoardPosition {
  const file = label.charCodeAt(0) - 97;
  const rank = Number(label.slice(1)) - 1;

  return { file, rank };
}

type BoardProps = {
  mode?: "tutorial" | "practice";
};

export function Board({ mode = "practice" }: BoardProps) {
  const [piece, setPiece] = useState(INITIAL_ROOK);
  const [selectedPosition, setSelectedPosition] = useState<BoardPosition | null>(
    mode === "tutorial" ? INITIAL_ROOK.position : null
  );

  useEffect(() => {
    setSelectedPosition(mode === "tutorial" ? piece.position : null);
  }, [mode, piece.position]);

  const validTargets = useMemo(() => {
    if (!selectedPosition) {
      return [];
    }

    return getRookTargets(selectedPosition);
  }, [selectedPosition]);

  const squares = useMemo(
    () =>
      buildBoardSquares({
        selectedPosition,
        piece,
        validTargets,
      }),
    [piece, selectedPosition, validTargets]
  );

  const handleSquarePress = (label: string) => {
    if (mode !== "practice") {
      return;
    }

    const nextPosition = parseLabel(label);
    const piecePosition = piece.position;

    if (arePositionsEqual(piecePosition, nextPosition)) {
      setSelectedPosition((current) => (current ? null : piecePosition));
      return;
    }

    const canMove = validTargets.some((target) => arePositionsEqual(target, nextPosition));

    if (canMove) {
      setPiece((current) => movePiece(current, nextPosition));
      setSelectedPosition(null);
      return;
    }

    setSelectedPosition(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[28px] border border-slate-200 bg-white p-3 shadow-[0_24px_48px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-8 gap-2">
          {squares.map((square) => (
            <BoardSquare
              key={square.label}
              square={square}
              onPress={handleSquarePress}
            />
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">Piece</p>
          <p className="mt-2 text-lg font-semibold">Torre</p>
          <p className="mt-1 text-sm text-white/75">
            {mode === "tutorial"
              ? "Las flechas verdes marcan la fila y la columna completas."
              : "Toca la pieza para ver movimientos legales."}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {mode === "tutorial" ? "Tutorial state" : "Current square"}
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {mode === "tutorial" ? "Trayectorias activas" : getPositionLabel(piece.position)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {mode === "tutorial"
              ? "Pulsa Probar para convertir estas trayectorias en movimiento interactivo."
              : "Toca una casilla marcada para mover la Torre."}
          </p>
        </div>
      </div>
    </div>
  );
}
