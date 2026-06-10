"use client";

import { useTranslations } from "next-intl";

import { CandyIcon } from "@/components/redesign/candy-icon";

/** Cofre-check seal art (triplet). Static asset (not theme-swappable), so
 *  the optimized sources always render. */
const SAVED_SEAL_ICON = "/art/new-icons-chesscito/score-saved";

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

/** Visual seal: the cofre-check icon + a calm star stat-pill. Reads as a
 *  confirmation badge, not a button. */
function SavedSeal({ stars }: { stars: number }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <picture>
        <source srcSet={`${SAVED_SEAL_ICON}.avif`} type="image/avif" />
        <source srcSet={`${SAVED_SEAL_ICON}.webp`} type="image/webp" />
        <img
          src={`${SAVED_SEAL_ICON}.png`}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="h-9 w-9 object-contain drop-shadow-sm"
        />
      </picture>
      <span className="candy-stat-pill" data-testid="saved-chip-stars">
        <span className="candy-stat-pill-icon">
          <CandyIcon name="star" className="h-4 w-4" />
        </span>
        {stars}
      </span>
    </span>
  );
}

/**
 * Saved seal rendered on `/exercises` when the player's local progress
 * matches the last saved score for the active piece (`isSavedAtParity`).
 *
 * Visual-first: the cofre-check icon carries the "saved" meaning, the
 * star pill carries the score, and a small hint below explains that
 * beating the score reopens the SAVE action. It is a passive status
 * (NOT a button); only the legacy on-chain receipt case is a tappable
 * link to CeloScan.
 */
export function SavedChip({ stars, total, receiptUrl }: SavedChipProps) {
  const t = useTranslations("SAVED_CHIP_COPY");
  const ariaLabel = receiptUrl
    ? t("ariaLabelWithReceipt", { stars, total })
    : t("ariaLabel", { stars, total });

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
          className="inline-flex items-center gap-1.5 transition-transform active:scale-[0.97]"
        >
          <SavedSeal stars={stars} />
          <CandyIcon
            name="chevron-down"
            className="h-3 w-3 -rotate-90"
            style={{ color: "rgba(110, 65, 15, 0.6)" }}
          />
        </a>
      ) : (
        <span role="status" aria-label={ariaLabel}>
          <SavedSeal stars={stars} />
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
