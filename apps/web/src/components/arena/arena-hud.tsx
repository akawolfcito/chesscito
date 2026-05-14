"use client";

import { useEffect, useRef, useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { ARENA_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PlayerAvatar } from "@/components/redesign/player-avatar";
import { WoodenBanner } from "@/components/redesign/wooden-banner";
import { formatTime } from "@/lib/game/arena-utils";

type Props = {
  isThinking: boolean;
  onBack: () => void;
  isEndState?: boolean;
  elapsedMs: number;
  /** When true (and the game is not yet in end-state), render the
   *  in-match Coach signpost beneath the matchup row. Gated by
   *  NEXT_PUBLIC_ENABLE_COACH at the call site (arena/page.tsx). */
  showCoachHint?: boolean;
};

const CONFIRM_TIMEOUT_MS = 3000;

export function ArenaHud({
  isThinking,
  onBack,
  isEndState,
  elapsedMs,
  showCoachHint = false,
}: Props) {
  const [confirmingBack, setConfirmingBack] = useState(false);
  const backTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
    };
  }, []);

  const needsBackConfirm = !isEndState;

  function handleBackClick() {
    if (!needsBackConfirm) {
      onBack();
      return;
    }
    if (confirmingBack) {
      if (backTimerRef.current) clearTimeout(backTimerRef.current);
      setConfirmingBack(false);
      onBack();
    } else {
      setConfirmingBack(true);
      backTimerRef.current = setTimeout(() => setConfirmingBack(false), CONFIRM_TIMEOUT_MS);
    }
  }

  return (
    <div className="arena-hud mx-3 flex flex-col gap-4">
      {/* Row 1: Back + live timer */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={handleBackClick}
          className={[
            "group relative flex h-10 shrink-0 items-center justify-center transition-all active:scale-95",
            confirmingBack
              ? "w-auto gap-2 rounded-full border border-amber-400/40 bg-amber-500/20 backdrop-blur-md px-3 text-amber-50 shadow-lg"
              : "w-10 rounded-full border border-amber-400/30 bg-amber-500/10 backdrop-blur-sm shadow-sm hover:bg-amber-500/20",
          ].join(" ")}
          aria-label={ARENA_COPY.backToHub}
        >
          {confirmingBack ? (
            <>
              <CandyIcon name="check" className="h-3.5 w-3.5 animate-in zoom-in duration-200" />
              <span className="text-[0.7rem] font-bold uppercase tracking-wider">{ARENA_COPY.backToHub}</span>
              <span 
                className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-amber-400/60" 
                style={{ animation: `confirm-countdown ${CONFIRM_TIMEOUT_MS}ms linear forwards` }} 
              />
            </>
          ) : (
            <CandyBanner name="btn-back" className="h-6 w-6 opacity-90 group-hover:opacity-100" />
          )}
        </button>

        {/* Live game timer chip (Amber) */}
        <div
          className="flex h-9 items-center gap-2 rounded-full border border-amber-400/40 bg-amber-600/20 px-4 shadow-sm backdrop-blur-sm"
          aria-label="Elapsed time"
          role="timer"
        >
          <CandyIcon
            name="time"
            className="h-4 w-4 shrink-0"
          />
          <span
            className="fantasy-title text-[0.85rem] font-black tabular-nums tracking-widest text-amber-50"
            style={{ textShadow: "0 1px 2px rgba(120, 60, 0, 0.6)" }}
          >
            {formatTime(elapsedMs)}
          </span>
        </div>
      </div>

      {/* Row 2: Matchup art (Heads) — Symmetric Battle Header */}
      <div className="arena-hud-matchup relative flex items-center justify-between px-2 pt-2">
        <div className="flex flex-1 justify-center">
          <PlayerAvatar variant="you" className="h-24 w-24 drop-shadow-xl" />
        </div>
        
        <div className="flex shrink-0 items-center justify-center">
          <WoodenBanner variant="vs" className="scale-90 drop-shadow-lg" />
        </div>

        <div className="relative flex flex-1 justify-center">
          <PlayerAvatar variant="bot" className="h-24 w-24 drop-shadow-xl" />
          {isThinking && (
            <span className="pointer-events-none absolute -top-2 -right-2 flex h-8 w-12">
              <LottieAnimation src="/animations/sandy-loading.lottie" loop className="h-full w-full" />
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
