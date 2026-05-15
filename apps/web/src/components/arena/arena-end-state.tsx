"use client";

import { type ReactNode, useEffect } from "react";
import { ARENA_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";

import type { ArenaStatus } from "@/lib/game/types";
import { AskCoachButton } from "@/components/coach/ask-coach-button";
import { PaperStatCard } from "@/components/arena/paper-stat-card";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { formatTime } from "@/lib/game/arena-utils";
import type { PlayerColor } from "@/lib/game/use-chess-game";
import { track } from "@/lib/telemetry";
import { VictoryCelebration } from "./victory-celebration";
import { VictoryClaiming } from "./victory-claiming";
import { VictoryClaimSuccess } from "./victory-claim-success";
import { VictoryClaimError } from "./victory-claim-error";

export type ClaimPhase = "ready" | "claiming" | "success" | "error" | "cancelled" | "timeout";

export type ShareStatus = "locked" | "generating" | "ready";

export type ClaimData = {
  tokenId: bigint | null;
  claimTxHash: string | null;
  shareCardUrl: string | null;
  shareLinkUrl: string | null;
};

type Props = {
  status: ArenaStatus;
  isPlayerWin: boolean;
  onPlayAgain: () => void;
  onBackToHub: () => void;
  claimPhase: ClaimPhase;
  claimStep?: "signing" | "confirming" | "done";
  shareStatus: ShareStatus;
  claimData: ClaimData;
  onClaimVictory?: () => void;
  claimPrice?: string;
  claimError?: string | null;
  moves: number;
  elapsedMs: number;
  difficulty: string;
  fen?: string;
  playerColor?: PlayerColor;
  onAskCoach?: () => void;
  coachPreview?: ReactNode;
};

function getLoseText(status: ArenaStatus): string {
  switch (status) {
    case "checkmate":
      return ARENA_COPY.endState.checkmate.lose;
    case "stalemate":
      return ARENA_COPY.endState.stalemate;
    case "draw":
      return ARENA_COPY.endState.draw;
    case "resigned":
      return ARENA_COPY.endState.resigned;
    default:
      return "";
  }
}

export function ArenaEndState({
  status,
  isPlayerWin,
  onPlayAgain,
  onBackToHub,
  claimPhase,
  claimStep,
  shareStatus,
  claimData,
  onClaimVictory,
  claimPrice,
  claimError,
  moves,
  elapsedMs,
  difficulty,
  fen,
  playerColor,
  onAskCoach,
  coachPreview,
}: Props) {
  /* Hooks must run unconditionally on every render (React rules-of-hooks).
     Compute `text` here so the effect — and the early-return path below —
     share the same source. The effect's own guard skips the track() call
     on win / no-text, preserving previous behavior. */
  const text = getLoseText(status);

  useEffect(() => {
    if (!text || isPlayerWin) return;
    track("modal_open", {
      id: "arena-loss",
      status,
      difficulty,
      moves,
    });
  }, [text, isPlayerWin, status, difficulty, moves]);

  if (isPlayerWin) {
    const sharedProps = {
      moves,
      elapsedMs,
      difficulty,
      isCheckmate: status === "checkmate",
      onPlayAgain,
      onBackToHub,
    };

    switch (claimPhase) {
      case "claiming":
        return <VictoryClaiming {...sharedProps} claimStep={claimStep} />;
      case "success":
        return (
          <VictoryClaimSuccess
            {...sharedProps}
            claimData={claimData}
            shareStatus={shareStatus}
            onAskCoach={onAskCoach}
            coachPreview={coachPreview}
          />
        );
      case "error":
        return (
          <VictoryClaimError
            {...sharedProps}
            errorMessage={claimError}
            onRetry={onClaimVictory}
            kind="error"
          />
        );
      case "cancelled":
        return (
          <VictoryClaimError
            {...sharedProps}
            onRetry={onClaimVictory}
            kind="cancelled"
          />
        );
      case "timeout":
        return (
          <VictoryClaimError
            {...sharedProps}
            onRetry={onClaimVictory}
            kind="timeout"
          />
        );
      default:
        return (
          <VictoryCelebration
            {...sharedProps}
            onClaimVictory={onClaimVictory}
            claimPrice={claimPrice}
            fen={fen}
            playerColor={playerColor}
            onAskCoach={onAskCoach}
            coachPreview={coachPreview}
          />
        );
    }
  }

  if (!text) return null;

  const time = formatTime(elapsedMs);

  return (
    <div
      className="result-screen-overlay pointer-events-auto fixed inset-0 z-50 animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-label={text}
    >
      <main className="arena-result-screen">
        <section className="arena-result-header">
          <div className="arena-result-trophy">
            <div className="arena-result-trophy-glow" />
            <picture className="relative flex h-3/5 w-3/5 items-center justify-center">
              <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
              <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
              <img
                src="/art/favicon-wolf.png"
                alt=""
                aria-hidden="true"
                className="h-9 w-9 opacity-50 drop-shadow-[0_4px_12px_rgba(120,65,5,0.30)]"
              />
            </picture>
          </div>

          <span className="arena-result-kicker">Match Ended</span>

          <h1 className="arena-result-title">{text}</h1>

          <p className="arena-result-subtitle">Try again when ready.</p>
        </section>

        <div className="arena-result-stats">
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

        {coachPreview && (
          <div className="arena-result-coach-wrap">{coachPreview}</div>
        )}

        <button
          type="button"
          onClick={onPlayAgain}
          className="arena-result-primary-cta arena-result-primary-cta--amber"
        >
          <CandyIcon name="refresh" className="h-5 w-5 shrink-0" />
          <span className="arena-result-primary-cta-label">{ARENA_COPY.playAgain}</span>
        </button>

        {!coachPreview && onAskCoach && (
          <div className="arena-result-coach-wrap">
            <AskCoachButton onClick={onAskCoach} />
          </div>
        )}

        <button
          type="button"
          onClick={onBackToHub}
          className="arena-result-back-link"
        >
          {ARENA_COPY.backToHub}
        </button>
      </main>
    </div>
  );
}
