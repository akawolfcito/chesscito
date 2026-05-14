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
            "arena-hud-btn group active:scale-60 transition-all duration-300",
            confirmingBack ? "px-4" : "w-[2.75rem]",
          ].join(" ")}
          aria-label={ARENA_COPY.backToHub}
        >
          {confirmingBack ? (
            <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap animate-in fade-in slide-in-from-left-2 duration-300">
              <CandyIcon name="close" className="h-4 w-4 text-white" />
              <span className="text-[0.75rem] font-black uppercase tracking-[0.15em] text-white">QUIT?</span>
              <span
                className="absolute bottom-0 left-0 h-1 w-full origin-left bg-white/20"
                style={{ animation: `confirm-countdown ${CONFIRM_TIMEOUT_MS}ms linear forwards` }}
              />
            </div>
          ) : (
            <div className="arena-hud-icon">
              <CandyBanner name="btn-back" className="opacity-90 group-hover:opacity-100" />
            </div>
          )}
        </button>

        {/* Live game timer chip (Pure CSS) */}
        <div
          className="arena-hud-chip"
          aria-label="Elapsed time"
          role="timer"
        >
          <div className="arena-hud-icon">
            <CandyIcon name="time" />
          </div>
          <span className="arena-hud-chip-label">
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
