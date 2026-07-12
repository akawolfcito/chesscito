"use client";

import { useCallback, useRef, useState } from "react";
import type { PieceId } from "@/lib/game/types";
import { buildCelebrationQueue, type CelebrationStep } from "./celebration-queue";
import { gatherMilestoneInput, type GatherArgs } from "./gather-input";
import { deriveEarnedMilestones } from "./milestones";
import {
  getMilestoneStore,
  markCelebrated,
  markOpened,
  recordEarned,
  selectPending,
} from "./milestone-storage";
import type { MilestoneId } from "./types";

export type UseCelebrationQueueReturn = {
  current: CelebrationStep | null;
  /** Returns the queue it just built. `current` is state and only updates on
   *  the next render, so a caller that must know IN THE SAME TICK whether the
   *  machine took ownership of a moment (e.g. the badge) reads this instead of
   *  a stale `current`. */
  resolve: (args: GatherArgs) => CelebrationStep[];
  dismissCurrent: () => void;
  releaseAbsorbed: (step: CelebrationStep) => void;
  openContent: (id: MilestoneId, piece?: PieceId) => void;
};

export function useCelebrationQueue(): UseCelebrationQueueReturn {
  const [queue, setQueue] = useState<CelebrationStep[]>([]);

  // Latest-value ref, refreshed every render. Callbacks read from it instead
  // of closing over `queue` directly, so a `useCallback([])` never goes
  // stale — without needing to perform side effects inside a `setState`
  // updater (updaters must stay pure; React may invoke them more than once).
  const queueRef = useRef(queue);
  queueRef.current = queue;

  /** Evaluate → PERSIST → build → expose. Persistence precedes rendering:
   *  an overlay is a consequence of having recorded the event, never the
   *  cause of it. */
  const resolve = useCallback((args: GatherArgs): CelebrationStep[] => {
    const input = gatherMilestoneInput(args);
    const earned = deriveEarnedMilestones(input);
    const store = recordEarned(earned);
    const next = buildCelebrationQueue(selectPending(store));
    queueRef.current = next;
    setQueue(next);
    return next;
  }, []);

  const dismissCurrent = useCallback(() => {
    const current = queueRef.current[0];
    if (!current) return;

    // Side effects happen here, OUTSIDE the state updater, so they run
    // exactly once per call regardless of how many times React invokes the
    // (pure) updater passed to setQueue below.
    markCelebrated(current.id, current.piece);
    // An absorbed event is recognized together with its closer — it must
    // not be left pending and resurface as a stray overlay later. Each
    // absorbed event carries its OWN piece scope: a piece-scoped closer
    // absorbs global events, and re-attaching the closer's piece to them
    // would build a key that matches nothing and write nothing.
    for (const event of current.absorbed) {
      markCelebrated(event.id, event.piece);
    }

    // Advance the ref SYNCHRONOUSLY, in the same tick. `queueRef.current` is
    // otherwise only refreshed during render, so two `dismissCurrent()`
    // calls before React commits (a double-tap) would both read step A as
    // `[0]`, both mark A celebrated (harmless — idempotent), but both
    // enqueue the same `prev.slice(1)` updater. Applied sequentially those
    // updaters compute `[A,B] → [B] → []`, dropping B from the queue
    // WITHOUT ever marking it celebrated. This is a ref write, not state —
    // it is safe to do outside the (still pure) updater below.
    queueRef.current = queueRef.current.slice(1);
    setQueue((prev) => prev.slice(1));
  }, []);

  /** Releases a recognition that was absorbed by a claim flow the player
   *  cancelled. Recognition never depends on signing a transaction — it
   *  re-queues whichever absorbed events are still pending.
   *
   *  MUST be called BEFORE `dismissCurrent()` on the cancellation path. If
   *  `dismissCurrent()` runs first, it already stamps every absorbed event
   *  (including this one) with `celebratedAt`, so `selectPending` returns
   *  nothing for them and this silently replaces the queue with `[]` —
   *  recognition lost, not just delayed.
   *
   *  Replaces the whole queue rather than splicing into it. That is only
   *  safe because `buildCelebrationQueue` always emits the closer LAST —
   *  nothing follows it today. A future reorder of the queue would break
   *  this assumption silently. */
  const releaseAbsorbed = useCallback((step: CelebrationStep) => {
    const store = getMilestoneStore();
    const pending = selectPending(store).filter((event) =>
      step.absorbed.some(
        (candidate) =>
          candidate.id === event.id && candidate.piece === event.piece,
      ),
    );
    const next = buildCelebrationQueue(pending);
    queueRef.current = next;
    setQueue(next);
  }, []);

  const openContent = useCallback((id: MilestoneId, piece?: PieceId) => {
    markOpened(id, piece);
  }, []);

  return {
    current: queue[0] ?? null,
    resolve,
    dismissCurrent,
    releaseAbsorbed,
    openContent,
  };
}
