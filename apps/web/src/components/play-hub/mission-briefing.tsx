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
      <div className={`mission-briefing-card ${exiting ? "is-exiting" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-white/30 transition-colors hover:text-white/60"
          aria-label="Close"
        >
          <CandyIcon name="close" className="h-5 w-5" />
        </button>
        <picture>
          <source srcSet="/art/favicon-wolf.webp" type="image/webp" />
          <img
            src="/art/favicon-wolf.png"
            alt=""
            aria-hidden="true"
            className="mx-auto mb-4 h-20 w-20 rounded-full drop-shadow-[0_0_24px_rgba(103,232,249,0.3)]"
          />
        </picture>
        <p className="mb-1.5 text-center text-xs font-bold uppercase tracking-[0.14em] text-cyan-400">
          {MISSION_BRIEFING_COPY.label}
        </p>
        <p id="mission-briefing-objective" className="text-center text-sm font-medium text-slate-100">
          {objective}
        </p>
        <p className="mt-1.5 text-center text-xs text-cyan-100/45">
          {hint}
        </p>
        <Button
          type="button"
          variant="game-primary"
          size="game"
          autoFocus
          onClick={handleDismiss}
          className="mt-5 rounded-2xl from-cyan-600 to-cyan-500 font-bold tracking-wide shadow-[0_0_20px_rgba(6,182,212,0.4)] active:scale-95"
        >
          {MISSION_BRIEFING_COPY.play}
        </Button>
        <Link
          href="/arena"
          className="mt-3 block text-center text-xs text-cyan-300/50 underline underline-offset-4 transition-colors hover:text-cyan-200/70"
        >
          or try {ARENA_COPY.title} vs AI
        </Link>
      </div>
    </div>
  );
}
