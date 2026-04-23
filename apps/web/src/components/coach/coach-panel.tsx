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
  const warmText = "rgba(63, 34, 8, 0.95)";
  const warmMuted = "rgba(110, 65, 15, 0.75)";
  const warmSubtle = "rgba(110, 65, 15, 0.55)";
  const cream = "0 1px 0 rgba(255, 245, 215, 0.55)";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs" style={{ color: warmMuted }}>
          {diffLabel} - {totalMoves} moves - {time}
        </p>
        <span className="text-xs font-semibold" style={{ color: warmSubtle }}>
          {credits} credits
        </span>
      </div>

      {/* Summary */}
      <div className="candy-tray">
        <p className="text-sm italic" style={{ color: warmText, textShadow: cream }}>
          {`"${response.summary}"`}
        </p>
      </div>

      {/* Key Moments */}
      {response.mistakes.length > 0 && (
        <section>
          <h3
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: warmMuted }}
          >
            {COACH_COPY.keyMoments}
          </h3>
          <div className="flex flex-col gap-3">
            {response.mistakes.map((m) => (
              <div key={m.moveNumber} className="candy-tray">
                <p className="text-xs font-semibold" style={{ color: warmText, textShadow: cream }}>
                  {COACH_COPY.moveLabel(m.moveNumber, m.played)}
                </p>
                <p className="text-xs font-semibold text-emerald-700">
                  {COACH_COPY.tryInstead(m.better)}
                </p>
                <p className="mt-1 text-xs" style={{ color: warmMuted }}>
                  {`"${m.explanation}"`}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Takeaways — merged praise + lessons */}
      {(response.praise.length > 0 || response.lessons.length > 0) && (
        <section>
          <h3
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: warmMuted }}
          >
            {COACH_COPY.takeaways}
          </h3>
          <ul className="flex flex-col gap-1">
            {response.praise.map((p, i) => (
              <li key={`p-${i}`} className="text-sm" style={{ color: warmText, textShadow: cream }}>
                {"\u2713"} {p}
              </li>
            ))}
            {response.lessons.map((l, i) => (
              <li key={`l-${i}`} className="text-sm" style={{ color: warmText, textShadow: cream }}>
                {"\u2192"} {l}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* CTAs — Play Again primary, History secondary, Back to Hub tertiary */}
      <div className="mt-2 flex flex-col gap-2">
        <Button type="button" variant="game-primary" size="game" onClick={onPlayAgain}>
          <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {ARENA_COPY.playAgain}
        </Button>
        {onViewHistory && (
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            onClick={onViewHistory}
            style={{
              borderColor: "rgba(110, 65, 15, 0.25)",
              color: warmMuted,
            }}
          >
            {COACH_COPY.pastSessions}
          </Button>
        )}
        <button
          type="button"
          onClick={onBackToHub}
          className="w-full py-1 text-xs font-semibold underline underline-offset-2"
          style={{ color: "rgba(110, 65, 15, 0.70)" }}
        >
          {ARENA_COPY.backToHub}
        </button>
      </div>
    </div>
  );
}
