"use client";

import { useEffect, useMemo, useState } from "react";

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

type Point = { x: number; y: number };

// Corners calibrated from bg-with-grid.png pixel analysis (% of 1011×934 canvas)
const BOARD_TOP_LEFT: Point = { x: 11.6, y: 1.4 };
const BOARD_TOP_RIGHT: Point = { x: 88.2, y: 1.4 };
const BOARD_BOTTOM_LEFT: Point = { x: 0.1, y: 98.2 };
const BOARD_BOTTOM_RIGHT: Point = { x: 99.2, y: 98.2 };

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

// Gamma > 1 compresses top rows to match board perspective foreshortening
const BOARD_V_GAMMA = 1.15;

function interpolateQuad(u: number, v: number): Point {
  const vg = Math.pow(v, BOARD_V_GAMMA);
  return {
    x: lerp(lerp(BOARD_TOP_LEFT.x, BOARD_TOP_RIGHT.x, u), lerp(BOARD_BOTTOM_LEFT.x, BOARD_BOTTOM_RIGHT.x, u), vg),
    y: lerp(lerp(BOARD_TOP_LEFT.y, BOARD_TOP_RIGHT.y, u), lerp(BOARD_BOTTOM_LEFT.y, BOARD_BOTTOM_RIGHT.y, u), vg),
  };
}

type BoardProps = {
  mode?: "tutorial" | "practice";
  targetPosition?: BoardPosition | null;
  isLocked?: boolean;
  onMove?: (position: BoardPosition) => void;
};

export function Board({
  mode = "practice",
  targetPosition = null,
  isLocked = false,
  onMove,
}: BoardProps) {
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
        targetPosition,
      }),
    [piece, selectedPosition, targetPosition, validTargets]
  );

  const handleSquarePress = (label: string) => {
    if (mode !== "practice" || isLocked) {
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
      onMove?.(nextPosition);
      return;
    }

    setSelectedPosition(null);
  };

  return (
    <div className="space-y-4">
      <div className="playhub-stage-shell">
        <div className="playhub-game-stage">
          <div className="playhub-game-grid">
            <div className="playhub-board-canvas">
              <div className="playhub-board-hitgrid" role="grid" aria-label="Chess board">
                {squares.map((square) =>
                  (() => {
                    const row = 7 - square.rank;
                    const col = square.file;
                    const u0 = col / 8;
                    const u1 = (col + 1) / 8;
                    const v0 = row / 8;
                    const v1 = (row + 1) / 8;
                    const p00 = interpolateQuad(u0, v0);
                    const p10 = interpolateQuad(u1, v0);
                    const p01 = interpolateQuad(u0, v1);
                    const p11 = interpolateQuad(u1, v1);
                    const minX = Math.min(p00.x, p10.x, p01.x, p11.x);
                    const maxX = Math.max(p00.x, p10.x, p01.x, p11.x);
                    const minY = Math.min(p00.y, p10.y, p01.y, p11.y);
                    const maxY = Math.max(p00.y, p10.y, p01.y, p11.y);
                    const cW = maxX - minX || 0.01;
                    const cH = maxY - minY || 0.01;

                    function relPt(pt: Point) {
                      return `${(((pt.x - minX) / cW) * 100).toFixed(1)}% ${(((pt.y - minY) / cH) * 100).toFixed(1)}%`;
                    }

                    const clipPath = `polygon(${relPt(p00)}, ${relPt(p10)}, ${relPt(p11)}, ${relPt(p01)})`;

                    return (
                      <button
                        key={square.label}
                        type="button"
                        role="gridcell"
                        aria-label={`Square ${square.label}`}
                        onClick={() => handleSquarePress(square.label)}
                        style={{
                          left: `${minX}%`,
                          top: `${minY}%`,
                          width: `${cW}%`,
                          height: `${cH}%`,
                          clipPath,
                        }}
                        className={[
                          "playhub-board-cell",
                          square.isHighlighted ? "is-highlighted" : "",
                          square.isSelected ? "is-selected" : "",
                        ].join(" ")}
                      >
                        <span className="playhub-board-label">{square.label}</span>
                        {square.isHighlighted ? <span className="playhub-board-dot" /> : null}
                        {square.isTarget && !square.piece ? (
                          <span className="playhub-board-target">◎</span>
                        ) : null}
                        {square.piece ? <span className="playhub-board-piece">♖</span> : null}
                      </button>
                    );
                  })()
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-950 px-4 py-4 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-white/60">Piece</p>
          <p className="mt-2 text-lg font-semibold">Torre</p>
          <p className="mt-1 text-sm text-white/75">
            {mode === "tutorial"
              ? "Las flechas verdes marcan la fila y la columna completas."
              : targetPosition
                ? "Selecciona la Torre y captura el objetivo en un solo movimiento."
                : "Toca la pieza para ver movimientos legales."}
          </p>
        </div>
        <div className="rounded-2xl bg-slate-100 px-4 py-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
            {mode === "tutorial" ? "Tutorial state" : targetPosition ? "Target square" : "Current square"}
          </p>
          <p className="mt-2 text-lg font-semibold text-slate-950">
            {mode === "tutorial"
              ? "Trayectorias activas"
              : targetPosition
                ? getPositionLabel(targetPosition)
                : getPositionLabel(piece.position)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {mode === "tutorial"
              ? "Pulsa Probar para convertir estas trayectorias en movimiento interactivo."
              : targetPosition
                ? "El circulo marca la captura objetivo."
                : "Toca una casilla marcada para mover la Torre."}
          </p>
        </div>
      </div>
    </div>
  );
}
