"use client";

import { PlayHubRoot } from "@/components/play-hub/play-hub-root";

/**
 * `/hub` — canonical play-hub URL. Renders the same PlayHubRoot
 * component as `/` during the transitional commits; subsequent
 * commits move all internal links here and replace `/` with the
 * public landing.
 */
export default function HubPage() {
  return <PlayHubRoot />;
}
