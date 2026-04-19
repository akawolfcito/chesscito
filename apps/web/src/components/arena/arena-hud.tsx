"use client";

import { useEffect, useRef, useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { ARENA_COPY } from "@/lib/content/editorial";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { PlayerCard } from "@/components/redesign/player-card";
import { WoodenBanner } from "@/components/redesign/wooden-banner";

type Props = {
  isThinking: boolean;
  onBack: () => void;
  isEndState?: boolean;
};

const CONFIRM_TIMEOUT_MS = 3000;

export function ArenaHud({ isThinking, onBack, isEndState }: Props) {
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
      {/* Row 1: Back */}
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
              <CandyIcon name="check" className="h-4 w-4" />
              <span className="text-xs font-semibold">{ARENA_COPY.backToHub}</span>
              <span className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-white/40" style={{ animation: `confirm-countdown ${CONFIRM_TIMEOUT_MS}ms linear forwards` }} />
            </>
          ) : (
            <CandyBanner name="btn-back" className="h-7 w-7" />
          )}
        </button>
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
    </div>
  );
}
