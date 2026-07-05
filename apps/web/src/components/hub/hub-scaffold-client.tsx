"use client";

import { CHESSCITO_MODE } from "@/lib/feature-flags";
import {
  LegacyHubClient,
  type HubScaffoldClientProps,
} from "@/components/hub/legacy-hub-client";
import { PlayHubClient } from "@/components/hub/play-hub-client";

export type { HubInitialSheet } from "@/components/hub/legacy-hub-client";

/** Hook-free deployment dispatcher. Play never mounts the legacy client, so
 * `useHubData` and all Training progress hooks remain outside its React tree. */
export function HubScaffoldClient(props: HubScaffoldClientProps) {
  return CHESSCITO_MODE === "play" ? (
    <PlayHubClient {...props} />
  ) : (
    <LegacyHubClient {...props} />
  );
}
