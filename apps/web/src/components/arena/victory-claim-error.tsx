"use client";

import { ARENA_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
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

function StatCard({ icon, value, label }: { icon: string; value: string; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <span className="text-sm leading-none opacity-60">{icon}</span>
      <span className="text-base font-bold leading-none text-white/90">{value}</span>
      <span className="text-[0.6rem] uppercase tracking-widest text-cyan-200/40">{label}</span>
    </div>
  );
}

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
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-black/65 animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      {/* Sparkles background — dimmed */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-[0.10]" />
      </div>

      {/* Card */}
      <div className="relative z-10 mx-4 flex w-full max-w-[340px] flex-col items-center rounded-3xl border border-white/[0.08] bg-[#0a1424]/92 px-6 pb-6 pt-8 backdrop-blur-2xl shadow-[0_0_60px_rgba(251,113,133,0.08)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">

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

        {/* Performance — still visible for context */}
        <p className="mb-5 text-xs text-cyan-100/30">
          {performanceLine}
        </p>

        {/* Stats */}
        <div className="mb-6 flex w-full gap-2">
          <StatCard icon="⚔" value={difficulty.toUpperCase()} label={VICTORY_CELEBRATION_COPY.stats.difficulty} />
          <StatCard icon="♟" value={String(moves)} label={VICTORY_CELEBRATION_COPY.stats.moves} />
          <StatCard icon="⏱" value={time} label={VICTORY_CELEBRATION_COPY.stats.time} />
        </div>

        {/* CTAs */}
        <div className="flex w-full flex-col gap-2.5">
          {/* Primary: Try Again */}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-teal-400 py-3 text-sm font-bold text-white shadow-[0_0_16px_rgba(20,184,166,0.25)] transition-all hover:shadow-[0_0_24px_rgba(20,184,166,0.4)] active:scale-[0.97]"
            >
              {VICTORY_CLAIM_COPY.tryAgain}
            </button>
          )}

          {/* Play Again */}
          <button
            type="button"
            onClick={onPlayAgain}
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-2.5 text-sm font-semibold text-white/60 transition-all hover:bg-white/10 active:scale-[0.97]"
          >
            {ARENA_COPY.playAgain}
          </button>

          {/* Back to Hub */}
          <button
            type="button"
            onClick={onBackToHub}
            className="w-full py-2 text-center text-xs font-medium text-white/30 transition-all hover:text-white/50 active:scale-[0.97]"
          >
            {ARENA_COPY.backToHub}
          </button>
        </div>
      </div>
    </div>
  );
}
