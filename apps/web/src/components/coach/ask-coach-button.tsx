"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { Button } from "@/components/ui/button";
import { COACH_COPY } from "@/lib/content/editorial";

type Props = {
  onClick: () => void;
};

/**
 * High-contrast Ask Coach CTA. Solid emerald gradient with white text
 * so it reads on both the dark arena background and the warm candy
 * cream of the victory/lose modals. Replaces the prior near-invisible
 * emerald-on-transparent-emerald treatment that vanished on light
 * surfaces (2026-05-07 user smoke).
 */
export function AskCoachButton({ onClick }: Props) {
  return (
    <Button
      type="button"
      variant="game-solid"
      size="game"
      onClick={onClick}
      className="w-full border-emerald-700/40 bg-gradient-to-b from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-[0_2px_0_rgba(6,78,59,0.45)]"
    >
      <CandyIcon name="coach" className="inline h-5 w-5 -mt-0.5" />
      <span className="flex flex-col items-start leading-tight">
        <span className="font-bold tracking-wide drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]">{COACH_COPY.askCoach}</span>
        <span className="text-xs text-emerald-50/85">{COACH_COPY.askCoachSub}</span>
      </span>
    </Button>
  );
}
