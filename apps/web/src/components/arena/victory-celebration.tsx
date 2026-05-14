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
      {/* Sparkles background — warm-tuned opacity so they read on paper */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} className="h-full w-full opacity-[0.25]" />
      </div>
      {/* Confetti burst — warm amber radial outside the card */}
      <div className="reward-confetti-burst pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_40%,rgba(245,158,11,0.22)_0%,rgba(217,180,74,0.12)_35%,transparent_65%)]" />

      {/* Main content container */}
      <div className="relative z-10 flex w-full max-w-[390px] flex-col gap-6 px-5 py-8 animate-in zoom-in-95 slide-in-from-bottom-6 duration-500">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2
            className="fantasy-title victory-text-slam text-4xl font-extrabold tracking-tight"
            style={{
              color: "#fff8e1",
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.4), 0 0 20px rgba(245, 158, 11, 0.3)",
            }}
          >
            {isCheckmate ? VICTORY_CELEBRATION_COPY.headlineCheckmate : VICTORY_CELEBRATION_COPY.headlineWin}
          </h2>
          <p className="text-sm font-medium tracking-wide text-amber-100/80">
            {VICTORY_CELEBRATION_COPY.title}
          </p>
        </div>

        <CandyGlassShell
          title=""
          onClose={onBackToHub}
          closeLabel={ARENA_COPY.backToHub}
          className="!max-h-none !gap-4 shadow-2xl"
          cta={
            <div className="flex w-full flex-col gap-3 animate-in fade-in duration-300 fill-mode-both [animation-delay:600ms]">
              {/* Primary Action: Save Victory (Mint) */}
              {onClaimVictory && (
                <div className="flex w-full flex-col gap-1.5">
                  <PrincipalButton
                    size="large"
                    leadingIcon={<CandyBanner name="btn-claim" className="h-6 w-6" />}
                    onClick={onClaimVictory}
                    aria-label={VICTORY_CLAIM_COPY.claimButton}
                  >
                    {VICTORY_CLAIM_COPY.claimButton}
                    {claimPrice ? ` · ${VICTORY_CLAIM_COPY.claimValueHint(claimPrice)}` : ""}
                  </PrincipalButton>
                  <p className="text-center text-[10px] font-bold uppercase tracking-wider text-amber-800/60">
                    {VICTORY_CLAIM_COPY.claimButtonHint}
                  </p>
                </div>
              )}

              {/* Secondary: Coach Review (Ready for PRO) */}
              {coachPreview && (
                <div className="w-full">
                  {coachPreview}
                </div>
              )}

              {/* Tertiary: Play Again & Share */}
              <div className="mt-1 flex w-full gap-2">
                <Button
                  type="button"
                  variant="game-ghost"
                  size="game-md"
                  onClick={onPlayAgain}
                  className="flex-1 !h-12 border-amber-900/10 bg-amber-900/5"
                >
                  <CandyIcon name="refresh" className="inline h-4 w-4" />
                  <span className="ml-1.5">{ARENA_COPY.playAgain}</span>
                </Button>
                <Button
                  type="button"
                  variant="game-ghost"
                  size="game-md"
                  onClick={() => setShareOpen(true)}
                  className="flex-1 !h-12 border-amber-900/10 bg-amber-900/5"
                >
                  <CandyIcon name="share" className="inline h-4 w-4" />
                  <span className="ml-1.5">{SHARE_COPY.button}</span>
                </Button>
              </div>

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
            {/* Hero — Trophy with breathing halo */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-40 w-40 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_40%,rgba(217,180,74,0.05)_65%,transparent_80%)]" />
              <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(255,220,120,0.20)_0%,transparent_70%)]" />
              <div className="relative h-32 w-32">
                <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
              </div>
            </div>



            {/* Performance summary — secondary after the headline,
                fades in on --duration-enter after the headline lands. */}
            <p
              className="text-sm animate-in fade-in duration-300 fill-mode-both [animation-delay:400ms]"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              {performanceLine}
            </p>

            {/* Stats — 3 mini-cards, enter after the performance line */}
            <div className="flex w-full gap-2 animate-in fade-in slide-in-from-bottom-1 duration-300 fill-mode-both [animation-delay:500ms]">
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
