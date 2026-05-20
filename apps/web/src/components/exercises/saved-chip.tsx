"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { SAVED_CHIP_COPY } from "@/lib/content/editorial";

type SavedChipProps = {
  /** Stars currently saved on chain (denominator is total exercises per
   *  piece, fixed at 15 per the existing scoring rule). */
  stars: number;
  /** Maximum possible stars for the piece (5 exercises × 3 stars). */
  total: number;
};

/**
 * Passive read-only chip rendered on `/exercises` when the player's
 * local progress matches the last-confirmed on-chain score for the
 * active piece. Non-interactive — communicates "you're synced; nothing
 * to do" with a sober wood-tone candy treatment that contrasts with
 * the active candy-gold submitScore pin.
 *
 * Per Cluster C spec §2.2.4 — Saved is the passive read of the four-
 * state machine (Locked / Save / Saving / Saved). The chip is the
 * post-tx receipt that lives on the page after the toast fades.
 */
export function SavedChip({ stars, total }: SavedChipProps) {
  const label = SAVED_CHIP_COPY.label(stars, total);
  const ariaLabel = SAVED_CHIP_COPY.ariaLabel(stars, total);

  return (
    <span
      data-component="saved-chip"
      role="status"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-nano font-extrabold uppercase tracking-wider"
      style={{
        background: "rgba(220, 252, 231, 0.75)",
        color: "rgba(6, 95, 70, 0.95)",
        border: "1px solid rgba(6, 95, 70, 0.28)",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.10)",
      }}
    >
      <CandyIcon name="check" className="h-3 w-3" />
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
