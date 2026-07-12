"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { HubActionTile } from "@/components/hub/hub-action-tile";
import { HubTileStatusChip } from "@/components/hub/hub-tile-status-chip";
import { getMilestoneStore, markOpened } from "@/lib/progression/milestone-storage";
import { milestoneKey } from "@/lib/progression/types";
import type { MiniArenaSetup } from "@/lib/game/mini-arena";

const SPECIAL_TRAINING_KEY = milestoneKey("special-training");

// The sheet subtree drags chess.js + js-chess-engine (~29KB gz); loading
// it on first tap keeps both engines out of /hub's first-load bundle.
const MiniArenaSheet = dynamic(
  () => import("@/components/mini-arena/mini-arena-sheet").then((mod) => mod.MiniArenaSheet),
  { ssr: false },
);

type Props = {
  setup: MiniArenaSetup;
  unlocked: boolean;
};

/** Hub right-rail Special Training tile. Renders as a
 *  `.reward-tile.is-locked` (matches LEARN structure) and opens the
 *  MiniArenaSheet when unlocked. Pre-unlock the tile is HIDDEN
 *  entirely — players reported the previous "visible but disabled"
 *  state as a dead tap on first visit with no affordance explaining
 *  why. Hiding until the rook-mastery threshold (12 stars) lights
 *  it up tracks the same "show after interaction" model the rest
 *  of the action rail uses. */
export function HubArenaTile({ setup, unlocked }: Props) {
  const t = useTranslations("HUB_ACTION_RAIL_COPY");
  const [open, setOpen] = useState(false);
  // Sheet mounts on first tap (dynamic chunk fetch) and STAYS mounted so
  // Radix exit animations work on subsequent closes.
  const [everOpened, setEverOpened] = useState(false);
  // NEW dot mirrors the milestone machine's `openedAt`: unset means the
  // player has never opened Special Training since it unlocked. Lazy
  // initializer reads localStorage once at mount — safe here because
  // this component only ever mounts client-side, after `unlocked` (fed
  // by rook stars, which start at 0/false and flip via a post-hydration
  // effect in use-hub-data.ts) has already gone true; it is never part
  // of the SSR/hydration pass. `getMilestoneStore()` itself no-ops when
  // `window` is undefined, so this is also safe if that ever changes.
  const [isNew, setIsNew] = useState(
    () => getMilestoneStore().events[SPECIAL_TRAINING_KEY]?.openedAt === undefined,
  );

  if (!unlocked) return null;

  return (
    <>
      <div data-testid="mini-arena-trigger" className="contents">
        <HubActionTile
          iconSrc="/art/new-icons-chesscito/training-icon-v1.png"
          label={t("mateLabel")}
          ariaLabel={t("arenaUnlockedAriaFormat", { name: setup.name })}
          onClick={() => {
            markOpened("special-training");
            setIsNew(false);
            setEverOpened(true);
            setOpen(true);
          }}
          // Replaces the old permanently-lit "ready" dot (founder
          // micro-block 2026-06-11 admitted it was invented logic — no
          // real cooldown behind it). The dot now means "you have not
          // opened this since it unlocked" and clears on first tap.
          badge={isNew ? <HubTileStatusChip kind="new" /> : null}
        />
      </div>
      {everOpened ? <MiniArenaSheet open={open} onOpenChange={setOpen} setup={setup} /> : null}
    </>
  );
}
