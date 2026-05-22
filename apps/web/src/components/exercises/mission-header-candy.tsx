"use client";

import type { ReactNode } from "react";
import { ContextualHeader } from "@/components/ui/contextual-header";
import type { CandyIconName } from "@/components/redesign/candy-icon";

type Props = {
  title: string;
  subtitle?: string;
  icon?: CandyIconName;
  /** Custom inline icon node (raster PNG, picture, etc.). Wins over
   *  `icon` when present. Use this to anchor the sheet to its launching
   *  tile (DAILY → calendar PNG, MATE → play-chess PNG, …) so entry
   *  point and destination share identity. */
  iconSlot?: ReactNode;
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
  icon,
  iconSlot,
  objective,
  onClose,
}: Props) {
  // Only fall back to the generic CandyIcon "coach" when no custom slot
  // is provided. This keeps the legacy default for callers that haven't
  // adopted iconSlot yet while letting new consumers (Daily, Mate, …)
  // anchor to their tile asset.
  const resolvedIcon: CandyIconName | undefined = iconSlot
    ? undefined
    : icon ?? "coach";
  return (
    <>
      <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
        <ContextualHeader
          variant="close-control"
          icon={resolvedIcon}
          iconSlot={iconSlot}
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
