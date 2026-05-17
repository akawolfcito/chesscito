"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { THEME_CONFIG } from "@/lib/theme";
import { Button } from "@/components/ui/button";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";

type TerminalResult = {
  status: "won" | "drawn";
  moveCount: number;
  completionStars: number;
  isNewBest: boolean;
  previousBest: number | null;
};

type Props = {
  terminalResult: TerminalResult;
  parMoves: number;
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
  terminalResult,
  parMoves,
  onShare,
  onRetry,
  onClose,
}: Props) {
  const { status, moveCount, completionStars, isNewBest, previousBest } = terminalResult;
  const title = status === "won" ? "Checkmate!" : "Try Again";
  const [portalRoot, setPortalRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setPortalRoot(document.body);
  }, []);

  const ceremony = (
    <div
      data-testid="mini-arena-result-overlay"
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center candy-modal-scrim p-4 animate-in fade-in duration-250"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="pointer-events-auto relative w-[calc(100vw-2rem)] max-w-[340px]"
        style={{ animation: "reward-panel-enter 350ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        onClick={(e) => e.stopPropagation()}
      >
        <CandyGlassShell
          title={title}
          onClose={onClose}
          closeLabel="Close"
          cta={
            <div className="flex flex-col gap-1.5">
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
          }
          meta={
            <>
              <span className="fantasy-title">chesscito</span>
              <span className="opacity-70"> · Endgame Trainer</span>
            </>
          }
        >
          <div className="flex flex-col items-center gap-2 text-center">
            <picture
              className="reward-icon-showcase relative z-10"
              style={{ animation: "reward-icon-enter 250ms ease-out 200ms both" }}
            >
              <source srcSet={ROOK_SRC.replace(".png", ".avif")} type="image/avif" />
              <source srcSet={ROOK_SRC.replace(".png", ".webp")} type="image/webp" />
              <img
                src={ROOK_SRC}
                alt=""
                className="h-32 w-32 object-contain drop-shadow-lg"
              />
            </picture>

            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => {
                const filled = i < completionStars;
                return (
                  <span
                    key={i}
                    className={`reward-ceremony-star inline-block text-3xl ${
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
                className="reward-ceremony-buttons ml-1 text-sm font-semibold"
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
              className="text-base font-extrabold leading-tight"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {moveCount} / {parMoves} moves
            </p>

            <p
              className="text-sm"
              style={{ color: "rgba(110, 65, 15, 0.75)" }}
            >
              {starLabel(completionStars)}
            </p>

            {isNewBest ? (
              <p
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-[0.10em]"
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
        </CandyGlassShell>
      </div>
    </div>
  );

  return portalRoot ? createPortal(ceremony, portalRoot) : ceremony;
}
