"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
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
  onClaimVictory?: () => void;
  claimPrice?: string;
};


export function VictoryCelebration({
  moves,
  elapsedMs,
  difficulty,
  isCheckmate = true,
  onPlayAgain,
  onBackToHub,
  onClaimVictory,
  claimPrice,
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
      {/* Sparkles background — warm-tuned opacity so they read on paper */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-[0.18]" />
      </div>
      {/* Confetti burst — warm amber radial outside the card */}
      <div className="reward-confetti-burst pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.18)_0%,rgba(217,180,74,0.10)_35%,transparent_65%)]" />

      {/* Card */}
      <div className="relative z-10 mx-4 w-full max-w-[340px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <CandyGlassShell
          title={VICTORY_CELEBRATION_COPY.title}
          onClose={onBackToHub}
          closeLabel={ARENA_COPY.backToHub}
          cta={
            <div className="flex w-full flex-col gap-2.5">
              {onClaimVictory && (
                <Button
                  type="button"
                  variant="game-solid"
                  size="game"
                  onClick={onClaimVictory}
                  className="w-full flex-col gap-0.5 py-3.5"
                >
                  <span className="flex items-center gap-1.5 text-sm font-bold">
                    <CandyBanner name="btn-claim" className="h-5 w-5" />
                    {VICTORY_CLAIM_COPY.claimButton}
                  </span>
                  <span className="block text-xs opacity-70 font-normal">
                    {VICTORY_CLAIM_COPY.claimValueHint(claimPrice ?? "")}
                  </span>
                </Button>
              )}
              <Button type="button" variant="game-ghost" size="game" onClick={onPlayAgain}>
                <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {ARENA_COPY.playAgain}
              </Button>
              <button
                type="button"
                onClick={onBackToHub}
                className="w-full py-1 text-xs font-semibold underline underline-offset-2"
                style={{ color: "rgba(110, 65, 15, 0.70)" }}
              >
                {ARENA_COPY.backToHub}
              </button>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Hero — Trophy with breathing halo */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-40 w-40 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_40%,rgba(217,180,74,0.05)_65%,transparent_80%)]" />
              <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(255,220,120,0.20)_0%,transparent_70%)]" />
              <div className="relative h-32 w-32">
                <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
              </div>
            </div>

            {/* Performance summary */}
            <p className="text-sm" style={{ color: "rgba(110, 65, 15, 0.75)" }}>
              {performanceLine}
            </p>

            {/* Stats — 3 mini-cards */}
            <div className="flex w-full gap-2">
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
          </div>
        </CandyGlassShell>
      </div>
    </div>
  );
}
