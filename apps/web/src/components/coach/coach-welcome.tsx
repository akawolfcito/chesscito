"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { COACH_COPY } from "@/lib/content/editorial";

export function CoachWelcome() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-16 w-16 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(245,158,11,0.22)_0%,transparent_70%)]" />
        <CandyIcon name="coach" className="relative h-10 w-10" />
      </div>

      <h2 className="fantasy-title text-xl font-bold" style={{ color: "var(--paper-text)" }}>
        {COACH_COPY.welcomeTitle}
      </h2>
      <p className="text-center text-xs" style={{ color: "var(--paper-text-muted)" }}>
        {COACH_COPY.welcomeSub}
      </p>

      {/* Value card with crossed-out price — gold candy-frame to emphasize the free offer. */}
      <div className="candy-frame candy-frame-gold w-full p-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-extrabold truncate">{COACH_COPY.welcomePack}</p>
            <p className="mt-0.5 text-[0.7rem] leading-tight opacity-75">{COACH_COPY.welcomePackDetail}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end">
            <span className="text-xs line-through opacity-55">$0.05</span>
            <span className="text-base font-extrabold">FREE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

