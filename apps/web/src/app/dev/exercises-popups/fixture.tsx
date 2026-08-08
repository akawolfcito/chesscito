"use client";

import { LabyrinthCompleteOverlay } from "@/components/exercises/labyrinth-complete-overlay";
import { PieceCompletePrompt, ResultOverlay } from "@/components/exercises/result-overlay";
import { SavedChip } from "@/components/exercises/saved-chip";
import { ActionPin } from "@/components/redesign/action-pin";
import { ContextualActionSlot } from "@/components/exercises/contextual-action-slot";

export type ExercisesPopupsVariant =
  | "piece-complete-final"
  | "labyrinth-king-solved"
  | "labyrinth-consequence-worst-case"
  | "score-saved"
  | "score-saved-peones"
  | "saved-chip"
  | "save-cta"
  | "reward-dual"
  | "result-badge"
  | "result-shop"
  | "result-error";

const noop = () => {};

/**
 * Minimal fixture for the 3 popups migrated to the arena-end-state
 * vocabulary on 2026-06-05. Smaller scope than the original 8-variant
 * sweep (reverted in `120a42e9` because the button family was still in
 * flux) — now that `PrincipalButton` is settled we lock the three
 * canonical states the player actually sees at the end of the
 * training cascade.
 *
 *   1. piece-complete-final    — King "All Exercises Complete!" pose
 *      (no nextPiece, onChoosePiece wired).
 *   2. labyrinth-king-solved   — King labyrinth solved + Enter Arena
 *      primary CTA (the cascade-closing surface gated by
 *      `areAllLabyrinthsSolved("king", …)` in exercises-screen).
 *   3. score-saved             — ResultOverlay off-chain save (Slice 5):
 *      no tx, no CeloScan chip. The base save is now /api/scores/save.
 *   4. score-saved-peones      — same, but the save cost 1 Peón (past the
 *      5 free saves) so the cost pill renders beside the stars.
 */
export function ExercisesPopupsFixture({
  variant,
}: {
  variant: ExercisesPopupsVariant;
}) {
  return (
    <main
      data-testid="dev-exercises-popups-root"
      className="arena-bg relative min-h-[100dvh] w-full"
    >
      {variant === "piece-complete-final" && (
        <PieceCompletePrompt
          pieceType="king"
          nextPiece={null}
          hasClaimedBadge={true}
          totalStars={15}
          maxPossibleStars={30}
          onNextPiece={noop}
          onArena={noop}
          onPracticeAgain={noop}
          onChoosePiece={noop}
        />
      )}

      {variant === "labyrinth-king-solved" && (
        <LabyrinthCompleteOverlay
          moves={4}
          optimalMoves={3}
          stars={2}
          previousBest={6}
          isNewBest={true}
          onContinue={noop}
          onRetry={noop}
          onEnterArena={noop}
        />
      )}

      {/* AC-11 / AC-12: the TALLEST the overlay can get. Personal record AND
          consequence together (the spec allows both), the longest of the six
          consequence lines, and the King finale's two-button stack. The paired
          `labyrinth-king-solved` variant above passes no consequence, so the
          two baselines together prove AC-2: without one, nothing moves.

          ⚠️ A fixture that forgets a prop photographs less than what ships —
          `vr13-labyrinth-king-solved` would have stayed green through this
          whole feature. That is why the consequence is passed HERE. */}
      {variant === "labyrinth-consequence-worst-case" && (
        <LabyrinthCompleteOverlay
          moves={4}
          optimalMoves={3}
          stars={2}
          previousBest={6}
          isNewBest={true}
          consequence={{ kind: "lane_progress", done: 3, total: 3 }}
          onContinue={noop}
          onRetry={noop}
          onEnterArena={noop}
        />
      )}

      {variant === "score-saved" && (
        <ResultOverlay
          variant="score"
          pieceType="bishop"
          totalStars={15}
          onDismiss={noop}
        />
      )}

      {variant === "score-saved-peones" && (
        /* B2 (Lote 2): off-chain save is free — no Peones-spent pill. */
        <ResultOverlay
          variant="score"
          pieceType="bishop"
          totalStars={15}
          onDismiss={noop}
        />
      )}

      {variant === "saved-chip" && (
        <div className="flex min-h-[100dvh] items-center justify-center">
          <SavedChip stars={12} total={15} />
        </div>
      )}

      {variant === "save-cta" && (
        <div className="flex min-h-[100dvh] items-center justify-center px-6">
          <div className="w-full max-w-[var(--app-max-width)]">
            <ActionPin
              action="submitScore"
              size="full"
              label="SAVE SCORE"
              ariaLabel="Save score"
              onPress={noop}
            />
          </div>
        </div>
      )}

      {variant === "reward-dual" && (
        /* MiniPay Lote 2 F1: the off-chain SAVE pin was removed — CLAIM is the
           only reward pin now (off-chain save auto-runs). */
        <div className="flex min-h-[100dvh] items-center justify-center">
          <div className="flex items-center justify-center gap-3">
            {(["claimBadge"] as const).map((a) => (
              <ContextualActionSlot
                key={a}
                action={a}
                shieldsAvailable={0}
                isBusy={false}
                onUseShield={noop}
                onClaimBadge={noop}
                onRetry={noop}
                onConnectWallet={noop}
                onSwitchNetwork={noop}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {variant === "result-badge" && (
        <ResultOverlay
          variant="badge"
          pieceType="rook"
          totalStars={12}
          txHash="0xdef"
          celoscanHref="https://celoscan.io/tx/0xdef"
          onDismiss={noop}
        />
      )}

      {variant === "result-shop" && (
        <ResultOverlay
          variant="shop"
          itemLabel="20 Coach Credits"
          itemAsset="/art/shop/coach-pack-20"
          txHash="0x123"
          celoscanHref="https://celoscan.io/tx/0x123"
          onDismiss={noop}
        />
      )}

      {variant === "result-error" && (
        <ResultOverlay
          variant="error"
          errorKind="error"
          errorMessage="Transaction rejected"
          onDismiss={noop}
          onRetry={noop}
        />
      )}
    </main>
  );
}
