"use client";

import { RotateCcw, Trophy } from "lucide-react";
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
      {/* Sparkles background */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-[0.18]" />
      </div>
      {/* Confetti burst */}
      <div className="reward-confetti-burst pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_40%,rgba(52,211,153,0.18)_0%,rgba(217,180,74,0.10)_35%,transparent_65%)]" />

      {/* Card */}
      <div className="panel-showcase relative z-10 mx-4 flex w-full max-w-[340px] flex-col items-center px-6 pb-6 pt-8 shadow-[0_0_60px_rgba(20,184,166,0.08)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">

        {/* Hero — Trophy with breathing halo */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="absolute h-40 w-40 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.22)_0%,rgba(20,184,166,0.08)_40%,rgba(217,180,74,0.04)_65%,transparent_80%)]" />
          <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.12)_0%,transparent_70%)]" />
          <div className="relative h-32 w-32">
            <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
          </div>
        </div>

        {/* Title */}
        <h2
          className="fantasy-title victory-text-slam mb-1 text-3xl font-bold text-emerald-300/90"
          style={{
            textShadow: "var(--text-shadow-hero-emerald)",
          }}
        >
          {VICTORY_CELEBRATION_COPY.title}
        </h2>

        {/* Performance summary */}
        <p className="mb-5 text-sm text-cyan-100/50">
          {performanceLine}
        </p>

        {/* Stats — 3 mini-cards */}
        <div className="mb-5 flex w-full gap-2">
          <StatCard icon="⚔" value={ARENA_COPY.difficulty[difficulty as keyof typeof ARENA_COPY.difficulty] ?? difficulty} label={VICTORY_CELEBRATION_COPY.stats.difficulty} />
          <StatCard icon="♟" value={String(moves)} label={VICTORY_CELEBRATION_COPY.stats.moves} />
          <StatCard icon="⏱" value={time} label={VICTORY_CELEBRATION_COPY.stats.time} />
        </div>

        {/* CTAs — Claim primary, Play Again secondary */}
        <div className="flex w-full flex-col gap-2.5">
          {/* Primary: Claim Victory */}
          {onClaimVictory && (
            <button
              type="button"
              onClick={onClaimVictory}
              className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] py-3.5 transition-all hover:bg-emerald-500/[0.15] hover:border-emerald-400/30 hover:shadow-[0_0_20px_rgba(52,211,153,0.12)] active:scale-[0.97]"
            >
              <span className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-300/90">
                <Trophy size={16} /> {VICTORY_CLAIM_COPY.claimButton}
              </span>
              <span className="block text-xs text-emerald-200/60 mt-0.5">
                {VICTORY_CLAIM_COPY.claimValueHint(claimPrice ?? "")}
              </span>
            </button>
          )}

          {/* Secondary: Play Again */}
          <Button
            type="button"
            variant="game-ghost"
            size="game"
            onClick={onPlayAgain}
          >
            <RotateCcw size={16} className="inline -mt-0.5" /> {ARENA_COPY.playAgain}
          </Button>

          {/* Tertiary: Back to Hub */}
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
