"use client";

import { type ReactNode, useEffect, useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyBanner } from "@/components/redesign/candy-banner";
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
  fen?: string;
  playerColor?: PlayerColor;
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
  const claimLabel = `${VICTORY_CLAIM_COPY.claimButton}${claimPrice ? ` · ${VICTORY_CLAIM_COPY.claimValueHint(claimPrice)}` : ""
    }`;

  return (
    <div
      className="result-screen-overlay pointer-events-auto fixed inset-0 z-50 animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      <div className="pointer-events-none absolute inset-0 z-0">
        <LottieAnimation
          animationData={sparklesData}
          className="h-full w-full opacity-[0.18]"
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
            {VICTORY_CELEBRATION_COPY.title}
          </span>

          <h1 className="arena-result-title victory-text-slam">
            {isCheckmate
              ? VICTORY_CELEBRATION_COPY.headlineCheckmate
              : VICTORY_CELEBRATION_COPY.headlineWin}
          </h1>

          <p className="arena-result-subtitle">{performanceLine}</p>
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

        {onClaimVictory && (
          <button
            type="button"
            onClick={onClaimVictory}
            aria-label={claimLabel}
            className="arena-result-primary-cta"
          >
            <CandyBanner
              name="btn-claim"
              className="h-5 w-5 shrink-0"
              aria-hidden="true"
            />
            <span className="arena-result-primary-cta-label">
              {claimLabel}
            </span>
          </button>
        )}

        {coachPreview && (
          <div className="arena-result-coach-wrap">{coachPreview}</div>
        )}

        <div className="arena-result-secondary-actions">
          <button
            type="button"
            onClick={onPlayAgain}
            className="arena-result-secondary-action"
          >
            <CandyIcon name="refresh" className="h-4 w-4" />
            <span>{ARENA_COPY.playAgain}</span>
          </button>

          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="arena-result-secondary-action"
          >
            <CandyIcon name="share" className="h-4 w-4" />
            <span>{SHARE_COPY.button}</span>
          </button>
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
        cardUrl={cardUrl}
        text={challengeText}
      />
    </div>
  );
}