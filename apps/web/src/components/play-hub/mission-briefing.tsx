"use client";

import { useState } from "react";
import { MISSION_BRIEFING_COPY } from "@/lib/content/editorial";
import type { PieceId } from "@/lib/game/types";

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

  const objective = isCapture
    ? MISSION_BRIEFING_COPY.captureHint
    : `Move your ${pieceType.charAt(0).toUpperCase() + pieceType.slice(1)} to ${targetLabel}`;
  const hint = MISSION_BRIEFING_COPY.moveHint[pieceType];

  function handlePlay() {
    setExiting(true);
    setTimeout(onPlay, 400);
  }

  return (
    <div
      className={`mission-briefing-scrim ${exiting ? "is-exiting" : ""}`}
      aria-modal="true"
      role="dialog"
      aria-labelledby="mission-briefing-objective"
    >
      <div className={`mission-briefing-card ${exiting ? "is-exiting" : ""}`}>
        <img
          src="/art/favicon-wolf.png"
          alt=""
          aria-hidden="true"
          className="mx-auto mb-4 h-20 w-20 rounded-full drop-shadow-[0_0_24px_rgba(103,232,249,0.3)]"
        />
        <p className="mb-1.5 text-center text-xs font-bold uppercase tracking-[0.14em] text-cyan-400">
          {MISSION_BRIEFING_COPY.label}
        </p>
        <p id="mission-briefing-objective" className="text-center text-sm font-medium text-slate-100">
          {objective}
        </p>
        <p className="mt-1.5 text-center text-[11px] text-cyan-100/45">
          {hint}
        </p>
        <button
          type="button"
          autoFocus
          onClick={handlePlay}
          className="mt-5 w-full rounded-2xl bg-gradient-to-r from-cyan-600 to-cyan-500 py-3 text-sm font-bold tracking-wide text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] transition active:scale-95"
        >
          {MISSION_BRIEFING_COPY.play}
        </button>
      </div>
    </div>
  );
}
