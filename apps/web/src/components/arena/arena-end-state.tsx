"use client";

import { ARENA_COPY, VICTORY_CELEBRATION_COPY } from "@/lib/content/editorial";
import { Button } from "@/components/ui/button";
import { CandyButton } from "@/components/redesign/candy-button";
import type { ArenaStatus } from "@/lib/game/types";
import { AskCoachButton } from "@/components/coach/ask-coach-button";
import { StatCard } from "@/components/arena/stat-card";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { formatTime } from "@/lib/game/arena-utils";
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
  onAskCoach,
}: Props) {
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
          />
        );
    }
  }

  const text = getLoseText(status);
  if (!text) return null;

  const time = formatTime(elapsedMs);

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-[var(--overlay-scrim)] pb-[15vh] animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      <div className="panel-showcase mx-4 flex w-full max-w-[340px] flex-col items-center gap-4 px-6 pb-6 pt-8 shadow-[0_0_60px_rgba(251,113,133,0.08)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <picture>
          <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
          <img
            src="/art/favicon-wolf.png"
            alt=""
            aria-hidden="true"
            className="h-14 w-14 drop-shadow-[var(--accent-drop-shadow)]"
          />
        </picture>
        <h2
          className="fantasy-title text-2xl font-bold text-rose-300 animate-in fade-in slide-in-from-bottom-2 duration-300"
          style={{ textShadow: "var(--text-shadow-hero-rose)" }}
        >
          {text}
        </h2>
        <div className="flex w-full gap-2">
          <StatCard icon={<CandyIcon name="crosshair" className="h-4 w-4" />} value={ARENA_COPY.difficulty[difficulty as keyof typeof ARENA_COPY.difficulty] ?? difficulty} label={VICTORY_CELEBRATION_COPY.stats.difficulty} />
          <StatCard icon={<CandyIcon name="move" className="h-4 w-4" />} value={String(moves)} label={VICTORY_CELEBRATION_COPY.stats.moves} />
          <StatCard icon={<CandyIcon name="time" className="h-4 w-4" />} value={time} label={VICTORY_CELEBRATION_COPY.stats.time} />
        </div>
        <div className="flex flex-col items-center gap-2 w-full max-w-[260px]">
          <CandyButton
            variant="play"
            onClick={onPlayAgain}
            ariaLabel={ARENA_COPY.playAgain}
            className="w-full"
          />
          {onAskCoach && (
            <AskCoachButton onClick={onAskCoach} />
          )}
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            onClick={onBackToHub}
          >
            {ARENA_COPY.backToHub}
          </Button>
        </div>
      </div>
    </div>
  );
}
