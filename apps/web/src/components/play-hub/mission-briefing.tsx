"use client";

import { useState } from "react";
import Link from "next/link";
import { CandyIcon } from "@/components/redesign/candy-icon";
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
      className={`mission-briefing-scrim ${exiting ? "is-exiting" : ""}`}
      aria-modal="true"
      role="dialog"
      aria-labelledby="mission-briefing-objective"
      onClick={handleDismiss}
    >
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        className={`mission-briefing-card ${exiting ? "is-exiting" : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-amber-100/70 transition-colors hover:text-amber-50"
          aria-label="Close"
        >
          <CandyIcon name="close" className="h-4 w-4" />
        </button>
        <picture>
          <source srcSet="/art/favicon-wolf.avif" type="image/avif" />
          <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
          <img
            src="/art/favicon-wolf.png"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-4 h-20 w-20 rounded-full drop-shadow-[0_0_24px_rgba(245,158,11,0.55)]"
          />
        </picture>
        <p
          className="mb-1.5 text-center text-xs font-bold uppercase tracking-[0.14em] text-amber-200/90"
          style={{ textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)" }}
        >
          {MISSION_BRIEFING_COPY.label}
        </p>
        <p
          id="mission-briefing-objective"
          className="text-center text-sm font-bold text-amber-50"
          style={{ textShadow: "0 1px 3px rgba(0, 0, 0, 0.75)" }}
        >
          {objective}
        </p>
        <p
          className="mt-1.5 text-center text-xs text-amber-100/80"
          style={{ textShadow: "0 1px 2px rgba(0, 0, 0, 0.6)" }}
        >
          {hint}
        </p>
        <Button
          type="button"
          variant="game-primary"
          size="game"
          autoFocus
          onClick={handleDismiss}
          className="mt-5 w-full"
        >
          {MISSION_BRIEFING_COPY.play}
        </Button>
        <Link
          href="/arena"
          className="mt-3 block text-center text-xs text-amber-100/60 underline underline-offset-4 transition-colors hover:text-amber-50/90"
          style={{ textShadow: "0 1px 2px rgba(0, 0, 0, 0.55)" }}
        >
          or try {ARENA_COPY.title} vs AI
        </Link>
      </div>
    </div>
  );
}
