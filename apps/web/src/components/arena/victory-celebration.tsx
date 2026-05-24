"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { track } from "@/lib/telemetry";
import { SHARE_COPY } from "@/lib/content/editorial";
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
  const tArena = useTranslations("ARENA_COPY");
  const tClaim = useTranslations("VICTORY_CLAIM_COPY");
  const tCelebration = useTranslations("VICTORY_CELEBRATION_COPY");
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
    ? tCelebration("performanceLineCheckmate", { moves, time })
    : tCelebration("performanceLine", { moves, time });

  const cardParams = new URLSearchParams({
    moves: String(moves),
    time: String(elapsedMs),
    diff: difficulty,
    result: "win",
  });

  if (fen) cardParams.set("fen", fen);
  if (playerColor) cardParams.set("color", playerColor);

  const cardUrl = `/api/og/match?${cardParams.toString()}`;
  const challengeText = tClaim("challengeText", { moves, url: SHARE_COPY.url });
  const claimButtonLabel = tClaim("claimButton");
  const claimLabel = `${claimButtonLabel}${claimPrice ? ` · ${claimPrice}` : ""}`;
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
          className="h-full w-full opacity-[0.18]"
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

          <span className="arena-result-kicker">{tCelebration("title")}</span>

          <h1 className="arena-result-title victory-text-slam">
            {isCheckmate
              ? tCelebration("headlineCheckmate")
              : tCelebration("headlineWin")}
          </h1>

          <p className="arena-result-subtitle">{performanceLine}</p>
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
            <span>{tArena("playAgain")}</span>
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
