"use client";

import Link from "next/link";
import { ARENA_COPY } from "@/lib/content/editorial";
import type { ArenaDifficulty } from "@/lib/game/types";

type Props = {
  selected: ArenaDifficulty;
  onSelect: (d: ArenaDifficulty) => void;
  onStart: () => void;
};

const LEVELS: { key: ArenaDifficulty; dot: string }[] = [
  { key: "easy", dot: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" },
  { key: "medium", dot: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]" },
  { key: "hard", dot: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.5)]" },
];

export function DifficultySelector({ selected, onSelect, onStart }: Props) {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-8">
      <div className="flex flex-col items-center gap-2">
        <h1 className="fantasy-title text-3xl font-bold text-white drop-shadow-[0_0_12px_rgba(103,232,249,0.3)]">
          {ARENA_COPY.title}
        </h1>
        <p className="text-sm text-cyan-200/50">{ARENA_COPY.subtitle}</p>
      </div>

      <div className="flex w-full max-w-[320px] flex-col gap-2.5">
        {LEVELS.map(({ key, dot }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={[
              "flex items-center gap-3.5 rounded-2xl px-5 py-3.5 text-left transition-all",
              selected === key
                ? "bg-white/12 ring-2 ring-cyan-400/50 shadow-[0_0_20px_rgba(103,232,249,0.1)]"
                : "bg-white/5 hover:bg-white/8",
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

      <button
        type="button"
        onClick={onStart}
        className="mt-1 w-full max-w-[320px] rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 py-3.5 font-bold text-white shadow-[0_0_24px_rgba(34,211,238,0.25)] transition-all hover:shadow-[0_0_32px_rgba(34,211,238,0.4)] active:scale-[0.97]"
      >
        {ARENA_COPY.startMatch}
      </button>

      <Link
        href="/play-hub"
        className="mt-1 text-sm text-white/35 transition-colors hover:text-white/55"
      >
        ← {ARENA_COPY.backToHub}
      </Link>
    </div>
  );
}
