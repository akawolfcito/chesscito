"use client";

import { useRouter } from "next/navigation";
import { useChessGame } from "@/lib/game/use-chess-game";
import { ArenaBoard } from "@/components/arena/arena-board";
import { DifficultySelector } from "@/components/arena/difficulty-selector";
import { ArenaHud } from "@/components/arena/arena-hud";
import { PromotionOverlay } from "@/components/arena/promotion-overlay";
import { ArenaEndState } from "@/components/arena/arena-end-state";
import { ARENA_COPY } from "@/lib/content/editorial";

export default function ArenaPage() {
  const router = useRouter();
  const game = useChessGame();

  const isEndState = ["checkmate", "stalemate", "draw", "resigned"].includes(game.status);

  // After checkmate, chess.js turn belongs to the mated side.
  // If black to move (" b ") → black is mated → player (white) wins.
  const isPlayerWin = game.status === "checkmate" && game.fen.includes(" b ");

  const handleBackToHub = () => router.push("/play-hub");

  // Loading state — animated progress dots + cancel
  if (game.status === "loading") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center arena-bg">
        <div className="flex flex-col items-center gap-5">
          <img
            src="/art/favicon-wolf.png"
            alt=""
            aria-hidden="true"
            className="h-16 w-16 animate-pulse drop-shadow-[0_0_20px_rgba(103,232,249,0.5)]"
          />
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/50">
              {ARENA_COPY.difficulty[game.difficulty]}
            </span>
            <p className="text-sm text-white/50">{ARENA_COPY.preparingAi}</p>
            <div className="flex items-center gap-1.5 pt-1">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/70 animate-bounce [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/70 animate-bounce [animation-delay:150ms]" />
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/70 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
          <button
            type="button"
            onClick={game.reset}
            className="mt-2 text-xs text-white/30 transition-colors hover:text-white/50"
          >
            Cancel
          </button>
        </div>
      </main>
    );
  }

  // Difficulty selection
  if (game.status === "selecting") {
    return (
      <main className="flex min-h-[100dvh] flex-col items-center justify-center arena-bg">
        <DifficultySelector
          selected={game.difficulty}
          onSelect={game.setDifficulty}
          onStart={game.startGame}
        />
        {game.errorMessage && (
          <div className="mx-6 mt-2 flex flex-col items-center gap-2.5 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3">
            <span className="text-center text-sm text-rose-300">{game.errorMessage}</span>
            <button
              type="button"
              onClick={game.startGame}
              className="rounded-xl bg-cyan-500/20 px-5 py-1.5 text-xs font-semibold text-cyan-300 transition-all hover:bg-cyan-500/30 active:scale-95"
            >
              {ARENA_COPY.loadingRetry}
            </button>
          </div>
        )}
      </main>
    );
  }

  // Playing + end states
  return (
    <main className="flex min-h-[100dvh] flex-col items-center arena-bg">
      <div className="flex w-full max-w-[var(--app-max-width,390px)] flex-col">
        <ArenaHud
          difficulty={game.difficulty}
          isThinking={game.isThinking}
          onBack={game.reset}
        />

        <div className="relative w-full">
          <ArenaBoard
            pieces={game.pieces}
            selectedSquare={game.selectedSquare}
            legalMoves={game.legalMoves}
            lastMove={game.lastMove}
            checkSquare={game.checkSquare}
            isLocked={game.isThinking || isEndState}
            onSquareClick={game.selectSquare}
          />
          {game.pendingPromotion && (
            <PromotionOverlay onSelect={game.promoteWith} onCancel={game.cancelPromotion} />
          )}
        </div>

        {/* Error banner */}
        {game.errorMessage && (
          <div className="mx-3 mt-2 flex items-center justify-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-2.5">
            <span className="text-sm text-rose-300">{game.errorMessage}</span>
            <button
              type="button"
              onClick={game.reset}
              className="shrink-0 rounded-xl bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-300 transition-all hover:bg-rose-500/30 active:scale-95"
            >
              {ARENA_COPY.restartMatch}
            </button>
          </div>
        )}

        {/* Actions bar */}
        {!isEndState && !game.errorMessage && (
          <div className="flex items-center justify-center px-4 py-3">
            <button
              type="button"
              onClick={game.resign}
              className="rounded-2xl border border-white/8 bg-white/5 px-8 py-2.5 text-sm font-semibold text-white/50 backdrop-blur-sm transition-all hover:bg-white/10 hover:text-white/70 active:scale-95"
            >
              {ARENA_COPY.resign}
            </button>
          </div>
        )}
      </div>

      {isEndState && (
        <ArenaEndState
          status={game.status}
          isPlayerWin={isPlayerWin}
          onPlayAgain={game.reset}
          onBackToHub={handleBackToHub}
        />
      )}
    </main>
  );
}
