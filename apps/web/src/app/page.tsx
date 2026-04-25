"use client";

import { PlayHubRoot } from "@/components/play-hub/play-hub-root";

/**
 * Transitional shell — for now `/` keeps rendering the play hub so
 * existing MiniPay bookmarks and internal Link targets continue to
 * work. Subsequent commits in the web-landing sprint move the
 * canonical play-hub URL to `/hub` and replace this page with the
 * public landing.
 */
export default function PlayHubPage() {
  return <PlayHubRoot />;
}
