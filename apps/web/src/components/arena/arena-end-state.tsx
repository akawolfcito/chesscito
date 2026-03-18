"use client";

import { ARENA_COPY } from "@/lib/content/editorial";
import type { ArenaStatus } from "@/lib/game/types";
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
  shareStatus: ShareStatus;
  claimData: ClaimData;
  onClaimVictory?: () => void;
  claimPrice?: string;
  claimError?: string | null;
  moves: number;
  elapsedMs: number;
  difficulty: string;
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
  shareStatus,
  claimData,
  onClaimVictory,
  claimPrice,
  claimError,
  moves,
  elapsedMs,
  difficulty,
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
        return <VictoryClaiming {...sharedProps} />;
      case "success":
        return (
          <VictoryClaimSuccess
            {...sharedProps}
            claimData={claimData}
            shareStatus={shareStatus}
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

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-black/60 pb-[15vh] animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-[#0b1628]/90 px-8 py-8 backdrop-blur-xl shadow-[0_0_40px_rgba(251,113,133,0.1)] animate-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <img
          src="/art/favicon-wolf.png"
          alt=""
          aria-hidden="true"
          className="h-14 w-14 drop-shadow-[0_0_20px_rgba(103,232,249,0.5)]"
        />
        <h2 className="fantasy-title text-2xl font-bold text-rose-300 drop-shadow-[0_0_16px_rgba(251,113,133,0.4)]">
          {text}
        </h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-6 py-2.5 font-semibold text-white shadow-[0_0_16px_rgba(34,211,238,0.3)] transition-all hover:shadow-[0_0_24px_rgba(34,211,238,0.5)] active:scale-95"
          >
            {ARENA_COPY.playAgain}
          </button>
          <button
            type="button"
            onClick={onBackToHub}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-2.5 font-semibold text-white/70 transition-all hover:bg-white/10 active:scale-95"
          >
            {ARENA_COPY.backToHub}
          </button>
        </div>
      </div>
    </div>
  );
}
