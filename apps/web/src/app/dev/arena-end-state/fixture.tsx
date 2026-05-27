"use client";

import { ArenaEndState, CoachAnalysisCta } from "@/components/arena/arena-end-state";
import type { ArenaStatus } from "@/lib/game/types";

type Variant = ArenaStatus | "coach-cta-enabled" | "coach-cta-disabled-short" | "coach-cta-disabled-persisting";

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

  const status = variant as ArenaStatus;
  return (
    <main
      data-testid="dev-arena-end-state-root"
      className="relative min-h-[100dvh] w-full"
    >
      <ArenaEndState
        status={status}
        isPlayerWin={false}
        onPlayAgain={() => {}}
        onBackToHub={() => {}}
        claimPhase="ready"
        shareStatus="locked"
        claimData={{
          tokenId: null,
          claimTxHash: null,
          shareCardUrl: null,
          shareLinkUrl: null,
        }}
        moves={0}
        elapsedMs={16_000}
        difficulty="easy"
        playerColor="w"
        onAskCoach={() => {}}
        persistState="persisted"
        gameRecordPersisted={true}
      />
    </main>
  );
}
