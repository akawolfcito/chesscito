"use client";

import { ContextualHeader } from "@/components/ui/contextual-header";
import type { CandyIconName } from "@/components/redesign/candy-icon";

type Props = {
  title: string;
  subtitle?: string;
  icon?: CandyIconName;
  objective?: string;
  /** Fires when the inline close button is tapped. Consumer is
   *  responsible for closing the host sheet (typically `() => onOpenChange(false)`).
   *  Also requires `hideClose` on the host `<SheetContent>` so Radix's
   *  floating absolute X is suppressed and the user sees exactly one
   *  close affordance. */
  onClose: () => void;
};

export function MissionHeaderCandy({
  title,
  subtitle,
  icon = "coach",
  objective,
  onClose,
}: Props) {
  return (
    <>
      <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
        <ContextualHeader
          variant="close-control"
          icon={icon}
          title={title}
          subtitle={subtitle}
          close={{ onClick: onClose, label: `Close ${title}` }}
        />
      </div>

      {objective && (
        <div className="shrink-0 mt-3 rounded-xl border border-[rgba(255,255,255,0.45)] bg-white/15 p-2 px-3 shadow-sm">
          <p
            className="text-[0.85rem] font-extrabold leading-tight"
            style={{ color: "rgba(63, 34, 8, 0.92)" }}
          >
            {objective}
          </p>
        </div>
      )}
    </>
  );
}
