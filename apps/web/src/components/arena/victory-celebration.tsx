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

/** Locked teaser showing what the user unlocks on claim */
function VictoryCardTeaser({ moves, time, difficulty }: { moves: number; time: string; difficulty: string }) {
  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
      {/* Blur overlay + lock */}
      <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px] bg-black/20">
        <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-wider text-emerald-300/70">
          {VICTORY_CLAIM_COPY.teaserLabel}
        </span>
      </div>
      {/* Card preview content (dimmed) */}
      <div className="flex items-center gap-3 opacity-40">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
          <span className="text-lg">🏆</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white/80">{VICTORY_CLAIM_COPY.teaserCheckmate(moves)}</p>
          <p className="text-[0.6rem] text-cyan-100/40">{difficulty.toUpperCase()} — {time}</p>
        </div>
        <div className="shrink-0 rounded-lg bg-white/[0.04] px-2 py-1">
          <span className="text-[0.55rem] font-bold text-cyan-100/30">{VICTORY_CLAIM_COPY.teaserShare}</span>
        </div>
      </div>
    </div>
  );
}

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

      {/* Card */}
      <div className="relative z-10 mx-4 flex w-full max-w-[340px] flex-col items-center rounded-3xl border border-white/[0.08] bg-[var(--surface-frosted)] px-6 pb-6 pt-8 backdrop-blur-2xl shadow-[0_0_60px_rgba(20,184,166,0.08)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">

        {/* Hero — Trophy with breathing halo */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="absolute h-40 w-40 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(20,184,166,0.22)_0%,rgba(20,184,166,0.08)_40%,rgba(217,180,74,0.04)_65%,transparent_80%)]" />
          <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(52,211,153,0.12)_0%,transparent_70%)]" />
          <div className="relative h-32 w-32">
            <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
          </div>
        </div>

        {/* Title */}
        <h2 className="fantasy-title mb-1 text-3xl font-bold text-emerald-300/90 drop-shadow-[0_0_12px_rgba(20,184,166,0.35)]">
          {VICTORY_CELEBRATION_COPY.title}
        </h2>

        {/* Performance summary */}
        <p className="mb-5 text-sm text-cyan-100/50">
          {performanceLine}
        </p>

        {/* Stats — 3 mini-cards */}
        <div className="mb-5 flex w-full gap-2">
          <StatCard icon="⚔" value={difficulty.toUpperCase()} label={VICTORY_CELEBRATION_COPY.stats.difficulty} />
          <StatCard icon="♟" value={String(moves)} label={VICTORY_CELEBRATION_COPY.stats.moves} />
          <StatCard icon="⏱" value={time} label={VICTORY_CELEBRATION_COPY.stats.time} />
        </div>

        {/* CTAs */}
        <div className="flex w-full flex-col gap-2.5">
          {/* Primary: Play Again */}
          <Button
            type="button"
            variant="game-primary"
            size="game"
            onClick={onPlayAgain}
            className="shadow-[0_0_16px_rgba(20,184,166,0.25)] hover:shadow-[0_0_24px_rgba(20,184,166,0.4)]"
          >
            <RotateCcw size={16} className="inline -mt-0.5" /> {ARENA_COPY.playAgain}
          </Button>

          {/* Claim block: button + helper + teaser */}
          {onClaimVictory && (
            <div className="flex w-full flex-col gap-2">
              {/* Claim button — two-line with value hint */}
              <button
                type="button"
                onClick={onClaimVictory}
                className="group w-full rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.08] py-3 transition-all hover:bg-emerald-500/[0.15] hover:border-emerald-400/30 hover:shadow-[0_0_20px_rgba(52,211,153,0.12)] active:scale-[0.97]"
              >
                <span className="flex items-center justify-center gap-1.5 text-sm font-bold text-emerald-300/90">
                  <Trophy size={16} /> {VICTORY_CLAIM_COPY.claimButton}
                </span>
                <span className="block text-[0.6rem] text-emerald-200/40 mt-0.5">
                  {VICTORY_CLAIM_COPY.claimValueHint(claimPrice ?? "")}
                </span>
              </button>

              {/* Helper text */}
              <p className="text-center text-[0.6rem] text-cyan-100/30">
                {VICTORY_CLAIM_COPY.claimHelper}
              </p>

              {/* Locked teaser card */}
              <VictoryCardTeaser moves={moves} time={time} difficulty={difficulty} />
            </div>
          )}

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
