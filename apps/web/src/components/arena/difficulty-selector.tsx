"use client";

import { ARENA_COPY } from "@/lib/content/editorial";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { PaperPanel } from "@/components/redesign/paper-panel";
import type { ArenaDifficulty } from "@/lib/game/types";
import { Button } from "@/components/ui/button";

type Props = {
  selected: ArenaDifficulty;
  onSelect: (d: ArenaDifficulty) => void;
  onStart: () => void;
  onBack: () => void;
};

const LEVELS: { key: ArenaDifficulty; dot: string }[] = [
  { key: "easy", dot: "bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.45)]" },
  { key: "medium", dot: "bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.45)]" },
  { key: "hard", dot: "bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.45)]" },
];

export function DifficultySelector({ selected, onSelect, onStart, onBack }: Props) {
  return (
    <div className="relative w-full max-w-xs px-4 py-4">
      <PaperPanel
          ribbonTitle={ARENA_COPY.title}
          cta={
            <Button
              type="button"
              variant="game-primary"
              size="game"
              onClick={onStart}
              className="w-full shadow-[0_0_18px_rgba(34,211,238,0.25)]"
            >
              <CandyBanner name="btn-play" className="inline h-5 w-5 -mt-0.5" /> {ARENA_COPY.startMatch}
            </Button>
          }
          meta={
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800/80 underline underline-offset-2"
            >
              <CandyBanner name="btn-back" className="h-4 w-4" />
              {ARENA_COPY.backToHub}
            </button>
          }
        >
          <p className="text-center text-xs" style={{ color: "var(--paper-text-muted)" }}>
            {ARENA_COPY.subtitle}
          </p>

          <div className="flex flex-col gap-1.5">
            {LEVELS.map(({ key, dot }) => (
              <button
                key={key}
                type="button"
                onClick={() => onSelect(key)}
                className={[
                  "paper-tray flex items-center gap-2.5 !px-2.5 !py-2 text-left transition-all",
                  selected === key
                    ? "ring-2 ring-amber-500/60 shadow-[0_0_0_3px_rgba(245,158,11,0.15)]"
                    : "opacity-85 hover:opacity-100",
                ].join(" ")}
              >
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-bold" style={{ color: "var(--paper-text)" }}>
                    {ARENA_COPY.difficulty[key]}
                  </span>
                  <p
                    className="text-[0.7rem] leading-snug truncate"
                    style={{ color: "var(--paper-text-muted)" }}
                  >
                    {ARENA_COPY.difficultyDesc[key]}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </PaperPanel>
    </div>
  );
}
