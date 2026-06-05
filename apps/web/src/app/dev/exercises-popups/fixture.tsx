"use client";

import { LabyrinthCompleteOverlay } from "@/components/exercises/labyrinth-complete-overlay";
import { PieceCompletePrompt, ResultOverlay } from "@/components/exercises/result-overlay";

type Variant =
  | "piece-complete-final"
  | "labyrinth-king-solved"
  | "score-saved";

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
 *   3. score-saved             — ResultOverlay on-chain receipt with
 *      CeloScan chip.
 */
export function ExercisesPopupsFixture({ variant }: { variant: Variant }) {
  return (
    <main
      data-testid="dev-exercises-popups-root"
      className="relative min-h-[100dvh] w-full"
      style={{
        backgroundImage: 'url("/art/bg-playhub-forest-mobile.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
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
          txHash="0xabc"
          celoscanHref="https://celoscan.io/tx/0xabc"
          onDismiss={noop}
        />
      )}
    </main>
  );
}
