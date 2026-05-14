"use client";

import { type ReactNode, useEffect, useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
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
import type { ClaimData, ShareStatus } from "./arena-end-state";
import sparklesData from "@/../public/animations/sparkles.json";
import trophyData from "@/../public/animations/trophy.json";

type Props = {
  moves: number;
  elapsedMs: number;
  difficulty: string;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  claimData: ClaimData;
  shareStatus: ShareStatus;
  onAskCoach?: () => void;
  coachPreview?: ReactNode;
};

export function VictoryClaimSuccess({
  moves,
  elapsedMs,
  difficulty,
  onPlayAgain,
  onBackToHub,
  claimData,
  shareStatus,
  onAskCoach,
  coachPreview,
}: Props) {
  const time = formatTime(elapsedMs);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    track("modal_open", {
      id: "victory-claim-success",
      difficulty,
      moves,
    });
  }, [difficulty, moves]);

  const shareUrl = claimData.shareLinkUrl ?? SHARE_COPY.url;
  const challengeText = VICTORY_CLAIM_COPY.challengeText(moves, shareUrl);
  const isShareReady = shareStatus === "ready";

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex flex-col items-center justify-center result-screen-overlay animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      {/* Sparkles background — intensified for success */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation animationData={sparklesData} speed={1.5} className="h-full w-full opacity-60" />
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
            <div className="flex w-full flex-col gap-3 animate-in fade-in duration-300 fill-mode-both [animation-delay:400ms]">
              {/* Secondary Value: Coach Review Card */}
              {coachPreview && (
                <div className="w-full">
                  {coachPreview}
                </div>
              )}

              {/* Primary / secondary actions */}
              <div className="flex w-full gap-2">
                <PrincipalButton
                  size="medium"
                  leadingIcon={<CandyIcon name="refresh" className="h-4 w-4" />}
                  onClick={onPlayAgain}
                  className="flex-1"
                  aria-label={ARENA_COPY.playAgain}
                >
                  {ARENA_COPY.playAgain}
                </PrincipalButton>
              </div>

              <div className="flex w-full gap-2">
                {onAskCoach && (
                  <AskCoachButton onClick={onAskCoach} className="flex-1" />
                )}

                {isShareReady && (
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
                )}
              </div>

              {/* Exit shortcut */}
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
            {/* Header: Trophy + Status + Claimed! */}
            <div className="flex flex-col items-center pt-1">
              <div className="relative flex h-24 w-24 items-center justify-center">
                <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.30)_0%,rgba(217,180,74,0.15)_50%,transparent_70%)]" />
                <LottieAnimation animationData={trophyData} loop={false} className="relative h-full w-full" />
              </div>

              <div className="mt-1.5 flex flex-col items-center gap-0.5">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-900/60">
                  {VICTORY_CLAIM_COPY.successTitle}
                </span>
                <h2
                  className="fantasy-title victory-text-slam text-[32px] font-extrabold leading-tight tracking-tight"
                  style={{
                    color: "rgba(110, 65, 15, 0.95)",
                    textShadow: "0 1px 0 rgba(255, 245, 215, 0.80), 0 2px 8px rgba(245, 158, 11, 0.40)",
                  }}
                >
                  {VICTORY_CLAIM_COPY.claimedBadge}
                </h2>
              </div>
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

      <ShareModal
        open={shareOpen}
        onOpenChange={setShareOpen}
        cardUrl={claimData.shareCardUrl}
        text={challengeText}
        url={shareUrl}
      />
    </div>
  );
}
