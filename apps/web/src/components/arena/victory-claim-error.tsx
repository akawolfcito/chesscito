"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { ARENA_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PaperStatCard } from "@/components/arena/paper-stat-card";
import { formatTime } from "@/lib/game/arena-utils";
import sparklesData from "@/../public/animations/sparkles.json";
import trophyData from "@/../public/animations/trophy.json";

type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  isCheckmate?: boolean;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  errorMessage?: string | null;
  onRetry?: () => void;
};

export function VictoryClaimError({
  moves,
  elapsedMs,
  difficulty,
  isCheckmate = true,
  onPlayAgain,
  onBackToHub,
  errorMessage,
  onRetry,
}: Props) {
  const time = formatTime(elapsedMs);
  const performanceLine = isCheckmate
    ? VICTORY_CELEBRATION_COPY.performanceLineCheckmate(moves, time)
    : VICTORY_CELEBRATION_COPY.performanceLine(moves, time);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-[var(--overlay-scrim)] animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      {/* Sparkles background — dimmed */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-[0.10]" />
      </div>

      {/* Card */}
      <div className="paper-surface relative z-10 mx-4 flex w-full max-w-[340px] flex-col items-center px-6 pb-6 pt-8 animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">

        {/* Hero — Trophy (dimmed for error context) with soft rose halo */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="absolute h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(190,18,60,0.12)_0%,transparent_70%)]" />
          <div className="relative h-32 w-32 opacity-50 grayscale-[30%]">
            <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
          </div>
        </div>

        {/* Error title */}
        <h2
          className="fantasy-title mb-1 text-2xl font-bold"
          style={{
            color: "rgba(159, 18, 57, 0.95)",
            textShadow: "0 1px 0 rgba(255, 235, 220, 0.75)",
          }}
        >
          {VICTORY_CLAIM_COPY.errorTitle}
        </h2>

        {/* Error subtitle */}
        <p className="mb-3 text-center text-sm" style={{ color: "var(--paper-text-muted)" }}>
          {VICTORY_CLAIM_COPY.errorSubtitle}
        </p>

        {/* Specific error detail */}
        {errorMessage && (
          <p className="mb-2 text-center text-xs" style={{ color: "rgba(159, 18, 57, 0.8)" }}>
            {errorMessage}
          </p>
        )}

        {/* Recovery reassurance */}
        <p className="mb-2 text-center text-xs" style={{ color: "var(--paper-text-subtle)" }}>
          {VICTORY_CLAIM_COPY.errorRecoveryHint}
        </p>

        {/* Performance — still visible for context */}
        <p className="mb-5 text-xs" style={{ color: "var(--paper-text-subtle)" }}>
          {performanceLine}
        </p>

        {/* Stats */}
        <div className="mb-6 flex w-full gap-2">
          <PaperStatCard
            icon={<CandyIcon name="crosshair" className="h-4 w-4" />}
            value={ARENA_COPY.difficulty[difficulty as keyof typeof ARENA_COPY.difficulty] ?? difficulty}
            label={VICTORY_CELEBRATION_COPY.stats.difficulty}
          />
          <PaperStatCard
            icon={<CandyIcon name="move" className="h-4 w-4" />}
            value={String(moves)}
            label={VICTORY_CELEBRATION_COPY.stats.moves}
          />
          <PaperStatCard
            icon={<CandyIcon name="time" className="h-4 w-4" />}
            value={time}
            label={VICTORY_CELEBRATION_COPY.stats.time}
          />
        </div>

        {/* CTAs */}
        <div className="flex w-full flex-col gap-2.5">
          {/* Primary: Try Again */}
          {onRetry && (
            <Button
              type="button"
              variant="game-primary"
              size="game"
              onClick={onRetry}
            >
              <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {VICTORY_CLAIM_COPY.tryAgain}
            </Button>
          )}

          {/* Play Again */}
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            onClick={onPlayAgain}
            style={{
              borderColor: "rgba(110, 65, 15, 0.25)",
              color: "var(--paper-text-muted)",
            }}
          >
            <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {ARENA_COPY.playAgain}
          </Button>

          {/* Back to Hub */}
          <Button
            type="button"
            variant="game-text"
            size="game-sm"
            onClick={onBackToHub}
            className="text-xs"
            style={{ color: "var(--paper-text-muted)" }}
          >
            {ARENA_COPY.backToHub}
          </Button>
        </div>
      </div>
    </div>
  );
}
