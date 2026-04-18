"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check } from "lucide-react";
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
          className={[
            "relative flex h-11 shrink-0 items-center justify-center rounded-full border overflow-hidden transition-all active:scale-[0.97]",
            confirmingBack
              ? "w-auto gap-1.5 border-white/30 bg-white/[0.12] backdrop-blur-md px-3 text-white"
              : "w-11 border-white/[0.12] bg-[var(--surface-c-mid)] backdrop-blur-md text-white/80 hover:text-white",
          ].join(" ")}
          aria-label={ARENA_COPY.backToHub}
        >
          {confirmingBack ? (
            <>
              <Check className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{ARENA_COPY.backToHub}</span>
              <span className="absolute bottom-0 left-0 h-0.5 w-full origin-left bg-white/40" style={{ animation: `confirm-countdown ${CONFIRM_TIMEOUT_MS}ms linear forwards` }} />
            </>
          ) : (
            <ArrowLeft className="h-4 w-4" />
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
