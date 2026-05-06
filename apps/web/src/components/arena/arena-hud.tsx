"use client";

import { useEffect, useRef, useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { ARENA_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PlayerCard } from "@/components/redesign/player-card";
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
    <div className="arena-hud mx-2 mt-2 flex flex-col gap-2">
      {/* Row 1: Back + live timer */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleBackClick}
          style={{
            backgroundImage: confirmingBack
              ? undefined
              : `image-set(url('/art/redesign/banners/btn-stone-bg.avif') type('image/avif'), url('/art/redesign/banners/btn-stone-bg.webp') type('image/webp'), url('/art/redesign/banners/btn-stone-bg.png') type('image/png'))`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
          className={[
            "relative flex h-11 shrink-0 items-center justify-center transition-all active:scale-[0.97]",
            confirmingBack
              ? "w-auto gap-1.5 rounded-full border border-white/30 bg-white/[0.12] backdrop-blur-md px-3 text-white overflow-hidden"
              : "w-11 text-white/90",
          ].join(" ")}
          aria-label={ARENA_COPY.backToHub}
        >
          {confirmingBack ? (
            <>
              <CandyIcon name="check" className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{ARENA_COPY.backToHub}</span>
              <span className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-white/40" style={{ animation: `confirm-countdown ${CONFIRM_TIMEOUT_MS}ms linear forwards` }} />
            </>
          ) : (
            <CandyBanner name="btn-back" className="h-7 w-7" />
          )}
        </button>

        {/* Live game timer — stops ticking on end-state (parent snapshots the
            final value into elapsedMs via the end-game effect in useChessGame). */}
        <div
          className="ml-auto flex min-h-[44px] items-center gap-1.5 rounded-full border border-amber-300/25 bg-[var(--surface-c-mid)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_1px_3px_rgba(0,0,0,0.35)] backdrop-blur-md"
          aria-label="Elapsed time"
          role="timer"
        >
          <CandyIcon
            name="time"
            className="h-4 w-4 shrink-0"
            style={{ filter: "drop-shadow(0 0 2px rgba(245,158,11,0.45))" }}
          />
          <span
            className="fantasy-title text-xs font-extrabold tabular-nums tracking-[0.08em] text-[var(--warm-label-text)]"
            style={{ textShadow: "var(--text-shadow-label)" }}
          >
            {formatTime(elapsedMs)}
          </span>
        </div>
      </div>

      {/* Row 2: You | VS | Bot with thinking indicator overlay */}
      <div className="arena-hud-matchup flex items-center gap-2">
        <PlayerCard variant="you" className="flex-1 min-w-0" />
        <WoodenBanner variant="vs" className="shrink-0" />
        <div className="relative flex-1 min-w-0">
          <PlayerCard variant="bot" />
          {isThinking && (
            <span className="pointer-events-none absolute -top-1 right-1 flex h-5 w-8">
              <LottieAnimation src="/animations/sandy-loading.lottie" loop className="h-full w-full" />
            </span>
          )}
        </div>
      </div>

      {/* Row 3 (optional): in-match Coach signpost. Quiet treatment so it
          never competes with the timer or matchup; pure discovery aid
          telling the player Coach activates post-checkmate. */}
      {showCoachHint && !isEndState && (
        <p
          data-testid="arena-coach-hint"
          className="text-nano text-center font-medium italic tracking-wide text-white/55"
        >
          {ARENA_COPY.coachHudHint}
        </p>
      )}
    </div>
  );
}
