"use client";

import { useSearchParams } from "next/navigation";

import { PlayHubRoot } from "@/components/play-hub/play-hub-root";
import { HubScaffold } from "@/components/hub/hub-scaffold";
import { HUD_COPY } from "@/lib/content/editorial";

const SCAFFOLD_PROGRESS_FORMAT = (used: number, total: number) =>
  HUD_COPY.starsFormat(used, total);

/**
 * `/hub` — canonical play-hub URL. Renders the legacy `<PlayHubRoot>` by
 * default. When the URL carries `?hub=new` the redesigned Game Home
 * composition (`<HubScaffold>`, Story 1.12) renders instead — opt-in
 * preview while the migration lands incrementally.
 */
export default function HubPage() {
  const searchParams = useSearchParams();
  const useScaffold = searchParams?.get("hub") === "new";

  if (useScaffold) {
    return (
      <HubScaffold
        trophies={12}
        pro={{ active: true, daysRemaining: 14 }}
        streak={3}
        stars={{ current: 8, total: 12 }}
        shields={2}
        rewardTiles={[
          { id: "rook", state: "claimable" },
          { id: "bishop", state: "progress" },
          { id: "knight", state: "locked" },
        ]}
        premiumKicker="Training Pass"
        premiumInactiveLabel="Go PRO"
        premiumProgressFormat={SCAFFOLD_PROGRESS_FORMAT}
        premiumAriaLabel="Training Pass — 3 of 12 sessions used"
        premiumUsed={3}
        premiumTotal={12}
        playLabel="PLAY"
        playAriaLabel="Start training"
      />
    );
  }

  return <PlayHubRoot />;
}
