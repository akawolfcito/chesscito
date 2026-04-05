"use client";

import { RotateCcw, RefreshCw } from "lucide-react";
import { ARENA_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { StatCard } from "@/components/arena/stat-card";
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
      <div className="panel-showcase relative z-10 mx-4 flex w-full max-w-[340px] flex-col items-center px-6 pb-6 pt-8 shadow-[0_0_60px_rgba(251,113,133,0.08)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">

        {/* Hero — Trophy (context retention) */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="absolute h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(251,113,133,0.12)_0%,transparent_70%)]" />
          <div className="relative h-32 w-32 opacity-50 grayscale-[30%]">
            <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
          </div>
        </div>

        {/* Error title */}
        <h2 className="fantasy-title mb-1 text-2xl font-bold text-rose-300/90 drop-shadow-[0_0_12px_rgba(251,113,133,0.3)]">
          {VICTORY_CLAIM_COPY.errorTitle}
        </h2>

        {/* Error subtitle */}
        <p className="mb-3 text-center text-sm text-cyan-100/40">
          {VICTORY_CLAIM_COPY.errorSubtitle}
        </p>

        {/* Specific error detail */}
        {errorMessage && (
          <p className="mb-2 text-center text-xs text-rose-300/60">{errorMessage}</p>
        )}

        {/* Recovery reassurance */}
        <p className="mb-2 text-center text-xs text-cyan-100/30">
          {VICTORY_CLAIM_COPY.errorRecoveryHint}
        </p>

        {/* Performance — still visible for context */}
        <p className="mb-5 text-xs text-cyan-100/30">
          {performanceLine}
        </p>

        {/* Stats */}
        <div className="mb-6 flex w-full gap-2">
          <StatCard icon="⚔" value={ARENA_COPY.difficulty[difficulty as keyof typeof ARENA_COPY.difficulty] ?? difficulty} label={VICTORY_CELEBRATION_COPY.stats.difficulty} />
          <StatCard icon="♟" value={String(moves)} label={VICTORY_CELEBRATION_COPY.stats.moves} />
          <StatCard icon="⏱" value={time} label={VICTORY_CELEBRATION_COPY.stats.time} />
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
              className="shadow-[0_0_16px_rgba(20,184,166,0.25)] hover:shadow-[0_0_24px_rgba(20,184,166,0.4)]"
            >
              <RefreshCw size={16} className="inline -mt-0.5" /> {VICTORY_CLAIM_COPY.tryAgain}
            </Button>
          )}

          {/* Play Again */}
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            onClick={onPlayAgain}
          >
            <RotateCcw size={14} className="inline -mt-0.5" /> {ARENA_COPY.playAgain}
          </Button>

          {/* Back to Hub */}
          <Button
            type="button"
            variant="game-text"
            size="game-sm"
            onClick={onBackToHub}
            className="text-xs"
          >
            {ARENA_COPY.backToHub}
          </Button>
        </div>
      </div>
    </div>
  );
}
