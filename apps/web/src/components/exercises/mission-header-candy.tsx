"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type Props = {
  title: string;
  subtitle?: string;
  icon?: string;
  objective?: string;
};

export function MissionHeaderCandy({ title, subtitle, icon = "coach", objective }: Props) {
  return (
    <div className="shrink-0 border-b border-[rgba(110,65,15,0.20)] -mx-6 -mt-6 rounded-none px-6 pb-4 pt-[calc(env(safe-area-inset-top)+1.25rem)]">
      <SheetHeader className="space-y-1">
        <div className="flex items-center justify-between">
          <SheetTitle
            className="fantasy-title flex items-center gap-2 text-lg"
            style={{
              color: "rgba(110, 65, 15, 0.95)",
              textShadow: "0 1px 0 rgba(255, 245, 215, 0.80)",
            }}
          >
            <CandyIcon name={icon as any} className="h-5 w-5" />
            {title}
          </SheetTitle>
        </div>
        {subtitle && (
          <SheetDescription
            className="text-xs font-bold opacity-60"
            style={{ color: "rgba(63, 34, 8, 0.85)" }}
          >
            {subtitle}
          </SheetDescription>
        )}
      </SheetHeader>
      
      {objective && (
        <div className="mt-3 rounded-xl border border-[rgba(255,255,255,0.45)] bg-white/15 p-2 px-3 shadow-sm">
          <p className="text-[0.85rem] font-extrabold leading-tight" style={{ color: "rgba(63, 34, 8, 0.92)" }}>
            {objective}
          </p>
        </div>
      )}
    </div>
  );
}
