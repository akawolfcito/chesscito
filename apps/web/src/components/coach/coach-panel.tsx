"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";
import { ARENA_COPY, COACH_COPY } from "@/lib/content/editorial";
import type { CoachResponse } from "@/lib/coach/types";
import { formatTime } from "@/lib/game/arena-utils";

type Props = {
  response: CoachResponse;
  difficulty: string;
  totalMoves: number;
  elapsedMs: number;
  credits: number;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  onViewHistory?: () => void;
};

export function CoachPanel({
  response,
  difficulty,
  totalMoves,
  elapsedMs,
  credits,
  onPlayAgain,
  onBackToHub,
  onViewHistory,
}: Props) {
  const time = formatTime(elapsedMs);
  const diffLabel = ARENA_COPY.difficulty[difficulty as keyof typeof ARENA_COPY.difficulty] ?? difficulty;

  return (
    <div className="flex flex-col gap-4 px-4 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="fantasy-title text-xl font-bold text-white">{COACH_COPY.coachAnalysisTitle}</h2>
        <span className="text-xs text-cyan-100/40">{credits} credits</span>
      </div>
      <p className="text-xs text-cyan-100/50">{diffLabel} - {totalMoves} moves - {time}</p>

      {/* Summary */}
      <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-sm italic text-cyan-100/70">{`"${response.summary}"`}</p>
      </div>

      {/* Key Moments */}
      {response.mistakes.length > 0 && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{COACH_COPY.keyMoments}</h3>
          <div className="flex flex-col gap-3">
            {response.mistakes.map((m) => (
              <div key={m.moveNumber} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <p className="text-xs font-semibold text-white/80">{COACH_COPY.moveLabel(m.moveNumber, m.played)}</p>
                <p className="text-xs font-semibold text-emerald-400/70">{COACH_COPY.tryInstead(m.better)}</p>
                <p className="mt-1 text-xs text-cyan-100/50">{`"${m.explanation}"`}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Takeaways — merged praise + lessons */}
      {(response.praise.length > 0 || response.lessons.length > 0) && (
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">{COACH_COPY.takeaways}</h3>
          <ul className="flex flex-col gap-1">
            {response.praise.map((p, i) => (
              <li key={`p-${i}`} className="text-sm text-cyan-100/60">{"\u2713"} {p}</li>
            ))}
            {response.lessons.map((l, i) => (
              <li key={`l-${i}`} className="text-sm text-cyan-100/60">{"\u2192"} {l}</li>
            ))}
          </ul>
        </section>
      )}

      {/* CTAs — Play Again primary, History secondary, Back to Hub tertiary */}
      <div className="mt-4 flex flex-col gap-2">
        <Button type="button" variant="game-primary" size="game" onClick={onPlayAgain}>
          <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {ARENA_COPY.playAgain}
        </Button>
        {onViewHistory && (
          <Button type="button" variant="game-ghost" size="game-sm" onClick={onViewHistory}>
            {COACH_COPY.pastSessions}
          </Button>
        )}
        <Button type="button" variant="game-text" size="game-sm" onClick={onBackToHub}>
          {ARENA_COPY.backToHub}
        </Button>
      </div>
    </div>
  );
}
