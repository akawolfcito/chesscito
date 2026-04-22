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
    <div className="flex flex-col gap-4">
      <h2 className="fantasy-title text-xl font-bold" style={{ color: "var(--paper-text)" }}>
        {COACH_COPY.quickReviewTitle}
      </h2>
      <p className="text-xs" style={{ color: "var(--paper-text-muted)" }}>
        {diffLabel} - {totalMoves} moves - {result}
      </p>

      <div className="paper-tray">
        <p className="text-sm" style={{ color: "var(--paper-text)" }}>{response.summary}</p>
      </div>

      {response.tips.length > 0 && (
        <section>
          <h3
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {COACH_COPY.tips}
          </h3>
          <ul className="flex flex-col gap-1">
            {response.tips.map((t, i) => (
              <li key={i} className="text-sm" style={{ color: "var(--paper-text)" }}>- {t}</li>
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
        style={{
          borderColor: "rgba(110, 65, 15, 0.25)",
          color: "var(--paper-text-muted)",
        }}
      >
        {COACH_COPY.unlockFullAnalysis}
      </Button>

      {/* Tertiary: Back to Hub */}
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
  );
}
