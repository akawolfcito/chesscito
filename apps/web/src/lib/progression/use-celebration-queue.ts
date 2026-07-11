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
  resolve: (args: GatherArgs) => void;
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
  const resolve = useCallback((args: GatherArgs) => {
    const input = gatherMilestoneInput(args);
    const earned = deriveEarnedMilestones(input);
    const store = recordEarned(earned);
    setQueue(buildCelebrationQueue(selectPending(store)));
  }, []);

  const dismissCurrent = useCallback(() => {
    const current = queueRef.current[0];
    if (!current) return;

    // Side effects happen here, OUTSIDE the state updater, so they run
    // exactly once per call regardless of how many times React invokes the
    // (pure) updater passed to setQueue below.
    markCelebrated(current.id, current.piece);
    // An absorbed event is recognized together with its closer — it must
    // not be left pending and resurface as a stray overlay later.
    for (const id of current.absorbed) {
      markCelebrated(id, current.piece);
    }

    setQueue((prev) => prev.slice(1));
  }, []);

  /** Releases a recognition that was absorbed by a claim flow the player
   *  cancelled. Recognition never depends on signing a transaction — it
   *  re-queues whichever absorbed events are still pending. */
  const releaseAbsorbed = useCallback((step: CelebrationStep) => {
    const store = getMilestoneStore();
    const pending = selectPending(store).filter((event) =>
      step.absorbed.includes(event.id),
    );
    setQueue(buildCelebrationQueue(pending));
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
