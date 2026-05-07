"use client";

import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  isWorking: boolean;
};

/**
 * Generic confirm sheet built atop the project's `<Sheet>` primitive
 * (Radix Dialog). Used by `<CoachHistoryDeletePanel>` for the destructive
 * delete-history flow (red-team P2-1: codebase has no `<Dialog>`, so the
 * confirm UI is a bottom sheet).
 *
 * Both buttons disable while the parent's onConfirm is pending so a user
 * can't double-click into a duplicate request.
 */
export function ConfirmDeleteSheet({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isWorking,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="border-rose-300 bg-white">
        <SheetTitle className="text-rose-600">{title}</SheetTitle>
        <SheetDescription className="text-sm text-rose-800/80">{body}</SheetDescription>
        <div className="mt-6 flex flex-col gap-2">
          <Button
            type="button"
            variant="destructive"
            size="game"
            onClick={onConfirm}
            disabled={isWorking}
          >
            {confirmLabel}
          </Button>
          <Button
            type="button"
            variant="game-ghost"
            size="game-sm"
            onClick={() => onOpenChange(false)}
            disabled={isWorking}
          >
            {cancelLabel}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
