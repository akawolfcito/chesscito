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
    <div className="arena-hud mx-3 mt-3 flex flex-col gap-3">
      {/* Row 1: Back + live timer */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handleBackClick}
          className={[
            "group relative flex h-10 shrink-0 items-center justify-center transition-all active:scale-95",
            confirmingBack
              ? "w-auto gap-2 rounded-full border border-white/30 bg-white/10 backdrop-blur-md px-3 text-white shadow-lg"
              : "w-10 rounded-full border border-white/20 bg-black/10 backdrop-blur-sm",
          ].join(" ")}
          aria-label={ARENA_COPY.backToHub}
        >
          {confirmingBack ? (
            <>
              <CandyIcon name="check" className="h-3.5 w-3.5 animate-in zoom-in duration-200" />
              <span className="text-[0.7rem] font-bold uppercase tracking-wider">{ARENA_COPY.backToHub}</span>
              <span 
                className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-white/40" 
                style={{ animation: `confirm-countdown ${CONFIRM_TIMEOUT_MS}ms linear forwards` }} 
              />
            </>
          ) : (
            <CandyBanner name="btn-back" className="h-6 w-6 opacity-80 group-hover:opacity-100" />
          )}
        </button>

        {/* Live game timer */}
        <div
          className="flex h-10 items-center gap-2 rounded-full border border-amber-300/20 bg-black/10 px-4 shadow-sm backdrop-blur-sm"
          aria-label="Elapsed time"
          role="timer"
        >
          <CandyIcon
            name="time"
            className="h-3.5 w-3.5 shrink-0 opacity-70"
          />
          <span
            className="fantasy-title text-[0.8rem] font-extrabold tabular-nums tracking-wider text-amber-50/90"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
          >
            {formatTime(elapsedMs)}
          </span>
        </div>
      </div>

      {/* Row 2: Matchup art */}
      <div className="arena-hud-matchup flex items-center gap-2">
        <PlayerAvatar variant="you" className="flex-1 min-w-0" />
        <WoodenBanner variant="vs" className="shrink-0" />
        <div className="relative flex-1 min-w-0">
          <PlayerAvatar variant="bot" />
          {isThinking && (
            <span className="pointer-events-none absolute -top-1 right-1 flex h-5 w-8">
              <LottieAnimation src="/animations/sandy-loading.lottie" loop className="h-full w-full" />
            </span>
          )}
        </div>
      </div>

    </div>
  );
}
