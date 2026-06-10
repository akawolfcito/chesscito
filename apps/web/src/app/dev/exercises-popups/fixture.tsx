"use client";

import { LabyrinthCompleteOverlay } from "@/components/exercises/labyrinth-complete-overlay";
import { PieceCompletePrompt, ResultOverlay } from "@/components/exercises/result-overlay";
import { SavedChip } from "@/components/exercises/saved-chip";

type Variant =
  | "piece-complete-final"
  | "labyrinth-king-solved"
  | "score-saved"
  | "score-saved-peones"
  | "saved-chip"
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
export function ExercisesPopupsFixture({ variant }: { variant: Variant }) {
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
          onRetry={noop}
          onBack={noop}
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
        <ResultOverlay
          variant="score"
          pieceType="bishop"
          totalStars={15}
          spentPeones={1}
          onDismiss={noop}
        />
      )}

      {variant === "saved-chip" && (
        <div className="flex min-h-[100dvh] items-center justify-center">
          <SavedChip stars={12} total={15} />
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
