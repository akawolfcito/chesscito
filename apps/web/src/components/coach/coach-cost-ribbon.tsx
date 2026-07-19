"use client";

import { ThemeAssetPicture } from "@/components/themes/theme-asset-picture";

type Props = {
  /** PRO subscribers see a crown "PRO" ribbon (covered/included). Free
   *  users see the Peón cost "♟ 1". Guests render no ribbon — the caller
   *  decides whether to mount this component at all. */
  proActive?: boolean;
  /** Positioning variant:
   *   - "cta"  → corner ribbon on the full-width arena coach buttons
   *   - "tile" → centered above the icon on the coach-viewer action tile
   *  (mirrors the Save Victory price ribbon's two placements). */
  variant?: "cta" | "tile";
};

/**
 * Plan 3 (2026-06-13) — cost ribbon for the Ask Coach CTA. Makes the
 * coach currency visible and honest at every trigger: the Peón cost for
 * free users, "PRO" (covered) for subscribers. Reuses the price-ribbon
 * gradient language (gold pill, warm-brown border) so it reads as a
 * sibling of the Save Victory price ribbon. Currency model: to the user
 * the coach currency is the Peón; the backend credits-first consumption
 * is an implementation detail (see spec §Plan 3 "Currency model").
 *
 * Decorative — `aria-hidden`. The cost is conveyed to assistive tech via
 * the existing credits hint / button labels, matching the Save Victory
 * price ribbon (also aria-hidden).
 */
export function CoachCostRibbon({ proActive = false, variant = "cta" }: Props) {
  return (
    <span
      className={[
        "coach-cost-ribbon",
        `coach-cost-ribbon--${variant}`,
        proActive ? "coach-cost-ribbon--pro" : "coach-cost-ribbon--peon",
      ].join(" ")}
      aria-hidden="true"
    >
      {!proActive && (
        <ThemeAssetPicture slot="board.piece.white.pawn" pictureClassName="coach-cost-ribbon__icon" alt="" draggable={false} />
      )}
      <span className="coach-cost-ribbon__label">{proActive ? "PRO" : "1"}</span>
    </span>
  );
}
