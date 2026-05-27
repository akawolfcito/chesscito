"use client";

import { ArenaEndState, CoachAnalysisCta, type ClaimPhase } from "@/components/arena/arena-end-state";
import type { ArenaStatus } from "@/lib/game/types";

type CoachVariant = "coach-cta-enabled" | "coach-cta-disabled-short" | "coach-cta-disabled-persisting";
type WinVariant = "win-celebration" | "win-claiming" | "win-success" | "win-error" | "win-cancelled" | "win-timeout";
type Variant = ArenaStatus | CoachVariant | WinVariant;

const WIN_PHASES: Record<WinVariant, ClaimPhase> = {
  "win-celebration": "ready",
  "win-claiming": "claiming",
  "win-success": "success",
  "win-error": "error",
  "win-cancelled": "cancelled",
  "win-timeout": "timeout",
};

export function ArenaEndStateFixture({ variant }: { variant: Variant }) {
  if (variant.startsWith("coach-cta")) {
    return (
      <main
        data-testid="dev-arena-end-state-root"
        className="relative min-h-[100dvh] w-full bg-[#1a0f0a] p-6"
      >
        <div className="mx-auto w-full max-w-[var(--app-max-width)]">
          <CoachAnalysisCta
            position="primary-on-lose"
            onClick={() => {}}
            disabled={variant !== "coach-cta-enabled"}
            ariaBusy={variant === "coach-cta-disabled-persisting"}
            tooShort={variant === "coach-cta-disabled-short"}
          />
        </div>
      </main>
    );
  }

  const isWin = variant.startsWith("win-");
  const claimPhase: ClaimPhase = isWin ? WIN_PHASES[variant as WinVariant] : "ready";
  const status: ArenaStatus = isWin ? "checkmate" : (variant as ArenaStatus);

  return (
    <main
      data-testid="dev-arena-end-state-root"
      className="relative min-h-[100dvh] w-full"
    >
      <ArenaEndState
        status={status}
        isPlayerWin={isWin}
        onPlayAgain={() => {}}
        onBackToHub={() => {}}
        claimPhase={claimPhase}
        claimStep="confirming"
        shareStatus={claimPhase === "success" ? "ready" : "locked"}
        claimData={{
          tokenId: claimPhase === "success" ? 42n : null,
          claimTxHash: claimPhase === "success" ? "0xabc" : null,
          shareCardUrl: claimPhase === "success" ? "/api/og/match?moves=24&time=180000&diff=easy&result=win" : null,
          shareLinkUrl: claimPhase === "success" ? "https://chesscito.com/m/test" : null,
        }}
        onClaimVictory={isWin && claimPhase === "ready" ? () => {} : undefined}
        claimPrice={isWin ? "$0.005" : undefined}
        claimError={claimPhase === "error" ? "Insufficient gas. Top up your wallet and try again." : null}
        moves={isWin ? 24 : 0}
        elapsedMs={isWin ? 184_000 : 16_000}
        difficulty="easy"
        playerColor="w"
        onAskCoach={() => {}}
        persistState="persisted"
        gameRecordPersisted={true}
      />
    </main>
  );
}
