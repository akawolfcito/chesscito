"use client";

import { CandyIcon } from "@/components/redesign/candy-icon";
import { MATE_DRILLS_TILE_COPY } from "@/lib/content/editorial";

/** Reserved slot below the LEARN piece column. Renders as a locked
 *  reward-tile sibling — same width and silhouette as the piece tiles
 *  — so players can see that mate drills exist in the kingdom's
 *  roadmap. Non-interactive in v1; the real content surface ships in
 *  a follow-up SPEC. */
export function MateDrillsTile() {
  return (
    <div
      className="reward-tile is-locked mate-drills-tile"
      aria-label={MATE_DRILLS_TILE_COPY.ariaLabel}
      role="img"
    >
      <span className="reward-tile-label">{MATE_DRILLS_TILE_COPY.label}</span>
      <CandyIcon
        name="shield"
        className="reward-tile-piece reward-tile-piece--icon mate-drills-tile-glyph"
      />
      <CandyIcon name="lock" className="reward-tile-lock" />
      <span className="mate-drills-tile-soon">{MATE_DRILLS_TILE_COPY.soonLabel}</span>
    </div>
  );
}
