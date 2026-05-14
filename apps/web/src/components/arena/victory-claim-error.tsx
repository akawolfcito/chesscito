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
    ? "relative h-32 w-32"
    : "relative h-32 w-32 opacity-55 grayscale-[30%]";

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
      <div className="relative z-10 flex w-full max-w-[390px] flex-col gap-6 px-5 py-8 animate-in zoom-in-95 slide-in-from-bottom-6 duration-500">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2
            className="fantasy-title text-4xl font-extrabold tracking-tight"
            style={{
              color: isCancelled ? "#fff8e1" : "#fee2e2",
              textShadow: isCancelled
                ? "0 2px 8px rgba(0, 0, 0, 0.4), 0 0 20px rgba(245, 158, 11, 0.3)"
                : "0 2px 8px rgba(0, 0, 0, 0.4), 0 0 20px rgba(220, 38, 38, 0.2)",
            }}
          >
            {isCancelled ? "Paused" : "Error"}
          </h2>
          <p className="text-sm font-medium tracking-wide text-amber-100/80">
            {kindCopy.title}
          </p>
        </div>

        <CandyGlassShell
          title=""
          onClose={onBackToHub}
          closeLabel={ARENA_COPY.backToHub}
          className="!max-h-none !gap-4 shadow-2xl"
          cta={
            <div className="flex w-full flex-col gap-2.5">
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
                size="game-sm"
                onClick={onPlayAgain}
                style={{
                  borderColor: "rgba(110, 65, 15, 0.25)",
                  color: "rgba(110, 65, 15, 0.85)",
                }}
              >
                <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {ARENA_COPY.playAgain}
              </Button>
              {/* Back to Hub shortcut */}
              <button
                type="button"
                onClick={onBackToHub}
                className="mt-1 w-full py-2 text-xs font-bold uppercase tracking-widest text-amber-900/60 transition-opacity hover:opacity-100"
              >
                {ARENA_COPY.backToHub}
              </button>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Hero — Trophy. Cancelled state keeps full chroma (still
                your victory); error/timeout dim it to signal recovery. */}
            <div className="relative flex items-center justify-center">
              <div
                className="absolute h-36 w-36 rounded-full"
                style={{ background: `radial-gradient(circle, ${haloColor} 0%, transparent 70%)` }}
              />
              <div className={trophyClass}>
                <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
              </div>
            </div>

            {/* Subtitle keyed by kind — amber for user-cancelled (warning), rose for errors */}
            <p
              className="text-sm"
              style={{
                color: subtitleColor,
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {kindCopy.subtitle}
            </p>

            {/* Specific error detail (only for real errors) */}
            {kind === "error" && errorMessage && (
              <p className="text-xs" style={{ color: "rgba(159, 18, 57, 0.85)" }}>
                {errorMessage}
              </p>
            )}

            {/* Recovery reassurance, kind-specific */}
            <p className="text-xs" style={{ color: "rgba(110, 65, 15, 0.65)" }}>
              {kindCopy.hint}
            </p>

            {/* Performance — still visible for context */}
            <p className="text-xs" style={{ color: "rgba(110, 65, 15, 0.65)" }}>
              {performanceLine}
            </p>

            {/* Stats */}
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
