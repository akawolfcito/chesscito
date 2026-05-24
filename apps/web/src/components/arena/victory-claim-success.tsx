"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { track } from "@/lib/telemetry";
import { SHARE_COPY } from "@/lib/content/editorial";
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
  const tArena = useTranslations("ARENA_COPY");
  const tClaim = useTranslations("VICTORY_CLAIM_COPY");
  const tCelebration = useTranslations("VICTORY_CELEBRATION_COPY");
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
  const challengeText = tClaim("challengeText", { moves, url: shareUrl });
  const isShareReady = shareStatus === "ready";
  const playAgainLabel = tArena("playAgain");
  const difficultyKey = difficulty as "easy" | "medium" | "hard";
  const difficultyLabel = ["easy", "medium", "hard"].includes(difficultyKey)
    ? tArena(`difficulty.${difficultyKey}`)
    : difficulty;

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

      <header
        className="absolute inset-x-0 top-0 z-20 border-b border-[rgba(110,65,15,0.30)] pt-[env(safe-area-inset-top)]"
      >
        <div className="mx-auto w-full max-w-[var(--app-max-width)] px-2">
          <ContextualHeader
            variant="back-control"
            title={tArena("title")}
            back={{ onClick: onBackToHub, label: tArena("backToHubAria") }}
          />
        </div>
      </header>

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
            {tClaim("successTitle")}
          </span>

          <h1 className="arena-result-title victory-text-slam">
            {tClaim("claimedBadge")}
          </h1>

          <p className="arena-result-subtitle">
            {tCelebration("performanceLineCheckmate", { moves, time })}
          </p>
        </section>

        <div className="arena-result-stats">
          <PaperStatCard
            icon={<CandyIcon name="crosshair" className="h-4 w-4" />}
            value={difficultyLabel}
            label={tCelebration("stats.difficulty")}
          />
          <PaperStatCard
            icon={<CandyIcon name="move" className="h-4 w-4" />}
            value={String(moves)}
            label={tCelebration("stats.moves")}
          />
          <PaperStatCard
            icon={<CandyIcon name="time" className="h-4 w-4" />}
            value={time}
            label={tCelebration("stats.time")}
          />
        </div>

        <button
          type="button"
          onClick={onPlayAgain}
          className="arena-result-primary-cta arena-result-primary-cta--amber"
          aria-label={playAgainLabel}
        >
          <CandyIcon name="refresh" className="h-5 w-5 shrink-0" />
          <span className="arena-result-primary-cta-label">{playAgainLabel}</span>
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
              <span>{tClaim("reviewMatchCta")}</span>
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
