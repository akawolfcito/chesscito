"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";
import { ARENA_COPY, COACH_COPY } from "@/lib/content/editorial";
import type { BasicCoachResponse } from "@/lib/coach/types";
import { formatTime } from "@/lib/game/arena-utils";

type Props = {
  response: BasicCoachResponse;
  difficulty: string;
  totalMoves: number;
  elapsedMs: number;
  result: string;
  onGetFullAnalysis: () => void;
  onPlayAgain: () => void;
  onBackToHub: () => void;
};

export function CoachFallback({
  response,
  difficulty,
  totalMoves,
  elapsedMs,
  result,
  onGetFullAnalysis,
  onPlayAgain,
  onBackToHub,
}: Props) {
  const time = formatTime(elapsedMs);
  const diffLabel = ARENA_COPY.difficulty[difficulty as keyof typeof ARENA_COPY.difficulty] ?? difficulty;

  return (
    <div className="flex flex-col gap-4 px-4 pb-8">
      <h2 className="fantasy-title text-xl font-bold text-white">{COACH_COPY.quickReviewTitle}</h2>
      <p className="text-xs text-cyan-100/50">{diffLabel} - {totalMoves} moves - {result}</p>

      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-sm text-cyan-100/70">{response.summary}</p>
      </div>

      {response.tips.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{COACH_COPY.tips}</h3>
          <ul className="flex flex-col gap-1">
            {response.tips.map((t, i) => (
              <li key={i} className="text-sm text-cyan-100/60">- {t}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Primary: Play Again — retention first */}
      <Button type="button" variant="game-primary" size="game" onClick={onPlayAgain}>
        <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {ARENA_COPY.playAgain}
      </Button>

      {/* Secondary: Unlock Full Analysis — subtle upsell */}
      <Button
        type="button"
        variant="game-ghost"
        size="game-sm"
        onClick={onGetFullAnalysis}
        className="border-emerald-400/10 text-emerald-300/70"
      >
        {COACH_COPY.unlockFullAnalysis}
      </Button>

      {/* Tertiary: Back to Hub */}
      <Button type="button" variant="game-text" size="game-sm" onClick={onBackToHub}>
        {ARENA_COPY.backToHub}
      </Button>
    </div>
  );
}
