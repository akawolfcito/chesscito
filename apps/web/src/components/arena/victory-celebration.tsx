"use client";

import { type ReactNode, useEffect, useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { track } from "@/lib/telemetry";
import { ARENA_COPY, SHARE_COPY, VICTORY_CLAIM_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PaperStatCard } from "@/components/arena/paper-stat-card";
import { ShareModal } from "@/components/share/share-modal";
import { AskCoachButton } from "@/components/coach/ask-coach-button";
import { formatTime } from "@/lib/game/arena-utils";
import type { PlayerColor } from "@/lib/game/use-chess-game";
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
  /** Final FEN — used to render the board on the /api/og/match card. */
  fen?: string;
  /** Player color — flips the board on the share card when playing black. */
  playerColor?: PlayerColor;
  /** Optional handler for "Ask the Coach". When provided, surfaces the
   *  CTA right after Save Victory so the player doesn't have to mint
   *  before they can analyze (2026-05-07 user smoke). */
  onAskCoach?: () => void;
  coachPreview?: ReactNode;
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
  fen,
  playerColor,
  onAskCoach,
  coachPreview,
}: Props) {
  const time = formatTime(elapsedMs);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    track("modal_open", {
      id: "victory-celebration",
      difficulty,
      moves,
      can_claim: Boolean(onClaimVictory),
    });
  }, [difficulty, moves, onClaimVictory]);
  const performanceLine = isCheckmate
    ? VICTORY_CELEBRATION_COPY.performanceLineCheckmate(moves, time)
    : VICTORY_CELEBRATION_COPY.performanceLine(moves, time);

  const cardParams = new URLSearchParams({
    moves: String(moves),
    time: String(elapsedMs),
    diff: difficulty,
    result: "win",
  });
  if (fen) cardParams.set("fen", fen);
  if (playerColor) cardParams.set("color", playerColor);
  const cardUrl = `/api/og/match?${cardParams.toString()}`;
  const challengeText = VICTORY_CLAIM_COPY.challengeText(moves, SHARE_COPY.url);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center result-screen-overlay animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      {/* Sparkles background — warm-tuned opacity */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-[0.25]" />
      </div>
      {/* Confetti burst */}
      <div className="reward-confetti-burst pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.22)_0%,rgba(217,180,74,0.12)_35%,transparent_65%)]" />

      {/* Main content container */}
      <div className="relative z-10 flex h-full w-full flex-col px-5 py-2 animate-in zoom-in-95 slide-in-from-bottom-6 duration-500">
        <CandyGlassShell
          title=""
          onClose={undefined as any}
          closeLabel=""
          presentation="screen"
          className="!gap-4 shadow-none"
          cta={
            <div className="flex w-full flex-col gap-3 animate-in fade-in duration-300 fill-mode-both [animation-delay:400ms]">
              {/* 1. Primary Action: Save Victory (Mint) */}
              {onClaimVictory && (
                <div className="flex w-full justify-center">
                  <PrincipalButton
                    size="medium"
                    leadingIcon={<CandyBanner name="btn-claim" className="h-5 w-5" />}
                    onClick={onClaimVictory}
                    aria-label={VICTORY_CLAIM_COPY.claimButton}
                  >
                    {VICTORY_CLAIM_COPY.claimButton}
                    {claimPrice ? ` · ${VICTORY_CLAIM_COPY.claimValueHint(claimPrice)}` : ""}
                  </PrincipalButton>
                </div>
              )}

              {/* 2. Secondary Value: Coach Review Card */}
              {coachPreview && (
                <div className="w-full">
                  {coachPreview}
                </div>
              )}

              {/* 3. Tertiary Actions: Play Again & Share */}
              <div className="flex w-full gap-2">
                <Button
                  type="button"
                  variant="game-ghost"
                  size="game-md"
                  onClick={onPlayAgain}
                  className="flex-1 !h-12 border-amber-900/25 bg-amber-900/10 text-sm font-black shadow-sm"
                >
                  <CandyIcon name="refresh" className="mr-1.5 h-3.5 w-3.5" />
                  {ARENA_COPY.playAgain}
                </Button>
                <Button
                  type="button"
                  variant="game-ghost"
                  size="game-md"
                  onClick={() => setShareOpen(true)}
                  className="flex-1 !h-12 border-amber-900/25 bg-amber-900/10 text-sm font-black shadow-sm"
                >
                  <CandyIcon name="share" className="mr-1.5 h-3.5 w-3.5" />
                  {SHARE_COPY.button}
                </Button>
              </div>

              {/* Exit shortcut - bottom aligned */}
              <button
                type="button"
                onClick={onBackToHub}
                className="mt-1 w-full py-2 text-[11px] font-black uppercase tracking-[0.22em] text-amber-900/80 transition-opacity hover:opacity-100"
              >
                {ARENA_COPY.backToHub}
              </button>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Header: Trophy + Victory + Checkmate! */}
            <div className="flex flex-col items-center pt-1">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div className="absolute h-28 w-28 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.35)_0%,transparent_70%)]" />
                <LottieAnimation animationData={trophyData} loop={false} className="relative h-full w-full" />
              </div>
              
              <div className="mt-1.5 flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-900/60">
                  {VICTORY_CELEBRATION_COPY.title}
                </span>
                <h2
                  className="fantasy-title victory-text-slam text-[32px] font-extrabold leading-tight tracking-tight"
                  style={{
                    color: "rgba(110, 65, 15, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.80), 0 2px 8px rgba(245, 158, 11, 0.40)",
                  }}
                >
                  {isCheckmate ? VICTORY_CELEBRATION_COPY.headlineCheckmate : VICTORY_CELEBRATION_COPY.headlineWin}
                </h2>
              </div>
            </div>

            {/* Performance line */}
            <p className="max-w-[260px] text-[12px] font-bold leading-relaxed text-amber-900/80">
              {performanceLine}
            </p>

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

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        cardUrl={cardUrl}
        text={challengeText}
      />
    </div>
  );
}
