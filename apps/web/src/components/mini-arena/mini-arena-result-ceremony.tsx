"use client";

import { THEME_CONFIG } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { CandyIcon } from "@/components/redesign/candy-icon";

type Props = {
  status: "won" | "drawn";
  moveCount: number;
  parMoves: number;
  completionStars: number;
  isNewBest: boolean;
  previousBest: number | null;
  onShare: () => void;
  onRetry: () => void;
  onClose: () => void;
};

function starLabel(stars: number): string {
  if (stars >= 3) return "Perfect path";
  if (stars === 2) return "Target reached";
  return "Completed over target";
}

const ROOK_SRC = `${THEME_CONFIG.piecesBase}/w-rook.png`;

export function MiniArenaResultCeremony({
  status,
  moveCount,
  parMoves,
  completionStars,
  isNewBest,
  previousBest,
  onShare,
  onRetry,
  onClose,
}: Props) {
  const title = status === "won" ? "Checkmate!" : "Try Again";

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-4 animate-in fade-in duration-250"
      style={{ background: "rgba(0,0,0,0.30)" }}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[400px]"
        style={{ animation: "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="sheet-bg-hub flex w-full flex-col gap-2 rounded-3xl px-5 py-4"
          style={{
            border: "1px solid rgba(255, 255, 255, 0.45)",
            boxShadow:
              "0 10px 28px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 245, 215, 0.55)",
          }}
        >
          <div className="flex items-center justify-between border-b border-[rgba(110,65,15,0.30)] pb-2">
            <h2
              className="fantasy-title px-2 text-lg font-extrabold"
              style={{
                color: "rgba(110, 65, 15, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
              }}
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="mr-2 flex h-8 w-8 items-center justify-center rounded-full border transition-all active:scale-[0.94]"
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                borderColor: "rgba(255, 255, 255, 0.45)",
                color: "#dc2626",
                backdropFilter: "blur(6px)",
              }}
            >
              <CandyIcon name="close" className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div className="flex flex-col items-center gap-1.5 py-1 text-center">
            <picture
              className="reward-icon-showcase relative z-10"
              style={{ animation: "reward-icon-enter 250ms ease-out 200ms both" }}
            >
              <source srcSet={ROOK_SRC.replace(".png", ".avif")} type="image/avif" />
              <source srcSet={ROOK_SRC.replace(".png", ".webp")} type="image/webp" />
              <img
                src={ROOK_SRC}
                alt=""
                className="h-20 w-20 object-contain drop-shadow-lg"
              />
            </picture>

            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => {
                const filled = i < completionStars;
                return (
                  <span
                    key={i}
                    className={`reward-ceremony-star inline-block text-2xl ${
                      filled ? "text-amber-500" : "text-amber-700/25"
                    }`}
                    style={
                      filled
                        ? {
                            opacity: 0,
                            animation: `reward-star-bounce 350ms cubic-bezier(0.34, 1.56, 0.64, 1) ${400 + i * 150}ms forwards`,
                          }
                        : undefined
                    }
                    aria-hidden="true"
                  >
                    {filled ? "★" : "☆"}
                  </span>
                );
              })}
              <span
                className="reward-ceremony-buttons ml-0.5 text-xs"
                style={{
                  color: "rgba(110, 65, 15, 0.75)",
                  opacity: 0,
                  animation: "reward-buttons-enter 250ms ease-out 1200ms forwards",
                }}
              >
                {completionStars}/3
              </span>
            </div>

            <p
              className="text-sm font-extrabold"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {moveCount} / {parMoves} moves
            </p>

            <p
              className="text-xs"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              {starLabel(completionStars)}
            </p>

            {isNewBest ? (
              <p
                className="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-extrabold uppercase tracking-[0.10em]"
                style={{
                  background: "rgba(245, 158, 11, 0.85)",
                  color: "rgba(63, 34, 8, 0.95)",
                  textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
                  boxShadow:
                    "0 0 12px rgba(245, 158, 11, 0.55), inset 0 1px 0 rgba(255, 245, 215, 0.45)",
                }}
              >
                {previousBest != null
                  ? `New best! Beat ${previousBest} → ${moveCount}`
                  : `First completion · ${moveCount} moves`}
              </p>
            ) : previousBest != null ? (
              <p className="text-xs" style={{ color: "rgba(110, 65, 15, 0.65)" }}>
                Your best: {previousBest} moves
              </p>
            ) : null}
          </div>

          <div className="mt-1 flex flex-col gap-1.5">
            {status === "won" ? (
              <>
                <Button
                  type="button"
                  variant="game-primary"
                  size="game"
                  onClick={onShare}
                  className="w-full"
                >
                  Share Result
                </Button>
                <Button
                  type="button"
                  variant="game-ghost"
                  size="game"
                  onClick={onRetry}
                  className="w-full"
                >
                  Retry
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="game-solid"
                size="game"
                onClick={onRetry}
                className="w-full"
              >
                Retry
              </Button>
            )}
          </div>

          <p
            className="text-center text-xs"
            style={{ color: "rgba(110, 65, 15, 0.60)" }}
          >
            <span className="fantasy-title">chesscito</span>
            <span className="opacity-70"> · Endgame Trainer</span>
          </p>
        </div>
      </div>
    </div>
  );
}
