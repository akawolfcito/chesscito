"use client";

import type { SquareState } from "@/lib/game/types";
import { cn } from "@/lib/utils";

type BoardSquareProps = {
  square: SquareState;
  onPress: (label: string) => void;
};

export function BoardSquare({ square, onPress }: BoardSquareProps) {
  return (
    <button
      type="button"
      onClick={() => onPress(square.label)}
      className={cn(
        "relative aspect-square w-full rounded-xl border text-left transition-transform active:scale-[0.98]",
        square.isDark
          ? "border-slate-300 bg-slate-300/90 text-slate-900"
          : "border-emerald-100 bg-emerald-50 text-slate-900",
        square.isHighlighted && "ring-2 ring-primary/80 ring-offset-1",
        square.isSelected && "border-primary bg-primary/10 ring-2 ring-primary/30"
      )}
      aria-label={`Square ${square.label}`}
    >
      <span className="absolute left-2 top-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {square.label}
      </span>
      {square.isHighlighted ? (
        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-primary" />
      ) : null}
      {square.piece ? (
        <span className="flex h-full items-center justify-center text-3xl" aria-hidden="true">
          ♖
        </span>
      ) : null}
    </button>
  );
}
