"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

import { HubActionTile } from "@/components/hub/hub-action-tile";
import { HubTileStatusChip } from "@/components/hub/hub-tile-status-chip";
import {
  getMilestoneStore,
  markOpened,
  recordEarned,
} from "@/lib/progression/milestone-storage";
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
  // player has never opened Special Training since it unlocked. This
  // tile IS server-rendered — it sits unconditionally inside
  // `HubScaffold`. It stays SSR-safe because `unlocked` is false on
  // both the server render and the initial client (hydration) render
  // — it only flips true via a post-hydration effect that reads
  // `starsPerPiece` — so both passes emit `null` and there is no
  // markup to mismatch. `getMilestoneStore()` additionally no-ops
  // when `window` is undefined.
  //
  // `isNew` starts `false` and is deliberately NOT a lazy-initializer
  // read of the store: every writer to the store (the veteran-player
  // migration seed, `recordEarned` via the celebration queue) runs in
  // an EFFECT, strictly AFTER this component's first commit. A mount-time
  // snapshot would freeze `isNew` before those writes land and never
  // re-read, so a veteran player whose migration seeds `openedAt` up
  // front would still flash a NEW dot they never earned. Instead this
  // re-reads the store in an effect keyed on `unlocked`: it re-evaluates
  // every time the tile transitions to unlocked (including "arrives
  // already unlocked"), which is the render where a veteran's seeded
  // store is guaranteed to already be on disk. The milestone store has
  // no change-event bus to subscribe to, so `unlocked` is the next best
  // signal available; it does not catch a `recordEarned` for
  // "special-training" that lands while the tile is already unlocked
  // and mounted, but nothing in this flow does that today.
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    if (!unlocked) return;
    setIsNew(getMilestoneStore().events[SPECIAL_TRAINING_KEY]?.openedAt === undefined);
  }, [unlocked]);

  if (!unlocked) return null;

  return (
    <>
      <div data-testid="mini-arena-trigger" className="contents">
        <HubActionTile
          iconSrc="/art/new-icons-chesscito/training-icon-v1.png"
          label={t("mateLabel")}
          ariaLabel={t("arenaUnlockedAriaFormat", { name: setup.name })}
          onClick={() => {
            // `computeMarkOpened` refuses to write `openedAt` onto a
            // milestone that is not yet recorded on disk (guard stays
            // intact: it still refuses non-navigable milestones). The
            // tile only renders once `unlocked` is true, i.e. the
            // player HAS earned "special-training", so recording it
            // here (if some earlier `recordEarned` pass has not
            // already) is correct, not an invention — it just makes
            // sure the event exists before we mark it opened, so the
            // tap is durable across reload instead of a local-only,
            // silently-dropped no-op.
            if (!getMilestoneStore().events[SPECIAL_TRAINING_KEY]) {
              recordEarned([{ id: "special-training" }]);
            }
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
