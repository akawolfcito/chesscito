"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { track } from "@/lib/telemetry";
import {
  isHubTourLaunchable,
  markHubTourSeen,
  type HubTourOutcome,
} from "@/lib/hub/hub-tour";

export type UseHubTourArgs = {
  /** LEARN only. PLAY has no tour. */
  enabled: boolean;
  /** The player's state (daily done? pass held?) has resolved. Launching before
   *  it does would show the wrong copy — and re-selling a pass someone already
   *  bought is the one thing this tour must never do. */
  ready: boolean;
};

/** Owns WHETHER the hub tour runs. The presenter owns what it says.
 *
 *  The launch decision is made exactly once per mount: if a modal is on screen
 *  when the hub settles, this hub is not eligible and the tour waits for the
 *  next one. Re-evaluating on every render would make it pop open the instant
 *  the season-pass sheet closed — an ambush, and precisely the "one modal at a
 *  time" invariant we are protecting. */
export function useHubTour({ enabled, ready }: UseHubTourArgs) {
  const [open, setOpen] = useState(false);
  const decidedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !ready || decidedRef.current) return;
    decidedRef.current = true;
    if (!isHubTourLaunchable(document)) return;
    setOpen(true);
    track("hub_tour_view");
  }, [enabled, ready]);

  const finish = useCallback((outcome: HubTourOutcome) => {
    markHubTourSeen(outcome);
    setOpen(false);
    track("hub_tour_finish", { outcome });
  }, []);

  return { open, finish };
}
