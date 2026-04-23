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

  const warmText = "rgba(63, 34, 8, 0.95)";
  const warmMuted = "rgba(110, 65, 15, 0.75)";
  const cream = "0 1px 0 rgba(255, 245, 215, 0.55)";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs" style={{ color: warmMuted }}>
        {diffLabel} - {totalMoves} moves - {result}
      </p>

      <div className="candy-tray">
        <p className="text-sm" style={{ color: warmText, textShadow: cream }}>{response.summary}</p>
      </div>

      {response.tips.length > 0 && (
        <section>
          <h3
            className="mb-2 text-xs font-semibold uppercase tracking-widest"
            style={{ color: warmMuted }}
          >
            {COACH_COPY.tips}
          </h3>
          <ul className="flex flex-col gap-1">
            {response.tips.map((t, i) => (
              <li key={i} className="text-sm" style={{ color: warmText, textShadow: cream }}>- {t}</li>
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
          color: warmMuted,
        }}
      >
        {COACH_COPY.unlockFullAnalysis}
      </Button>

      {/* Tertiary: Back to Hub */}
      <button
        type="button"
        onClick={onBackToHub}
        className="w-full py-1 text-xs font-semibold underline underline-offset-2"
        style={{ color: "rgba(110, 65, 15, 0.70)" }}
      >
        {ARENA_COPY.backToHub}
      </button>
    </div>
  );
}
