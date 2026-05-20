"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ContextualHeader } from "@/components/ui/contextual-header";
import { TrophiesBody } from "@/components/trophies/trophies-body";
import { DOCK_LABELS, TROPHY_VITRINE_COPY } from "@/lib/content/editorial";

type TrophiesSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Render the built-in `<SheetTrigger>` dock button. Default `true`
   *  for legacy callers. Pass `false` from surfaces that control open
   *  state externally (e.g. /arena via `?sheet=trophies`) and never
   *  want the orphan trigger floating in the layout tree — without
   *  this gate, Radix renders the button as a real DOM node sibling
   *  of the host and its `h-full w-full` image invades the layout. */
  showTrigger?: boolean;
};

/**
 * TrophiesSheet — dock destination mirroring the BadgeSheet / ShopSheet
 * / LeaderboardSheet pattern: a bottom drawer on top of the hub, not
 * a full-page route. Uses sheet-bg-hub so it shares the tree band +
 * cream wash with the other sheets. Content is the shared TrophiesBody
 * so this sheet and any remaining standalone consumer stay in sync.
 */
export function TrophiesSheet({ open, onOpenChange, showTrigger = true }: TrophiesSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {showTrigger ? (
        <SheetTrigger asChild>
          <button
            type="button"
            aria-label={DOCK_LABELS.trophies}
            className="relative flex h-full w-full shrink-0 items-center justify-center text-amber-200/80"
          >
            <CandyIcon name="trophy" className="h-full w-full" />
          </button>
        </SheetTrigger>
      ) : null}
      <SheetContent
        side="bottom"
        hideClose
        className="mission-shell sheet-bg-hub flex h-[100dvh] flex-col rounded-none border-0 pb-[5rem]"
      >
        <div className="shrink-0 -mx-6 -mt-6 border-b border-[rgba(110,65,15,0.30)] pt-[calc(env(safe-area-inset-top)+0.25rem)]">
          <ContextualHeader
            variant="close-control"
            icon="trophy"
            title={TROPHY_VITRINE_COPY.pageTitle}
            subtitle={TROPHY_VITRINE_COPY.pageDescription}
            close={{ onClick: () => onOpenChange(false), label: "Close trophies" }}
          />
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain mt-4 space-y-6">
          <TrophiesBody />
        </div>
      </SheetContent>
    </Sheet>
  );
}
