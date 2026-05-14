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
    <div className="arena-action-bar flex items-center justify-around px-4 pb-8 pt-2">
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={handleResignClick}
          className={[
            "arena-action-circle group relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/20 shadow-lg transition-all active:scale-90",
            confirmingResign ? "is-confirming border-amber-400" : "bg-black/10",
          ].join(" ")}
          aria-label={confirmingResign ? ARENA_COPY.resignConfirm : ARENA_COPY.resign}
          aria-pressed={confirmingResign}
        >
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <CandyBanner name="btn-stone-bg" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="relative z-10">
            {confirmingResign ? (
              <CandyIcon name="check" className="h-7 w-7 text-white animate-in zoom-in duration-200" />
            ) : (
              <CandyBanner name="btn-resign" className="h-8 w-8 opacity-90 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
        </button>
        <span className="text-[0.7rem] font-black uppercase tracking-[0.1em] text-white/80 drop-shadow-md">
          {confirmingResign ? "Confirm?" : ARENA_COPY.resign}
        </span>
      </div>

      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo || !onUndo}
          className="arena-action-circle group relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/20 bg-black/10 shadow-lg transition-all active:scale-90 disabled:opacity-40 disabled:grayscale"
          aria-label={ARENA_COPY.undo}
        >
          <div className="absolute inset-0 rounded-full overflow-hidden">
            <CandyBanner name="btn-stone-bg" className="h-full w-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
          </div>
          <div className="relative z-10">
            <CandyBanner name="btn-undo" className="h-8 w-8 opacity-90 group-hover:opacity-100 transition-opacity" />
          </div>
        </button>
        <span className="text-[0.7rem] font-black uppercase tracking-[0.1em] text-white/80 drop-shadow-md">
          {ARENA_COPY.undo}
        </span>
      </div>
    </div>
  );
}
