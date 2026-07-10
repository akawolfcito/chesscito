"use client";

import { ArenaEndState, CoachAnalysisCta, type ClaimPhase } from "@/components/arena/arena-end-state";
import type { ArenaStatus } from "@/lib/game/types";

type CoachVariant = "coach-cta-enabled" | "coach-cta-disabled-short" | "coach-cta-disabled-persisting";
// No "win-cancelled": a rejected prompt returns to win-celebration + a toast.
type WinVariant = "win-celebration" | "win-claiming" | "win-success" | "win-error" | "win-timeout";
// F8 phase (b) — Save on a non-win popup (a resign with moves > 0 so the
// inline Save tile + its lifecycle surfaces; the bare loss variants keep
// moves=0 and stay Save-less).
type SaveVariant = "loss-save" | "loss-save-claiming" | "loss-save-success" | "loss-save-error";
type Variant = ArenaStatus | CoachVariant | WinVariant | SaveVariant;

const WIN_PHASES: Record<WinVariant, ClaimPhase> = {
  "win-celebration": "ready",
  "win-claiming": "claiming",
  "win-success": "success",
  "win-error": "error",
  "win-timeout": "timeout",
};

const SAVE_PHASES: Record<SaveVariant, ClaimPhase> = {
  "loss-save": "ready",
  "loss-save-claiming": "claiming",
  "loss-save-success": "success",
  "loss-save-error": "error",
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
  const isSave = variant.startsWith("loss-save");
  const claimPhase: ClaimPhase = isWin
    ? WIN_PHASES[variant as WinVariant]
    : isSave
      ? SAVE_PHASES[variant as SaveVariant]
      : "ready";
  // Save variants render a resign with real moves so the inline Save tile +
  // lifecycle is visible; bare loss variants stay at moves=0 (Save-less).
  const status: ArenaStatus = isWin ? "checkmate" : isSave ? "resigned" : (variant as ArenaStatus);
  const moves = isWin ? 24 : isSave ? 22 : 0;

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
        onClaimVictory={
          // Production always passes the mint handler, including post-save,
          // so the success popup re-arms `onSaveAgain` and renders the
          // `--triple` secondary row. Mirror that here (ready + success) so
          // the win-success baseline covers the real 3-button state.
          (isWin && (claimPhase === "ready" || claimPhase === "success")) || isSave
            ? () => {}
            : undefined
        }
        claimPrice={isWin || isSave ? "$0.005" : undefined}
        claimError={claimPhase === "error" ? "Insufficient gas. Top up your wallet and try again." : null}
        moves={moves}
        elapsedMs={isWin ? 184_000 : isSave ? 142_000 : 16_000}
        difficulty="easy"
        playerColor="w"
        onAskCoach={() => {}}
        persistState="persisted"
        gameRecordPersisted={true}
      />
    </main>
  );
}
