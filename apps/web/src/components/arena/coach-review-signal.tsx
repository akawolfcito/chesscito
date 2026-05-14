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
      className={`mx-auto mb-2 flex w-max items-center justify-center gap-1.5 rounded-full px-3 py-1 text-[0.7rem] font-bold uppercase tracking-wider transition-colors ${
        proActive
          ? "bg-amber-100/40 text-amber-950 border border-amber-900/10 shadow-sm"
          : "bg-white/30 text-amber-900/60 hover:bg-white/50"
      }`}
      aria-label="Coach Review"
      data-testid="coach-review-signal"
    >
      <span className="opacity-80" aria-hidden="true">
        {proActive ? "PRO" : "Coach"}
      </span>
      <span className="opacity-40" aria-hidden="true">
        ·
      </span>
      <span className="opacity-90">
        {copy.inactiveTitle}
      </span>
    </button>
  );
}
