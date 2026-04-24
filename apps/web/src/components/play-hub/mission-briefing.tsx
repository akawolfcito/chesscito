"use client";

import { useState } from "react";
import Link from "next/link";
import { CandyGlassShell } from "@/components/redesign/candy-glass-shell";
import { ARENA_COPY, MISSION_BRIEFING_COPY, PIECE_LABELS } from "@/lib/content/editorial";
import type { PieceId } from "@/lib/game/types";
import { Button } from "@/components/ui/button";

type MissionBriefingProps = {
  pieceType: PieceId;
  targetLabel: string;
  isCapture: boolean;
  onPlay: () => void;
};

export function MissionBriefing({
  pieceType,
  targetLabel,
  isCapture,
  onPlay,
}: MissionBriefingProps) {
  const [exiting, setExiting] = useState(false);

  const pieceName = PIECE_LABELS[pieceType] ?? pieceType;
  const objective = isCapture
    ? MISSION_BRIEFING_COPY.captureHint
    : MISSION_BRIEFING_COPY.moveObjective(pieceName, targetLabel);
  const hint = MISSION_BRIEFING_COPY.moveHint[pieceType];

  function handleDismiss() {
    setExiting(true);
    setTimeout(onPlay, 400);
  }

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
    <div
      className={`fixed inset-0 z-40 flex items-center justify-center candy-modal-scrim transition-opacity duration-300 ${exiting ? "opacity-0" : "animate-in fade-in duration-300"}`}
      aria-modal="true"
      role="dialog"
      aria-labelledby="mission-briefing-objective"
      onClick={handleDismiss}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={`relative z-10 mx-4 w-full max-w-[320px] transition-all duration-400 ${exiting ? "scale-95 opacity-0" : "animate-in zoom-in-95 slide-in-from-bottom-4 duration-400"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <CandyGlassShell
          title={MISSION_BRIEFING_COPY.label}
          onClose={handleDismiss}
          closeLabel="Close"
          cta={
            <div className="flex w-full flex-col gap-2.5">
              <Button
                type="button"
                variant="game-primary"
                size="game"
                autoFocus
                onClick={handleDismiss}
                className="w-full"
              >
                {MISSION_BRIEFING_COPY.play}
              </Button>
              <Link
                href="/arena"
                className="block text-center text-xs font-semibold underline underline-offset-2"
                style={{ color: "rgba(110, 65, 15, 0.70)" }}
              >
                or try {ARENA_COPY.title} vs AI
              </Link>
            </div>
          }
        >
          <div className="flex flex-col items-center gap-3 text-center">
            {/* Wolf portrait with amber halo */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-24 w-24 rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.35)_0%,rgba(217,180,74,0.15)_50%,transparent_75%)]" />
              <picture>
                <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
                <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
                <img
                  src="/art/favicon-wolf.png"
                  alt=""
                  aria-hidden="true"
                  className="relative h-20 w-20 rounded-full drop-shadow-[0_2px_8px_rgba(120,65,5,0.35)]"
                />
              </picture>
            </div>

            {/* Objective */}
            <p
              id="mission-briefing-objective"
              className="text-sm font-bold"
              style={{
                color: "rgba(63, 34, 8, 0.95)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.65)",
              }}
            >
              {objective}
            </p>

            {/* Hint */}
            <p
              className="text-xs"
              style={{
                color: "rgba(110, 65, 15, 0.75)",
                textShadow: "0 1px 0 rgba(255, 245, 215, 0.55)",
              }}
            >
              {hint}
            </p>
          </div>
        </CandyGlassShell>
      </div>
    </div>
  );
}
