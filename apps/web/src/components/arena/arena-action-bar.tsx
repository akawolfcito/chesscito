"use client";

import { useEffect, useRef, useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
import { CandyBanner } from "@/components/redesign/candy-banner";
import { ARENA_COPY } from "@/lib/content/editorial";

type Props = {
  onResign: () => void;
  onUndo?: () => void;
  canUndo: boolean;
  isEndState: boolean;
};

const CONFIRM_TIMEOUT_MS = 3000;

export function ArenaActionBar({
  onResign,
  onUndo,
  canUndo,
  isEndState,
}: Props) {
  const [confirmingResign, setConfirmingResign] = useState(false);
  const resignTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resignTimerRef.current) clearTimeout(resignTimerRef.current);
    };
  }, []);

  function handleResignClick() {
    if (confirmingResign) {
      if (resignTimerRef.current) clearTimeout(resignTimerRef.current);
      setConfirmingResign(false);
      onResign();
    } else {
      setConfirmingResign(true);
      resignTimerRef.current = setTimeout(
        () => setConfirmingResign(false),
        CONFIRM_TIMEOUT_MS,
      );
    }
  }

  if (isEndState) return null;

  return (
    <div className="arena-action-bar flex items-center justify-between gap-6 px-8 pb-4 pt-2">
      <button
        type="button"
        onClick={handleResignClick}
        className={[
          "arena-action-pill group flex flex-col items-center gap-2 transition-all active:scale-95",
          confirmingResign ? "is-confirming scale-105" : "",
        ].join(" ")}
        aria-label={confirmingResign ? ARENA_COPY.resignConfirm : ARENA_COPY.resign}
        aria-pressed={confirmingResign}
      >
        <div className="arena-action-pill-icon relative overflow-hidden rounded-full border border-white/20 shadow-md">
          {confirmingResign ? (
            <CandyIcon name="check" className="h-6 w-6 text-white animate-in zoom-in duration-200" />
          ) : (
            <CandyBanner name="btn-resign" className="h-8 w-8 opacity-90 group-hover:opacity-100 transition-opacity" />
          )}
          {confirmingResign && (
            <span
              className="absolute bottom-0 left-0 h-1 w-full origin-left bg-white/40"
              style={{
                animation: `confirm-countdown ${CONFIRM_TIMEOUT_MS}ms linear forwards`,
              }}
            />
          )}
        </div>
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-white/50 group-active:text-white/80 transition-colors">
          {confirmingResign ? "Confirm?" : ARENA_COPY.resign}
        </span>
      </button>

      <div className="arena-action-banner-slot flex-1" />

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo || !onUndo}
        className="arena-action-pill group flex flex-col items-center gap-2 transition-all active:scale-95 disabled:pointer-events-none"
        aria-label={ARENA_COPY.undo}
      >
        <div className="arena-action-pill-icon rounded-full border border-white/20 shadow-md">
          <CandyBanner name="btn-undo" className="h-8 w-8 opacity-90 group-hover:opacity-100 transition-opacity" />
        </div>
        <span className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-white/50">
          {ARENA_COPY.undo}
        </span>
      </button>
    </div>
  );
}
