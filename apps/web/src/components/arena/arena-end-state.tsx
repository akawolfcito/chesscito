"use client";

import { ARENA_COPY } from "@/lib/content/editorial";
import type { ArenaStatus } from "@/lib/game/types";

type Props = {
  status: ArenaStatus;
  isPlayerWin: boolean;
  onPlayAgain: () => void;
  onBackToHub: () => void;
};

function getResultText(status: ArenaStatus, isPlayerWin: boolean): string {
  switch (status) {
    case "checkmate":
      return isPlayerWin
        ? ARENA_COPY.endState.checkmate.win
        : ARENA_COPY.endState.checkmate.lose;
    case "stalemate":
      return ARENA_COPY.endState.stalemate;
    case "draw":
      return ARENA_COPY.endState.draw;
    case "resigned":
      return ARENA_COPY.endState.resigned;
    default:
      return "";
  }
}

export function ArenaEndState({ status, isPlayerWin, onPlayAgain, onBackToHub }: Props) {
  const text = getResultText(status, isPlayerWin);
  if (!text) return null;

  const accentClass = isPlayerWin
    ? "text-emerald-300 drop-shadow-[0_0_16px_rgba(52,211,153,0.5)]"
    : "text-rose-300 drop-shadow-[0_0_16px_rgba(251,113,133,0.4)]";

  const borderGlow = isPlayerWin
    ? "shadow-[0_0_40px_rgba(52,211,153,0.15)]"
    : "shadow-[0_0_40px_rgba(251,113,133,0.1)]";

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-50 flex items-end justify-center bg-black/60 pb-[15vh] animate-in fade-in duration-300"
      role="alert"
      aria-live="assertive"
    >
      <div className={`flex flex-col items-center gap-6 rounded-3xl border border-white/10 bg-[#0b1628]/90 px-8 py-8 backdrop-blur-xl ${borderGlow} animate-in zoom-in-95 slide-in-from-bottom-4 duration-500`}>
        <img
          src="/art/favicon-wolf.png"
          alt=""
          aria-hidden="true"
          className="h-14 w-14 drop-shadow-[0_0_20px_rgba(103,232,249,0.5)]"
        />
        <h2 className={`fantasy-title text-2xl font-bold ${accentClass}`}>
          {text}
        </h2>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onPlayAgain}
            className="rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-400 px-6 py-2.5 font-semibold text-white shadow-[0_0_16px_rgba(34,211,238,0.3)] transition-all hover:shadow-[0_0_24px_rgba(34,211,238,0.5)] active:scale-95"
          >
            {ARENA_COPY.playAgain}
          </button>
          <button
            type="button"
            onClick={onBackToHub}
            className="rounded-2xl border border-white/10 bg-white/5 px-6 py-2.5 font-semibold text-white/70 transition-all hover:bg-white/10 active:scale-95"
          >
            {ARENA_COPY.backToHub}
          </button>
        </div>
      </div>
    </div>
  );
}
