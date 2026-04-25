"use client";

import { useEffect, useState } from "react";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";
import { LABYRINTH_COPY } from "@/lib/content/editorial";
import { track } from "@/lib/telemetry";

type Props = {
  /** Number of moves the player took to reach the target. */
  moves: number;
  /** Optimal move count for this labyrinth. */
  optimalMoves: number;
  /** Stars earned (0–3) — caller computes via labyrinthStars(). */
  stars: number;
  onRetry: () => void;
  onBack: () => void;
};

/**
 * LabyrinthCompleteOverlay — the L2 completion ceremony.
 *
 * Rewards-first: leads with a celebratory headline + star count,
 * then the move-vs-optimal narrative, then the action row. Retry is
 * the primary CTA so the player can chase a higher star count
 * immediately. "Back to Exercises" returns to the L1 layer without
 * disturbing L1 progress.
 */
export function LabyrinthCompleteOverlay({
  moves,
  optimalMoves,
  stars,
  onRetry,
  onBack,
}: Props) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    track("modal_open", {
      id: "labyrinth-complete",
      moves,
      optimal: optimalMoves,
      stars,
    });
  }, [moves, optimalMoves, stars]);

  function handleAction(cb: () => void) {
    setExiting(true);
    setTimeout(cb, 250);
  }

  const isOptimal = moves <= optimalMoves;

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center candy-modal-scrim p-4 animate-in fade-in duration-250 ${exiting ? "modal-exiting" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label={LABYRINTH_COPY.completeTitle}
    >
      <div
        className="relative w-full max-w-xs animate-in zoom-in-95 slide-in-from-bottom-4 duration-400"
        onClick={(e) => e.stopPropagation()}
      >
        <CandyGlassShell
          title={LABYRINTH_COPY.completeTitle}
          onClose={() => handleAction(onBack)}
          closeLabel={LABYRINTH_COPY.back}
          cta={
            <div className="flex w-full flex-col gap-2.5 animate-in fade-in duration-300 fill-mode-both [animation-delay:600ms]">
              <Button
                type="button"
                variant="game-primary"
                size="game"
                onClick={() => handleAction(onRetry)}
                className="w-full"
              >
                <CandyIcon name="refresh" className="inline h-4 w-4 -mt-0.5" />{" "}
                {LABYRINTH_COPY.retry}
              </Button>
              <Button
                type="button"
                variant="game-ghost"
                size="game"
                onClick={() => handleAction(onBack)}
                className="w-full"
              >
                {LABYRINTH_COPY.back}
              </Button>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Trophy halo — same warm aesthetic as victory celebration */}
            <div className="relative flex items-center justify-center">
              <div
                className="absolute h-24 w-24 rounded-full"
                style={{
                  background:
                    "radial-gradient(circle, rgba(245, 158, 11, 0.32) 0%, rgba(217, 180, 74, 0.14) 50%, transparent 75%)",
                }}
              />
              <CandyIcon name="trophy" className="relative h-16 w-16" />
            </div>

            {/* Stars row — 3 max, gold filled / muted empty */}
            <div className="flex items-center gap-1.5">
              {[0, 1, 2].map((i) => (
                <CandyIcon
                  key={i}
                  name="star"
                  className="h-7 w-7"
                  style={{
                    opacity: i < stars ? 1 : 0.25,
                    filter: i < stars ? "drop-shadow(0 0 4px rgba(245, 158, 11, 0.55))" : "none",
                  }}
                />
              ))}
            </div>

            {/* Move count narrative */}
            <p
              className="text-sm font-semibold animate-in fade-in duration-300 fill-mode-both [animation-delay:400ms]"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
              }}
            >
              {LABYRINTH_COPY.completeMoves(moves, optimalMoves)}
            </p>
            {isOptimal && (
              <p
                className="text-xs"
                style={{ color: "rgba(110, 65, 15, 0.75)" }}
              >
                ★ Perfect path
              </p>
            )}
          </div>
        </CandyGlassShell>
      </div>
    </div>
  );
}
