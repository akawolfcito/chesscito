"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Flag, RotateCcw } from "lucide-react";
import { ARENA_COPY } from "@/lib/content/editorial";
import { WoodenBanner } from "@/components/redesign/wooden-banner";

type Props = {
  onResign: () => void;
  onUndo?: () => void;
  canUndo: boolean;
  isPlayerTurn: boolean;
  isEndState: boolean;
};

const CONFIRM_TIMEOUT_MS = 3000;

export function ArenaActionBar({
  onResign,
  onUndo,
  canUndo,
  isPlayerTurn,
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
    <div className="arena-action-bar mx-2 mt-2 flex items-end justify-between gap-3">
      <button
        type="button"
        onClick={handleResignClick}
        className={`arena-action-pill${confirmingResign ? " is-confirming" : ""}`}
        aria-label={ARENA_COPY.resign}
      >
        <span className="arena-action-pill-icon">
          {confirmingResign ? (
            <Check className="h-5 w-5" />
          ) : (
            <Flag className="h-5 w-5" />
          )}
        </span>
        <span className="arena-action-pill-label">{ARENA_COPY.resign}</span>
        {confirmingResign ? (
          <span
            className="arena-action-pill-countdown"
            style={{
              animation: `confirm-countdown ${CONFIRM_TIMEOUT_MS}ms linear forwards`,
            }}
          />
        ) : null}
      </button>

      <div className="arena-action-banner-slot flex-1">
        {isPlayerTurn ? (
          <WoodenBanner
            variant="your-turn"
            alt={ARENA_COPY.yourTurn}
            className="arena-action-banner"
          />
        ) : null}
      </div>

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo || !onUndo}
        className="arena-action-pill"
        aria-label={ARENA_COPY.undo}
      >
        <span className="arena-action-pill-icon">
          <RotateCcw className="h-5 w-5" />
        </span>
        <span className="arena-action-pill-label">{ARENA_COPY.undo}</span>
      </button>
    </div>
  );
}
