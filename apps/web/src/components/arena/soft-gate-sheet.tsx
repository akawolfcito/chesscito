"use client";

import { useTranslations } from "next-intl";

import { Sheet, SheetContent } from "@/components/ui/sheet";

type SoftGate = {
  onLearn: () => void;
  onDismiss: () => void;
};

type Props = {
  /** When defined, the modal renders open. When undefined, the modal
   *  is collapsed — same control surface as the previous inline
   *  `softGate?` prop on <ArenaSelectScaffold>, so callers don't
   *  change how they trigger the gate. */
  softGate?: SoftGate;
};

/**
 * Modal version of the /arena "Want a warm-up first?" gate. Replaces
 * the inline banner inside <ArenaSelectScaffold> with a bottom-anchored
 * sheet so the prompt reads as a deliberate choice moment rather than
 * page chrome — consistent with the candy-sheet vocabulary used by
 * AccountSheet / ProSheet / BadgeSheet.
 *
 * Behavior:
 *   - Two CTAs (Learn first → onLearn; Enter anyway → onDismiss).
 *   - Closing via Esc / pointer-down-outside fires `onDismiss` —
 *     matches the "Enter anyway" path so a user who taps elsewhere
 *     proceeds into Arena rather than being trapped.
 *   - No `?fresh=1` handling here — the parent owns the URL.
 */
export function SoftGateSheet({ softGate }: Props) {
  const t = useTranslations("ARENA_COPY");
  const open = Boolean(softGate);

  function handleOpenChange(next: boolean) {
    if (!next && softGate) softGate.onDismiss();
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        title={t("softGateTitle")}
        description={t("softGateBody")}
        className="sheet-bg-hub rounded-t-3xl border-0 pb-[calc(env(safe-area-inset-bottom,0px)+1.75rem)]"
      >
        <div
          role="region"
          aria-label={t("softGateRegionLabel")}
          data-component="soft-gate-sheet"
          className="mx-auto flex w-full max-w-[var(--app-max-width,390px)] flex-col gap-4 pt-2"
        >
          <div className="flex flex-col gap-1.5">
            <h2
              className="text-lg font-extrabold leading-tight"
              style={{ color: "rgba(63, 34, 8, 0.95)" }}
            >
              {t("softGateTitle")}
            </h2>
            <p
              className="text-sm leading-snug"
              style={{ color: "rgba(110, 65, 15, 0.85)" }}
            >
              {t("softGateBody")}
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <button
              type="button"
              onClick={() => softGate?.onLearn()}
              aria-label={t("softGateLearn")}
              className="arena-scaffold-soft-gate-primary"
            >
              {t("softGateLearn")}
            </button>
            <button
              type="button"
              onClick={() => softGate?.onDismiss()}
              className="arena-scaffold-soft-gate-secondary"
            >
              {t("softGateEnter")}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
