"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { ARENA_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PaperStatCard } from "@/components/arena/paper-stat-card";
import { formatTime } from "@/lib/game/arena-utils";
import sparklesData from "@/../public/animations/sparkles.json";
import trophyData from "@/../public/animations/trophy.json";

export type ClaimEndKind = "error" | "cancelled" | "timeout";

type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  isCheckmate?: boolean;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  errorMessage?: string | null;
  onRetry?: () => void;
  kind?: ClaimEndKind;
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
  kind = "error",
}: Props) {
  const time = formatTime(elapsedMs);
  const performanceLine = isCheckmate
    ? VICTORY_CELEBRATION_COPY.performanceLineCheckmate(moves, time)
    : VICTORY_CELEBRATION_COPY.performanceLine(moves, time);
  const kindCopy = VICTORY_CLAIM_COPY.errorKindCopy[kind];

  // Tonal split: a deliberate user gesture (cancelled) is a warning, not
  // an error. Render in amber (per design system) with polite aria-live
  // and the trophy at full chroma so the moment doesn't feel like a
  // failure. Errors and timeouts stay rose with assertive aria-live.
  const isCancelled = kind === "cancelled";
  const haloColor = isCancelled ? "rgba(217, 119, 6, 0.18)" : "rgba(190, 18, 60, 0.15)";
  const subtitleColor = isCancelled ? "rgba(110, 65, 15, 0.95)" : "rgba(159, 18, 57, 0.95)";
  const trophyClass = isCancelled
    ? "relative h-24 w-24"
    : "relative h-24 w-24 opacity-55 grayscale-[30%]";

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center result-screen-overlay animate-in fade-in duration-300"
      role={isCancelled ? "status" : "alert"}
      aria-live={isCancelled ? "polite" : "assertive"}
    >
      {/* Sparkles background — dimmed */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-[0.10]" />
      </div>

      {/* Main content container */}
      <div className="relative z-10 flex h-full w-full flex-col px-5 py-2 animate-in zoom-in-95 slide-in-from-bottom-6 duration-500">
        <CandyGlassShell
          title=""
          onClose={undefined as any}
          closeLabel=""
          presentation="screen"
          className="!gap-4 shadow-none"
          cta={
            <div className="flex w-full flex-col gap-3">
              {onRetry && (
                <div className="flex w-full justify-center">
                  <PrincipalButton
                    size="medium"
                    leadingIcon={
                      <CandyIcon name="refresh" className="h-4 w-4" />
                    }
                    onClick={onRetry}
                    aria-label={VICTORY_CLAIM_COPY.tryAgain}
                  >
                    {VICTORY_CLAIM_COPY.tryAgain}
                  </PrincipalButton>
                </div>
              )}
              <Button
                type="button"
                variant="game-ghost"
                size="game-md"
                onClick={onPlayAgain}
                className="w-full !h-12 border-amber-900/10 bg-amber-900/5 text-sm font-bold text-amber-900/80"
              >
                <CandyIcon name="refresh" className="mr-1.5 h-3.5 w-3.5" /> {ARENA_COPY.playAgain}
              </Button>
              {/* Exit shortcut - bottom aligned */}
              <button
                type="button"
                onClick={onBackToHub}
                className="mt-1 w-full py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-amber-900/60 transition-opacity hover:opacity-100"
              >
                {ARENA_COPY.backToHub}
              </button>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Header: Trophy + Status + Error/Paused */}
            <div className="flex flex-col items-center pt-1">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div
                  className="absolute h-28 w-28 rounded-full"
                  style={{ background: `radial-gradient(circle, ${haloColor} 0%, transparent 70%)` }}
                />
                <div className={trophyClass}>
                  <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
                </div>
              </div>
              
              <div className="mt-1.5 flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-900/60">
                  {kindCopy.title}
                </span>
                <h2
                  className="fantasy-title text-[32px] font-extrabold leading-tight tracking-tight"
                  style={{
                    color: isCancelled ? "rgba(110, 65, 15, 0.95)" : "rgba(159, 18, 57, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.80), 0 2px 8px rgba(0,0,0,0.12)",
                  }}
                >
                  {isCancelled ? "Paused" : "Error"}
                </h2>
              </div>
            </div>

            {/* Error Detail & Hint */}
            <div className="flex flex-col gap-1.5">
              <p className="text-[12px] font-bold text-amber-900/90">
                {kindCopy.subtitle}
              </p>
              {kind === "error" && errorMessage && (
                <p className="px-4 text-[10px] leading-relaxed text-rose-800/80">
                  {errorMessage}
                </p>
              )}
              <p className="text-[10px] font-bold text-amber-900/60">
                {kindCopy.hint}
              </p>
            </div>

            {/* Stats Row */}
            <div className="flex w-full gap-1.5 px-0.5">
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
