"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { track } from "@/lib/telemetry";
import {
  hasSeenDailyTour,
  isHubTourLaunchable,
  markHubTourSeen,
  type HubTourMode,
  type HubTourOutcome,
} from "@/lib/hub/hub-tour";

export type UseHubTourArgs = {
  mode?: HubTourMode;
  enabled: boolean;
  /** State narrated by the tour must be resolved before it opens. */
  ready: boolean;
};

export function useHubTour({
  mode = "learn",
  enabled,
  ready,
}: UseHubTourArgs) {
  const [open, setOpen] = useState(false);
  const [includeDaily, setIncludeDaily] = useState(() => !hasSeenDailyTour());
  const decidedRef = useRef(false);
  const replayingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !ready || decidedRef.current) return;
    decidedRef.current = true;
    if (!isHubTourLaunchable(document, mode)) return;
    setIncludeDaily(!hasSeenDailyTour());
    setOpen(true);
    track("hub_tour_view", { mode });
  }, [enabled, mode, ready]);

  const finish = useCallback(
    (outcome: HubTourOutcome) => {
      if (replayingRef.current) {
        replayingRef.current = false;
        setOpen(false);
        track("hub_tour_finish", { mode, outcome, replay: true });
        return;
      }
      markHubTourSeen(outcome, mode, includeDaily);
      setOpen(false);
      track("hub_tour_finish", { mode, outcome });
    },
    [includeDaily, mode],
  );

  /** Replay is deliberately complete, including the shared Daily explanation. */
  const replay = useCallback(() => {
    replayingRef.current = true;
    setIncludeDaily(true);
    setOpen(true);
    track("hub_tour_replay", { mode });
  }, [mode]);

  return { open, includeDaily, finish, replay };
}
