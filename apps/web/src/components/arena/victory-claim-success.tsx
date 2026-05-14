"use client";

import { type ReactNode, useEffect, useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { track } from "@/lib/telemetry";
import {
  ARENA_COPY,
  SHARE_COPY,
  VICTORY_CLAIM_COPY,
  VICTORY_CELEBRATION_COPY,
} from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PaperStatCard } from "@/components/arena/paper-stat-card";
import { ShareModal } from "@/components/share/share-modal";
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
      className="result-screen-overlay pointer-events-auto fixed inset-0 z-50 animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation
          animationData={sparklesData}
          speed={1.35}
          className="h-full w-full opacity-[0.22]"
        />
      </div>

      <main className="arena-result-screen relative z-10">
        <section className="arena-result-header">
          <div className="arena-result-trophy">
            <div className="arena-result-trophy-glow" />
            <LottieAnimation
              animationData={trophyData}
              loop={false}
              className="relative h-full w-full"
            />
          </div>

          <span className="arena-result-kicker">
            {VICTORY_CLAIM_COPY.successTitle}
          </span>

          <h1 className="arena-result-title victory-text-slam">
            {VICTORY_CLAIM_COPY.claimedBadge}
          </h1>

          <p className="arena-result-subtitle">
            {VICTORY_CELEBRATION_COPY.performanceLineCheckmate(moves, time)}
          </p>
        </section>

        <div className="arena-result-stats">
          <PaperStatCard
            icon={<CandyIcon name="crosshair" className="h-4 w-4" />}
            value={
              ARENA_COPY.difficulty[
              difficulty as keyof typeof ARENA_COPY.difficulty
              ] ?? difficulty
            }
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

        <button
          type="button"
          onClick={onPlayAgain}
          className="arena-result-primary-cta arena-result-primary-cta--amber"
          aria-label={ARENA_COPY.playAgain}
        >
          <CandyIcon name="refresh" className="h-5 w-5 shrink-0" />
          <span className="arena-result-primary-cta-label">
            {ARENA_COPY.playAgain}
          </span>
        </button>

        {coachPreview && (
          <div className="arena-result-coach-wrap">{coachPreview}</div>
        )}

        <div className="arena-result-secondary-actions">
          {onAskCoach && (
            <button
              type="button"
              onClick={onAskCoach}
              className="arena-result-secondary-action"
            >
              <CandyIcon name="coach" className="h-4 w-4" />
              <span>Review Match</span>
            </button>
          )}

          {isShareReady && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="arena-result-secondary-action"
            >
              <CandyIcon name="share" className="h-4 w-4" />
              <span>{SHARE_COPY.button}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onBackToHub}
          className="arena-result-back-link"
        >
          {ARENA_COPY.backToHub}
        </button>
      </main>

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