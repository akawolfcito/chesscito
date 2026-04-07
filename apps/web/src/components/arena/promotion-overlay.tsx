"use client";

import { ARENA_COPY, PIECE_LABELS } from "@/lib/content/editorial";
import { ARENA_PIECE_IMG } from "@/lib/game/arena-utils";

type PromotionChoice = "q" | "r" | "b" | "n";

type Props = {
  onSelect: (piece: PromotionChoice) => void;
  onCancel: () => void;
};

const CHOICES: { key: PromotionChoice; label: string }[] = [
  { key: "q", label: PIECE_LABELS.queen },
  { key: "r", label: PIECE_LABELS.rook },
  { key: "b", label: PIECE_LABELS.bishop },
  { key: "n", label: PIECE_LABELS.knight },
];

const PIECE_KEY_MAP: Record<PromotionChoice, keyof typeof ARENA_PIECE_IMG.w> = {
  q: "queen",
  r: "rook",
  b: "bishop",
  n: "knight",
};

export function PromotionOverlay({ onSelect, onCancel }: Props) {
  return (
    <div
      className="absolute inset-0 z-30 flex items-center justify-center bg-[var(--overlay-scrim)]"
      onClick={onCancel}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className="flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-[var(--surface-frosted)] p-5 backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold text-white/80">
          {ARENA_COPY.promotionTitle}
        </p>
        <div className="flex gap-3">
          {CHOICES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className="flex flex-col items-center gap-1 rounded-xl bg-white/10 p-3 transition-all hover:bg-white/20 active:scale-95"
            >
              <picture>
                <source
                  srcSet={ARENA_PIECE_IMG.w[PIECE_KEY_MAP[key]].replace(".png", ".avif")}
                  type="image/avif"
                />
                <source
                  srcSet={ARENA_PIECE_IMG.w[PIECE_KEY_MAP[key]].replace(".png", ".webp")}
                  type="image/webp"
                />
                <img
                  src={ARENA_PIECE_IMG.w[PIECE_KEY_MAP[key]]}
                  alt={label}
                  className="h-12 w-12 object-contain"
                />
              </picture>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
