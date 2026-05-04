import { PlayHubRoot } from "@/components/play-hub/play-hub-root";
import { HubScaffoldClient } from "@/components/hub/hub-scaffold-client";

type SearchParams = { hub?: string | string[] };

/**
 * `/hub` — canonical play-hub URL. Renders the legacy `<PlayHubRoot>` by
 * default. When the URL carries `?hub=new` the redesigned Game Home
 * composition (`<HubScaffold>` via `<HubScaffoldClient>`, Story 1.12.1)
 * renders instead — opt-in preview while data wiring stabilizes.
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
    return <HubScaffoldClient />;
  }

  return <PlayHubRoot />;
}
