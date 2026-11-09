"use client";

import { CHESSCITO_MODE } from "@/lib/feature-flags";
import {
  LearnHubClient,
  type HubScaffoldClientProps,
} from "@/components/hub/learn-hub-client";
import { PlayHubClient } from "@/components/hub/play-hub-client";

export type { HubInitialSheet } from "@/components/hub/learn-hub-client";

/** Hook-free deployment dispatcher. Play never mounts the LEARN client, so
 * `useHubData` and all Training progress hooks remain outside its React tree. */
export function HubScaffoldClient(props: HubScaffoldClientProps) {
  return CHESSCITO_MODE === "play" ? (
    <PlayHubClient {...props} />
  ) : (
    <LearnHubClient {...props} />
  );
}
