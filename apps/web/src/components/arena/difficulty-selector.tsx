"use client";

import { ArrowLeft, Play } from "lucide-react";
import { ARENA_COPY } from "@/lib/content/editorial";
import type { ArenaDifficulty } from "@/lib/game/types";
import { Button } from "@/components/ui/button";

type Props = {
  selected: ArenaDifficulty;
  onSelect: (d: ArenaDifficulty) => void;
  onStart: () => void;
  onBack: () => void;
};

const LEVELS: { key: ArenaDifficulty; dot: string }[] = [
  { key: "easy", dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" },
  { key: "medium", dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" },
  { key: "hard", dot: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]" },
];

export function DifficultySelector({ selected, onSelect, onStart, onBack }: Props) {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-8">
      <div className="w-full max-w-[320px] rounded-3xl border border-white/[0.08] bg-[var(--surface-b-plus)] px-6 pb-6 pt-8 backdrop-blur-2xl shadow-[0_0_60px_rgba(20,184,166,0.08)]">
        <div className="flex flex-col items-center gap-2 mb-5">
          <h1 className="fantasy-title text-3xl font-bold text-white drop-shadow-[0_0_12px_rgba(103,232,249,0.3)]">
            {ARENA_COPY.title}
          </h1>
          <p className="text-sm text-cyan-200/50">{ARENA_COPY.subtitle}</p>
        </div>

        <div className="flex flex-col gap-2.5 mb-4">
          {LEVELS.map(({ key, dot }) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={[
                "flex items-center gap-3.5 rounded-2xl px-5 py-3.5 text-left transition-all",
                selected === key
                  ? "bg-white/[0.12] ring-2 ring-cyan-400/50 shadow-[0_0_20px_rgba(103,232,249,0.1)]"
                  : "bg-white/[0.05] hover:bg-white/[0.08]",
              ].join(" ")}
            >
              <span className={`h-3 w-3 shrink-0 rounded-full ${dot}`} />
              <div>
                <span className="font-semibold text-white">
                  {ARENA_COPY.difficulty[key]}
                </span>
                <p className="text-xs text-white/45 leading-relaxed">
                  {ARENA_COPY.difficultyDesc[key]}
                </p>
              </div>
            </button>
          ))}
        </div>

        <Button
          type="button"
          variant="game-primary"
          size="game"
          onClick={onStart}
          className="shadow-[0_0_24px_rgba(34,211,238,0.25)] hover:shadow-[0_0_32px_rgba(34,211,238,0.4)]"
        >
          <Play size={18} className="inline -mt-0.5" fill="currentColor" /> {ARENA_COPY.startMatch}
        </Button>
      </div>

      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-white/35 transition-colors hover:text-white/55"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.05]">
          <ArrowLeft className="h-4 w-4" />
        </span>
        {ARENA_COPY.backToHub}
      </button>
    </div>
  );
}
