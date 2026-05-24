"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";

type SavedChipProps = {
  /** Stars currently saved on chain (denominator is total exercises per
   *  piece, fixed at 15 per the existing scoring rule). */
  stars: number;
  /** Maximum possible stars for the piece (5 exercises × 3 stars). */
  total: number;
  /** Optional Celoscan URL of the last successful save. When present the
   *  chip becomes a link the player can tap to open the on-chain receipt
   *  in a new tab — gives the saved-state agency instead of feeling
   *  terminal. Omit when no tx hash is known (legacy local state). */
  receiptUrl?: string;
};

/**
 * Saved chip rendered on `/exercises` when the player's local progress
 * matches the last-confirmed on-chain score for the active piece.
 *
 * Tappable when a receipt URL is available (opens Celoscan in a new
 * tab); otherwise renders as a passive status badge. A small hint sits
 * below the chip explaining that beating the saved score reopens the
 * SAVE action — addresses the perception that the chip "removes" the
 * ability to save.
 */
export function SavedChip({ stars, total, receiptUrl }: SavedChipProps) {
  const t = useTranslations("SAVED_CHIP_COPY");
  const label = t("label", { stars });
  const ariaLabel = receiptUrl
    ? t("ariaLabelWithReceipt", { stars, total })
    : t("ariaLabel", { stars, total });

  const chipStyle = {
    background: "rgba(220, 252, 231, 0.85)",
    color: "rgba(6, 95, 70, 0.95)",
    border: "1px solid rgba(6, 95, 70, 0.28)",
    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.10)",
  } as const;
  const chipClass =
    "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-nano font-extrabold uppercase tracking-wider transition-transform active:scale-[0.97]";

  return (
    <div
      data-component="saved-chip"
      className="flex flex-col items-center gap-1"
    >
      {receiptUrl ? (
        <a
          href={receiptUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={ariaLabel}
          className={chipClass}
          style={chipStyle}
        >
          <CandyIcon name="check" className="h-3 w-3" />
          <span aria-hidden="true">{label}</span>
          <CandyIcon name="chevron-down" className="h-3 w-3 -rotate-90" />
        </a>
      ) : (
        <span
          role="status"
          aria-label={ariaLabel}
          className={chipClass}
          style={chipStyle}
        >
          <CandyIcon name="check" className="h-3 w-3" />
          <span aria-hidden="true">{label}</span>
        </span>
      )}
      <span
        aria-hidden="true"
        className="text-nano font-semibold uppercase tracking-wider"
        style={{ color: "rgba(63, 34, 8, 0.65)" }}
      >
        {t("hint")}
      </span>
    </div>
  );
}
