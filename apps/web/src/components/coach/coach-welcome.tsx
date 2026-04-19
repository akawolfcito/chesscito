"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";
import { COACH_COPY } from "@/lib/content/editorial";

type Props = {
  onClaim: () => void;
};

export function CoachWelcome({ onClaim }: Props) {
  return (
    <div className="flex flex-col items-center gap-5 px-6 py-10">
      <div className="relative flex items-center justify-center">
        <div className="absolute h-20 w-20 animate-pulse rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.15)_0%,transparent_70%)]" />
        <CandyIcon name="coach" className="relative h-12 w-12" />
      </div>

      <h2 className="fantasy-title text-2xl font-bold text-white">{COACH_COPY.welcomeTitle}</h2>
      <p className="text-center text-sm text-cyan-100/60">{COACH_COPY.welcomeSub}</p>

      {/* Value card with crossed-out price */}
      <div className="w-full rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.04] p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-lg font-bold text-white">{COACH_COPY.welcomePack}</p>
            <p className="mt-0.5 text-xs text-cyan-100/40">{COACH_COPY.welcomePackDetail}</p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-sm text-cyan-100/30 line-through">$0.05</span>
            <span className="text-lg font-bold text-emerald-300">FREE</span>
          </div>
        </div>
      </div>

      <Button
        type="button"
        variant="game-primary"
        size="game"
        onClick={onClaim}
        className="shadow-[0_0_16px_rgba(16,185,129,0.25)] hover:shadow-[0_0_24px_rgba(16,185,129,0.4)]"
      >
        {COACH_COPY.claimFree}
      </Button>

      <p className="text-center text-xs text-cyan-100/30">{COACH_COPY.welcomeNote}</p>
    </div>
  );
}
