"use client";

import { GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { COACH_COPY } from "@/lib/content/editorial";

type Props = {
  onClick: () => void;
};

export function AskCoachButton({ onClick }: Props) {
  return (
    <Button
      type="button"
      variant="game-solid"
      size="game"
      onClick={onClick}
      className="border-emerald-400/20 bg-emerald-500/[0.08] text-emerald-300 hover:bg-emerald-500/[0.15]"
    >
      <GraduationCap size={18} className="inline -mt-0.5" />
      <span className="flex flex-col items-start leading-tight">
        <span className="font-bold">{COACH_COPY.askCoach}</span>
        <span className="text-xs text-emerald-200/50">{COACH_COPY.askCoachSub}</span>
      </span>
    </Button>
  );
}
