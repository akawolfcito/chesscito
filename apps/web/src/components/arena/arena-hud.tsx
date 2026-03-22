"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Brain, Check, Flag } from "lucide-react";
import { ARENA_COPY } from "@/lib/content/editorial";
import type { ArenaDifficulty } from "@/lib/game/types";

type Props = {
  difficulty: ArenaDifficulty;
  isThinking: boolean;
  onBack: () => void;
  onResign?: () => void;
  isEndState?: boolean;
};

const DOT_COLOR: Record<ArenaDifficulty, string> = {
  easy: "bg-emerald-400",
  medium: "bg-amber-400",
  hard: "bg-rose-400",
};

const CONFIRM_TIMEOUT_MS = 3000;

export function ArenaHud({ difficulty, isThinking, onBack, onResign, isEndState }: Props) {
  const [confirmingResign, setConfirmingResign] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function handleResignClick() {
    if (!onResign) return;

    if (confirmingResign) {
      if (timerRef.current) clearTimeout(timerRef.current);
      setConfirmingResign(false);
      onResign();
    } else {
      setConfirmingResign(true);
      timerRef.current = setTimeout(() => setConfirmingResign(false), CONFIRM_TIMEOUT_MS);
    }
  }

  return (
    <div className="hud-bar mx-2 mt-2 flex items-center justify-between">
      <button
        type="button"
        onClick={onBack}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition-colors hover:text-white"
        aria-label={ARENA_COPY.backToHub}
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${DOT_COLOR[difficulty]}`} />
        <span className="font-semibold uppercase tracking-widest text-xs text-white/80">
          {ARENA_COPY.difficulty[difficulty]}
        </span>
      </div>

      <div className="flex items-center gap-2">
        {isThinking && (
          <span className="flex items-center gap-1.5 animate-pulse text-amber-300/90 tracking-wide text-xs">
            <Brain className="h-3.5 w-3.5" />
            {ARENA_COPY.aiThinking}
          </span>
        )}
        {onResign && !isEndState && (
          <button
            type="button"
            onClick={handleResignClick}
            className={[
              "flex h-8 shrink-0 items-center justify-center rounded-full border transition-all",
              confirmingResign
                ? "w-auto gap-1.5 border-rose-400/40 bg-rose-500/15 px-3 text-rose-400 animate-pulse"
                : "w-8 border-white/10 bg-white/5 text-white/35 hover:text-rose-400",
            ].join(" ")}
            aria-label={ARENA_COPY.resign}
          >
            {confirmingResign ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span className="text-[0.65rem] font-semibold">{ARENA_COPY.resign}</span>
              </>
            ) : (
              <Flag className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
