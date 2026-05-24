"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";
import { ARENA_COPY } from "@/lib/content/editorial";
import type { BasicCoachResponse } from "@/lib/coach/types";
import { formatTime } from "@/lib/game/arena-utils";

type Props = {
  response: BasicCoachResponse;
  difficulty: string;
  totalMoves: number;
  elapsedMs: number;
  result: string;
  onGetFullAnalysis?: () => void;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  onRetry?: () => void;
  retryLabel?: string;
  errorTitle?: string;
  errorBody?: string;
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
  onRetry,
  retryLabel,
  errorTitle,
  errorBody,
}: Props) {
  const t = useTranslations("COACH_COPY");
  const time = formatTime(elapsedMs);
  const diffLabel = ARENA_COPY.difficulty[difficulty as keyof typeof ARENA_COPY.difficulty] ?? difficulty;

  const warmText = "rgba(63, 34, 8, 0.95)";
  const warmMuted = "rgba(110, 65, 15, 0.75)";
  const cream = "0 1px 0 rgba(255, 245, 215, 0.55)";

  const showRetry = Boolean(onRetry);
  const retryReview = t("retryReview");
  const unlockFullAnalysis = t("unlockFullAnalysis");

  return (
    <div className="flex flex-col gap-4">
      {errorTitle && errorBody && (
        <div
          data-testid="coach-fallback-error"
          role="alert"
          className="rounded-xl border border-amber-400/60 bg-amber-50 px-3 py-2 text-xs"
          style={{ color: "rgba(110, 65, 15, 0.95)" }}
        >
          <p className="font-bold">{errorTitle}</p>
          <p className="mt-1">{errorBody}</p>
        </div>
      )}
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
            {t("tips")}
          </h3>
          <ul className="flex flex-col gap-1">
            {response.tips.map((tip, i) => (
              <li key={i} className="text-sm" style={{ color: warmText, textShadow: cream }}>- {tip}</li>
            ))}
          </ul>
        </section>
      )}

      {showRetry ? (
        <>
          {/* Primary: Retry Review — recoverable error state */}
          <Button
            type="button"
            variant="game-primary"
            size="game"
            onClick={onRetry!}
            aria-label={retryLabel ?? retryReview}
          >
            <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {retryLabel ?? retryReview}
          </Button>

          {/* Secondary: Play Again */}
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            onClick={onPlayAgain}
            aria-label={ARENA_COPY.playAgain}
            style={{
              borderColor: "rgba(110, 65, 15, 0.25)",
              color: warmMuted,
            }}
          >
            {ARENA_COPY.playAgain}
          </Button>
        </>
      ) : (
        <>
          {/* Primary: Play Again — retention CTA */}
          <Button
            type="button"
            variant="game-primary"
            size="game"
            onClick={onPlayAgain}
            aria-label={ARENA_COPY.playAgain}
          >
            <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {ARENA_COPY.playAgain}
          </Button>

          {/* Secondary: Unlock Full Analysis — commercial upsell */}
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            onClick={onGetFullAnalysis!}
            aria-label={unlockFullAnalysis}
            style={{
              borderColor: "rgba(110, 65, 15, 0.25)",
              color: warmMuted,
            }}
          >
            {unlockFullAnalysis}
          </Button>
        </>
      )}

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
