import { PlayHubRoot } from "@/components/play-hub/play-hub-root";
import { HubScaffold } from "@/components/hub/hub-scaffold";
import { HUD_COPY } from "@/lib/content/editorial";

const SCAFFOLD_PROGRESS_FORMAT = (used: number, total: number) =>
  HUD_COPY.starsFormat(used, total);

type SearchParams = { hub?: string | string[] };

/**
 * `/hub` — canonical play-hub URL. Renders the legacy `<PlayHubRoot>` by
 * default. When the URL carries `?hub=new` the redesigned Game Home
 * composition (`<HubScaffold>`, Story 1.12) renders instead — opt-in
 * preview while the migration lands incrementally.
 *
 * Server component on purpose: reading `searchParams` from props avoids
 * `useSearchParams()` + Suspense overhead and keeps the legacy default
 * path zero-overhead vs the prior implementation.
 */
export default function HubPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const hubFlag = Array.isArray(searchParams.hub)
    ? searchParams.hub[0]
    : searchParams.hub;

  if (hubFlag === "new") {
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
