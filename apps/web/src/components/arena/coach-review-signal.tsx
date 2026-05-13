"use client";

import { ARENA_COPY } from "@/lib/content/editorial";

type CoachReviewSignalProps = {
  proActive: boolean;
  onCta?: () => void;
};

export function CoachReviewSignal({ proActive, onCta }: CoachReviewSignalProps) {
  const copy = ARENA_COPY.coachSignal;

  return (
    <button
      type="button"
      onClick={!proActive && onCta ? onCta : undefined}
      className={`mx-auto mb-2 flex w-max items-center justify-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
        proActive
          ? "bg-amber-100/50 text-amber-900 border border-amber-900/10 shadow-sm"
          : "bg-white/40 text-amber-900/80 hover:bg-white/60"
      }`}
      aria-label="Coach Review"
      data-testid="coach-review-signal"
    >
      <span className="font-bold opacity-60" aria-hidden="true">
        {proActive ? "PRO" : "COACH"}
      </span>
      <span>
        {proActive ? copy.activeTitle : copy.inactiveTitle}
      </span>
      {!proActive && onCta && (
        <span className="font-semibold underline underline-offset-2 opacity-80 ml-1">
          {copy.inactiveCta}
        </span>
      )}
    </button>
  );
}
