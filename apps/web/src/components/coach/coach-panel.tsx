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
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="fantasy-title text-xl font-bold" style={{ color: "var(--paper-text)" }}>
          {COACH_COPY.coachAnalysisTitle}
        </h2>
        <span className="text-xs" style={{ color: "var(--paper-text-subtle)" }}>{credits} credits</span>
      </div>
      <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
        {diffLabel} - {totalMoves} moves - {time}
      </p>

      {/* Summary */}
      <div className="paper-tray">
        <p className="text-sm italic" style={{ color: "var(--paper-text)" }}>
          {`"${response.summary}"`}
        </p>
      </div>

      {/* Key Moments */}
      {response.mistakes.length > 0 && (
        <section>
          <h3
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {COACH_COPY.keyMoments}
          </h3>
          <div className="flex flex-col gap-3">
            {response.mistakes.map((m) => (
              <div key={m.moveNumber} className="paper-tray">
                <p className="text-xs font-semibold" style={{ color: "var(--paper-text)" }}>
                  {COACH_COPY.moveLabel(m.moveNumber, m.played)}
                </p>
                <p className="text-xs font-semibold text-emerald-700">
                  {COACH_COPY.tryInstead(m.better)}
                </p>
                <p className="mt-1 text-xs" style={{ color: "var(--paper-text-muted)" }}>
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
            style={{ color: "var(--paper-text-muted)" }}
          >
            {COACH_COPY.takeaways}
          </h3>
          <ul className="flex flex-col gap-1">
            {response.praise.map((p, i) => (
              <li key={`p-${i}`} className="text-sm" style={{ color: "var(--paper-text)" }}>
                {"\u2713"} {p}
              </li>
            ))}
            {response.lessons.map((l, i) => (
              <li key={`l-${i}`} className="text-sm" style={{ color: "var(--paper-text)" }}>
                {"\u2192"} {l}
              </li>
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
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            onClick={onViewHistory}
            style={{
              borderColor: "rgba(110, 65, 15, 0.25)",
              color: "var(--paper-text-muted)",
            }}
          >
            {COACH_COPY.pastSessions}
          </Button>
        )}
        <Button
          type="button"
          variant="game-text"
          size="game-sm"
          onClick={onBackToHub}
          style={{ color: "var(--paper-text-muted)" }}
        >
          {ARENA_COPY.backToHub}
        </Button>
      </div>
    </div>
  );
}
