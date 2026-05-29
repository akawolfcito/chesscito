"use client";

import { GameViewer } from "@/components/coach/game-viewer";
import { GameActionsBar } from "@/components/coach/game-actions-bar";

// Four moves of the Italian Game — short and chess-engine-legal so
// useGameReplay can render a settled mid-game position on the board.
const VIEWER_MOVES = ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5"];

// Same prefix + a deliberately illegal SAN to exercise the partial-replay
// error banner path. useGameReplay should stop at index 3 and surface
// `replayStoppedAtMove`.
const PARTIAL_REPLAY_MOVES = ["e4", "e5", "Nf3", "Qz9"];

type Variant =
  | "viewer-win-unminted"
  | "viewer-win-minted"
  | "viewer-loss"
  | "viewer-partial-replay";

export function CoachViewerFixture({ variant }: { variant: Variant }) {
  const isWin = variant === "viewer-win-unminted" || variant === "viewer-win-minted";
  const isMinted = variant === "viewer-win-minted";
  const isPartial = variant === "viewer-partial-replay";

  const moves = isPartial ? PARTIAL_REPLAY_MOVES : VIEWER_MOVES;
  const result = isWin ? "win" : isPartial ? "win" : "lose";

  return (
    <main
      data-testid="dev-coach-viewer-root"
      className="relative min-h-[100dvh] w-full bg-[#1a0f0a] p-4"
    >
      <div className="mx-auto w-full max-w-[var(--app-max-width)] coach-game-client">
        <GameViewer moves={moves} />
        <GameActionsBar
          gameId="00000000-0000-0000-0000-000000000000"
          result={result as "win" | "lose"}
          totalMoves={moves.length}
          hasAnalysis={isMinted}
          hasPartialReplayError={isPartial}
          mintedTokenId={isMinted ? "42" : null}
          shareLinkUrl={isMinted ? "https://chesscito.com/m/test" : null}
          onAskCoach={() => {}}
          onMint={() => {}}
          onShare={() => {}}
          onPlayAgain={() => {}}
          onViewNft={() => {}}
          onBackToHub={() => {}}
        />
      </div>
    </main>
  );
}
