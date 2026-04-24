"use client";

import { useEffect } from "react";
import { ARENA_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { CandyButton } from "@/components/redesign/candy-button";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
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

export type ClaimPhase = "ready" | "claiming" | "success" | "error";

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
          />
        );
      case "error":
        return (
          <VictoryClaimError
            {...sharedProps}
            errorMessage={claimError}
            onRetry={onClaimVictory}
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
          />
        );
    }
  }

  if (!text) return null;

  const time = formatTime(elapsedMs);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center candy-modal-scrim animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      <div className="relative z-10 mx-4 w-full max-w-[340px] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <CandyGlassShell
          title={text}
          onClose={onBackToHub}
          closeLabel={ARENA_COPY.backToHub}
          cta={
            <div className="flex w-full flex-col items-center gap-2.5">
              <CandyButton
                variant="play"
                onClick={onPlayAgain}
                ariaLabel={ARENA_COPY.playAgain}
                className="w-full"
              />
              {onAskCoach && <AskCoachButton onClick={onAskCoach} />}
              <Button
                type="button"
                variant="game-ghost"
                size="game-sm"
                onClick={onBackToHub}
                className="w-full"
              >
                {ARENA_COPY.backToHub}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="relative flex items-center justify-center">
              <div className="absolute h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(190,18,60,0.12)_0%,transparent_70%)]" />
              <picture className="relative">
                <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
                <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
                <img
                  src="/art/favicon-wolf.png"
                  alt=""
                  aria-hidden="true"
                  className="h-20 w-20 opacity-75 drop-shadow-[0_4px_12px_rgba(120,65,5,0.35)]"
                />
              </picture>
            </div>
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
    </div>
  );
}
