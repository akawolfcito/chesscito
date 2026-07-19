"use client";

import { useTranslations } from "next-intl";
import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

/** Cofre-check seal art (triplet). Static asset (not theme-swappable), so
 *  the optimized sources always render. */
type SavedChipProps = {
  /** Stars currently saved for the active piece (denominator is total
   *  exercises per piece, fixed at 15 per the existing scoring rule). */
  stars: number;
  /** Maximum possible stars for the piece (5 exercises × 3 stars). */
  total: number;
  /** Optional Celoscan URL of a legacy on-chain save. When present the
   *  seal becomes a link to the receipt (those rows ARE on-chain, so the
   *  CeloScan affordance is correct). Off-chain saves omit it. */
  receiptUrl?: string;
};

/** Visual seal: the cofre icon with the green check marker from the
 *  check/dot system. Founder pass 2026-06-11: no star pill, no long
 *  hint text — the icon + check carry "saved"; the score and the
 *  beat-it-to-resave guidance live in the aria-label. */
function SavedSeal() {
  return (
    <span className="action-pin-submit-pedestal relative flex shrink-0 items-center justify-center">
      <ThemeAssetPicture slot="exercises.saved-seal" alt="" aria-hidden="true" draggable={false} className="object-contain" />
      <span
        aria-hidden="true"
        className="action-pin-status action-pin-status--done"
      >
        ✓
      </span>
    </span>
  );
}

/**
 * Saved seal rendered on `/exercises` when the player's local progress
 * matches the last saved score for the active piece (`isSavedAtParity`).
 *
 * Pin form (founder check/dot system 2026-06-11): bare icon + green
 * check + nano label, matching the SAVE/CLAIM pins. It is a passive
 * status (NOT a button); only the legacy on-chain receipt case is a
 * tappable link to CeloScan.
 */
export function SavedChip({ stars, total, receiptUrl }: SavedChipProps) {
  const t = useTranslations("SAVED_CHIP_COPY");
  const ariaLabel = receiptUrl
    ? t("ariaLabelWithReceipt", { stars, total })
    : t("ariaLabel", { stars, total });

  return (
    <div
      data-component="saved-chip"
      className="action-pin action-pin--pin flex flex-col items-center gap-1"
    >
      {receiptUrl ? (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          className="inline-flex transition-transform active:scale-[0.97]"
        >
          <SavedSeal />
        </a>
      ) : (
        <span role="status" aria-label={ariaLabel}>
          <SavedSeal />
        </span>
      )}
      <span
        aria-hidden="true"
        className="action-pin-label game-label text-nano font-bold uppercase tracking-[0.12em] text-[rgba(63,34,8,0.85)]"
      >
        {t("pinLabel")}
      </span>
    </div>
  );
}
