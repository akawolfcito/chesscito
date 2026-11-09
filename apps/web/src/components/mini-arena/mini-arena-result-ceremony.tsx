"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";
import { VictoryPopupShell } from "@/components/arena/victory-popup-shell";
import { PrincipalButton } from "@/components/scene-rooted/principal-button";

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

  // Founder vocabulary pass 2026-06-11: migrated from CandyGlassShell
  // (plain green glass + ui/Button variants) to VictoryPopupShell so
  // the ceremony carries panel-bg1 + the ceremonial CTA set like every
  // other end-state modal.
  const ceremony = (
    <div data-testid="mini-arena-result-overlay">
      <VictoryPopupShell onClose={onClose} ariaLabel={title} closeLabel="Close">
        <div className="victory-popup-hero-solo">
          <h1 className="arena-result-title">{title}</h1>
        </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <ThemeAssetPicture
              slot="board.piece.white.rook"
              pictureClassName="reward-icon-showcase relative z-10"
              pictureStyle={{ animation: "reward-icon-enter 250ms ease-out 200ms both" }}
              alt=""
              className="h-32 w-32 object-contain drop-shadow-lg"
            />

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

          <div className="flex flex-col items-center gap-2">
            {status === "won" ? (
              <>
                <PrincipalButton size="medium" onClick={onShare}>
                  Share Result
                </PrincipalButton>
                <button
                  type="button"
                  onClick={onRetry}
                  className="arena-result-secondary-action"
                >
                  Retry
                </button>
              </>
            ) : (
              <PrincipalButton size="medium" onClick={onRetry}>
                Retry
              </PrincipalButton>
            )}
          </div>

          <div
            className="mt-1 flex flex-col items-center gap-1.5 px-2 text-center text-[11px]"
            style={{ color: "rgba(110, 65, 15, 0.75)" }}
          >
            <span>
              <span className="fantasy-title">chesscito</span>
              <span className="opacity-70"> · Endgame Trainer</span>
            </span>
          </div>
      </VictoryPopupShell>
    </div>
  );

  return portalRoot ? createPortal(ceremony, portalRoot) : ceremony;
}
