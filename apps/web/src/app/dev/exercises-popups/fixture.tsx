"use client";

import { LabyrinthCompleteOverlay } from "@/components/exercises/labyrinth-complete-overlay";
import { PieceCompletePrompt, ResultOverlay } from "@/components/exercises/result-overlay";

type Variant =
  | "piece-complete-next"
  | "piece-complete-labyrinth"
  | "piece-complete-choose"
  | "piece-complete-arena-fallback"
  | "labyrinth-solved-perfect"
  | "labyrinth-solved-suboptimal"
  | "labyrinth-solved-new-best"
  | "score-saved";

const noop = () => {};

export function ExercisesPopupsFixture({ variant }: { variant: Variant }) {
  return (
    <main
      data-testid="dev-exercises-popups-root"
      className="relative min-h-[100dvh] w-full"
      style={{
        backgroundImage:
          'url("/art/bg-playhub-forest-mobile.png")',
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {variant === "piece-complete-next" && (
        <PieceCompletePrompt
          pieceType="rook"
          nextPiece="bishop"
          hasClaimedBadge={true}
          totalStars={15}
          onNextPiece={noop}
          onArena={noop}
          onPracticeAgain={noop}
        />
      )}

      {variant === "piece-complete-labyrinth" && (
        <PieceCompletePrompt
          pieceType="rook"
          nextPiece={null}
          hasClaimedBadge={true}
          totalStars={15}
          onNextPiece={noop}
          onArena={noop}
          onPracticeAgain={noop}
          onTryLabyrinth={noop}
          onSubmitScore={noop}
        />
      )}

      {variant === "piece-complete-choose" && (
        <PieceCompletePrompt
          pieceType="king"
          nextPiece={null}
          hasClaimedBadge={true}
          totalStars={12}
          onNextPiece={noop}
          onArena={noop}
          onPracticeAgain={noop}
          onChoosePiece={noop}
        />
      )}

      {variant === "piece-complete-arena-fallback" && (
        <PieceCompletePrompt
          pieceType="king"
          nextPiece={null}
          hasClaimedBadge={true}
          totalStars={9}
          onNextPiece={noop}
          onArena={noop}
          onPracticeAgain={noop}
        />
      )}

      {variant === "labyrinth-solved-perfect" && (
        <LabyrinthCompleteOverlay
          moves={3}
          optimalMoves={3}
          stars={3}
          previousBest={3}
          isNewBest={false}
          onRetry={noop}
          onBack={noop}
        />
      )}

      {variant === "labyrinth-solved-suboptimal" && (
        <LabyrinthCompleteOverlay
          moves={5}
          optimalMoves={3}
          stars={1}
          previousBest={6}
          isNewBest={false}
          onRetry={noop}
          onBack={noop}
        />
      )}

      {variant === "labyrinth-solved-new-best" && (
        <LabyrinthCompleteOverlay
          moves={4}
          optimalMoves={3}
          stars={2}
          previousBest={6}
          isNewBest={true}
          onRetry={noop}
          onBack={noop}
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
