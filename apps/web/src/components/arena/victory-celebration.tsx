"use client";

import type { ReactNode } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { ARENA_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { formatTime } from "@/lib/game/arena-utils";
import sparklesData from "@/../public/animations/sparkles.json";
import trophyData from "@/../public/animations/trophy.json";

function PaperStatCard({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <div className="paper-tray flex flex-1 flex-col items-center gap-1 !px-2 !py-2">
      <span className="flex h-5 items-center justify-center opacity-80">{icon}</span>
      <span className="text-base font-extrabold leading-none" style={{ color: "var(--paper-text)" }}>
        {value}
      </span>
      <span className="text-xs uppercase tracking-widest" style={{ color: "var(--paper-text-muted)" }}>
        {label}
      </span>
    </div>
  );
}

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
      <div className="paper-surface relative z-10 mx-4 flex w-full max-w-[340px] flex-col items-center px-6 pb-6 pt-8 animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">

        {/* Hero — Trophy with breathing halo (amber tones for paper cohesion) */}
        <div className="relative mb-4 flex items-center justify-center">
          <div className="absolute h-40 w-40 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_40%,rgba(217,180,74,0.05)_65%,transparent_80%)]" />
          <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(255,220,120,0.20)_0%,transparent_70%)]" />
          <div className="relative h-32 w-32">
            <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
          </div>
        </div>

        {/* Title */}
        <h2
          className="fantasy-title victory-text-slam mb-1 text-3xl font-bold"
          style={{
            color: "rgba(110, 65, 15, 0.98)",
            textShadow: "0 1px 0 rgba(255, 235, 180, 0.8), 0 2px 6px rgba(120, 65, 5, 0.35)",
          }}
        >
          {VICTORY_CELEBRATION_COPY.title}
        </h2>

        {/* Performance summary */}
        <p className="mb-5 text-sm" style={{ color: "var(--paper-text-muted)" }}>
          {performanceLine}
        </p>

        {/* Stats — 3 mini-cards */}
        <div className="mb-5 flex w-full gap-2">
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

        {/* CTAs — Claim primary, Play Again secondary */}
        <div className="flex w-full flex-col gap-2.5">
          {/* Primary: Claim Victory */}
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

          {/* Secondary: Play Again */}
          <Button
            type="button"
            variant="game-ghost"
            size="game"
            onClick={onPlayAgain}
          >
            <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" /> {ARENA_COPY.playAgain}
          </Button>

          {/* Tertiary: Back to Hub */}
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
