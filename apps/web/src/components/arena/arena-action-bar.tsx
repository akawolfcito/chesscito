"use client";

import { useEffect, useRef, useState } from "react";
import { CandyIcon } from "@/components/redesign/candy-icon";
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
    <div className="arena-action-bar mx-2 mt-2 flex items-end justify-between gap-3">
      <button
        type="button"
        onClick={handleResignClick}
        className={`arena-action-pill${confirmingResign ? " is-confirming" : ""}`}
        aria-label={ARENA_COPY.resign}
      >
        <span className="arena-action-pill-icon">
          {confirmingResign ? (
            <CandyIcon name="check" className="h-7 w-7" />
          ) : (
            <img
              src="/art/redesign/banners/btn-resign.png"
              alt=""
              aria-hidden="true"
              className="h-7 w-7 object-contain"
            />
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

      <div className="arena-action-banner-slot flex-1" />

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo || !onUndo}
        className="arena-action-pill"
        aria-label={ARENA_COPY.undo}
      >
        <span className="arena-action-pill-icon">
          <img
            src="/art/redesign/banners/btn-undo.png"
            alt=""
            aria-hidden="true"
            className="h-7 w-7 object-contain"
          />
        </span>
        <span className="arena-action-pill-label">{ARENA_COPY.undo}</span>
      </button>
    </div>
  );
}
