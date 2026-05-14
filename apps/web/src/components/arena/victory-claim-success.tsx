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
      <div className="relative z-10 flex w-full max-w-[390px] flex-col gap-6 px-5 py-8 animate-in zoom-in-95 slide-in-from-bottom-6 duration-500">
        <div className="flex flex-col items-center gap-2 text-center">
          <h2
            className="fantasy-title victory-text-slam text-4xl font-extrabold tracking-tight"
            style={{
              color: "#fff8e1",
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.4), 0 0 20px rgba(245, 158, 11, 0.3)",
            }}
          >
            {VICTORY_CLAIM_COPY.claimedBadge}
          </h2>
          <p className="text-sm font-medium tracking-wide text-amber-100/80">
            {VICTORY_CLAIM_COPY.successTitle}
          </p>
        </div>

        <CandyGlassShell
          title=""
          onClose={onBackToHub}
          closeLabel={ARENA_COPY.backToHub}
          className="!max-h-none !gap-4 shadow-2xl"
          cta={
            <div className="flex w-full flex-col gap-3">
              {/* Secondary: Coach Review (Ready for PRO) */}
              {coachPreview && (
                <div className="w-full">
                  {coachPreview}
                </div>
              )}

              {/* Primary: Play Again or Share */}
              <div className="flex w-full flex-col gap-2.5">
                <PrincipalButton
                  size="medium"
                  leadingIcon={<CandyIcon name="refresh" className="h-4 w-4" />}
                  onClick={onPlayAgain}
                  aria-label={ARENA_COPY.playAgain}
                >
                  {ARENA_COPY.playAgain}
                </PrincipalButton>

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
                      className="flex-1 border-amber-900/10 bg-amber-900/5"
                    >
                      <CandyIcon name="share" className="inline h-4 w-4" />
                      <span className="ml-1.5">{SHARE_COPY.button}</span>
                    </Button>
                  )}
                </div>
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
            {/* Hero — Trophy with amber glow (reward state) */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-36 w-36 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.28)_0%,rgba(217,180,74,0.12)_50%,transparent_70%)]" />
              <div className="relative h-32 w-32">
                <LottieAnimation animationData={trophyData} loop={false} className="h-full w-full" />
              </div>
            </div>



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
