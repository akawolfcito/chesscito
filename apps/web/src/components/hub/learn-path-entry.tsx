"use client";

import { useTranslations } from "next-intl";

import { HubActionTile } from "@/components/hub/hub-action-tile";
import type { RewardTile } from "@/components/kingdom/reward-column";

/**
 * Learn Home → the ONE entry to the exercise path, as a shortcut tile.
 *
 * WHAT IT REPLACED, AND WHY (two passes, same day)
 * ------------------------------------------------
 * 1. The home used to end in `RewardColumn` — six piece tiles, each its own
 *    destination. Under the Mini-games rail that read as a SECOND navigation
 *    competing with the first, and the smoke could not tell which of the two
 *    was the main thing to do.
 * 2. Its first replacement was a full-width row. Correct hierarchy, wrong
 *    FORM: the row plus the mini-game cards still cost ~185px and the home
 *    scrolled at 360×640 — while PLAY solved the same problem with a compact
 *    rail of 50px tiles and did not scroll (founder, 2026-08-19: "mira como
 *    PLAY si lo resuelve bien").
 *
 * This is now `HubActionTile` — the exact component PLAY's rail uses — so the
 * two home screens read as one product in two modes.
 *
 * ⛔ NOTHING WAS REMOVED FROM THE PRODUCT. The per-piece progression lives
 * where it always ran: inside /exercises, where the dock's badge tab owns the
 * piece switcher and the drawer owns the path. This is a door, not a summary.
 *
 * ⚠️ The mastery count moved into the ARIA label. A 50px tile's caption plate
 * fits ~9 characters; "1 of 6 pieces mastered" cannot render there, and
 * dropping it silently would have lost the readout the previous pass added.
 *
 * PURELY PRESENTATIONAL — no hooks beyond `useTranslations`, no fetch, no
 * storage, no routing, no telemetry. Same contract as `MiniGamesSection`.
 */

export type LearnPathEntryProps = {
  /** The same tiles the roster used to render. Read ONLY to count mastery, so
   *  the entry and the drawer cannot drift into two ideas of "mastered". */
  tiles: readonly RewardTile[];
  /** False before the hub has hydrated its progress. The count is then omitted
   *  from the label rather than announced as zero — `completedPerPiece` fills
   *  in a mount effect, so on first paint every piece reads 0 and a veteran
   *  would hear their progress wiped. */
  isHydrated: boolean;
  onOpen: () => void;
};

/** A piece counts as mastered when its badge is EARNED — claimed on-chain, or
 *  eligible and not yet claimed. Mirrors `deriveRewardTiles`'s own `mastered`
 *  (`claimed || meetsThreshold`), which is what produces these two states. */
function masteredCount(tiles: readonly RewardTile[]): number {
  return tiles.filter(
    (tile) => tile.state === "claimed" || tile.state === "claimable",
  ).length;
}

export function LearnPathEntry({ tiles, isHydrated, onOpen }: LearnPathEntryProps) {
  const t = useTranslations("HUB_LITE_COPY");

  const done = masteredCount(tiles);
  const total = tiles.length;

  const ariaLabel =
    isHydrated && total > 0
      ? `${t("exercisesEntryAriaLabel")} — ${t("exercisesEntryProgressFormat", {
          done,
          total,
        })}`
      : t("exercisesEntryAriaLabel");

  return (
    <HubActionTile
      className="hub-lite-path-tile hub-lite-path-tile--primary"
      testId="learn-path-entry"
      /* ⚠️ The Hub Tour's third step resolves its spotlight with
         `document.querySelector('[data-tour-target="rook"]')`, and that
         attribute used to sit on the rook TILE of the roster this replaced.
         Without it here the tour's last step would measure against nothing.
         The id stays "rook": `HubTourTarget` is a closed union shared with the
         PLAY hub, and the step's copy ("Start with the Rook") still describes
         exactly where this door leads. */
      tourTarget="rook"
      /* One slot, so a new icon is a builder edit and never a code edit. */
      iconSlot="hub.learn-entry"
      label={t("exercisesTileLabel")}
      ariaLabel={ariaLabel}
      onClick={onOpen}
    />
  );
}
