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
  /** LEARN owns the Daily gift narrative (2026-07-28 spec). PLAY spends its
   *  three steps on context → offer → action, so it neither shows the Daily
   *  step nor marks it as explained — otherwise a player who opened PLAY first
   *  would never get the ritual explained anywhere. */
  const ownsDaily = mode === "learn";
  const [open, setOpen] = useState(false);
  const [includeDaily, setIncludeDaily] = useState(
    () => ownsDaily && !hasSeenDailyTour(),
  );
  const decidedRef = useRef(false);
  const replayingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !ready || decidedRef.current) return;
    decidedRef.current = true;
    if (!isHubTourLaunchable(document, mode)) return;
    setIncludeDaily(ownsDaily && !hasSeenDailyTour());
    setOpen(true);
    track("hub_tour_view", { mode });
  }, [enabled, mode, ownsDaily, ready]);

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

  /** Replay is deliberately complete — including the Daily explanation in the
   *  hub that owns it. PLAY has no Daily step to restore. */
  const replay = useCallback(() => {
    replayingRef.current = true;
    setIncludeDaily(ownsDaily);
    setOpen(true);
    track("hub_tour_replay", { mode });
  }, [mode, ownsDaily]);

  return { open, includeDaily, finish, replay };
}
