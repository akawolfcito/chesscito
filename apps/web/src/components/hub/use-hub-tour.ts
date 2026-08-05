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
  /**
   * Runs immediately after the tour finishes, in the SAME callback that
   * persists the outcome. This is the only point that already knows all three
   * things a "what happens next" decision needs — that the tour ended, whether
   * it was a replay, and that the seen-flag is now written — so the hub does
   * not have to re-derive any of them.
   *
   * `replay: true` means the player re-opened the tour from settings. A caller
   * that changes what the hub does must ignore those: hijacking the hub of
   * someone already using the product is a regression, not an experiment.
   *
   * Fires for replays too, and reports them honestly, rather than silently
   * not firing — a callback that is sometimes skipped is a callback whose
   * absence carries meaning nobody can see.
   */
  onFinished?: (args: { outcome: HubTourOutcome; replay: boolean }) => void;
};

export function useHubTour({
  mode = "learn",
  enabled,
  ready,
  onFinished,
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

  // Held in a ref so a caller that re-creates the callback on every render
  // cannot re-create `finish` and, through it, the effect identities around
  // it. The tour finishes on a user gesture, so the ref is always current.
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  });

  const finish = useCallback(
    (outcome: HubTourOutcome) => {
      if (replayingRef.current) {
        replayingRef.current = false;
        setOpen(false);
        track("hub_tour_finish", { mode, outcome, replay: true });
        onFinishedRef.current?.({ outcome, replay: true });
        return;
      }
      markHubTourSeen(outcome, mode, includeDaily);
      setOpen(false);
      track("hub_tour_finish", { mode, outcome });
      // AFTER the seen-flag is persisted, on purpose: whatever the caller does
      // next must not be able to run against an install that could still see
      // the tour again. The flag is the experiment's idempotency latch.
      onFinishedRef.current?.({ outcome, replay: false });
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
