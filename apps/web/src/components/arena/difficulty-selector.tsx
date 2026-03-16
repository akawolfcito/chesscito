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
  { key: "easy", dot: "bg-emerald-400" },
  { key: "medium", dot: "bg-amber-400" },
  { key: "hard", dot: "bg-rose-400" },
];

export function DifficultySelector({ selected, onSelect, onStart }: Props) {
  return (
    <div className="flex flex-col items-center gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold text-white">{ARENA_COPY.title}</h1>
      <p className="text-sm text-white/60">{ARENA_COPY.subtitle}</p>

      <div className="flex w-full max-w-[320px] flex-col gap-3">
        {LEVELS.map(({ key, dot }) => (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={[
              "flex items-center gap-3 rounded-xl px-4 py-3 text-left transition-all",
              selected === key
                ? "bg-white/15 ring-2 ring-cyan-400/60"
                : "bg-white/5 hover:bg-white/10",
            ].join(" ")}
          >
            <span className={`h-3 w-3 rounded-full ${dot}`} />
            <div>
              <span className="font-semibold text-white">
                {ARENA_COPY.difficulty[key]}
              </span>
              <p className="text-xs text-white/50">
                {ARENA_COPY.difficultyDesc[key]}
              </p>
            </div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="mt-2 w-full max-w-[320px] rounded-xl bg-cyan-500 py-3 font-bold text-white transition-all hover:bg-cyan-400 active:scale-95"
      >
        {ARENA_COPY.startMatch}
      </button>

      <Link
        href="/play-hub"
        className="text-sm text-white/40 transition-colors hover:text-white/60"
      >
        ← {ARENA_COPY.backToHub}
      </Link>
    </div>
  );
}
