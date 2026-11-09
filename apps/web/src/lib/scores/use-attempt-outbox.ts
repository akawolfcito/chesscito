"use client";

/**
 * The host seam — where a completed attempt becomes a request.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, stage 4C).
 *
 * DIVISION OF LABOUR
 * ------------------
 * The screen decides that an attempt ENDED and what it measured. This hook
 * decides how it gets DELIVERED. It is deliberately ignorant of boards, stars,
 * the catalogue and `pieceStars`: everything it knows arrives in one `report()`
 * call, already assembled.
 *
 *   board reports a measurement → host assembles → hook delivers
 *
 * That line is not tidiness. It is what makes the ten acceptance properties of
 * 4C testable at all: `exercises-screen.tsx` is ~3700 lines and driving it
 * through a wallet, a catalogue and six boards to assert "a 400 does not block
 * the FIFO" would be a test nobody trusts.
 *
 * THE LATCH LIVES HERE, KEYED ON WHAT THE HOST HANDS OVER
 * ------------------------------------------------------
 * D19's exactly-once is a latch on `${contentId}:${runKey}`. The host computes
 * that key (it owns the run keys); the hook enforces it, because it is the one
 * place every family passes through. A board may legitimately report the same
 * completion more than once — three of the four families that route through
 * `handleLabyrinthMove` pass the target position literally, so `reached` is true
 * by construction — and `report()` is therefore idempotent per completion key.
 *
 * WHY A RETRY IS A DECISION AND NOT A TIMER
 * -----------------------------------------
 * A retryable failure parks the queue instead of re-firing. An automatic loop on
 * a dead network is a battery drain that also re-prompts for a signature when
 * the session is gone. The queue is drained again by the next completion or by
 * an explicit `retry()`, and it survives a closed app in storage — at-least-once
 * does not require at-once.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { isAttemptLaneEnabled } from "@/lib/feature-flags";

import {
  attemptLifecycleReducer,
  initialAttemptLifecycleState,
  selectNextSubmission,
  type AttemptEvent,
  type AttemptLifecycleState,
  type AttemptSnapshot,
} from "./attempt-lifecycle";
import { persistOutbox, readPersistedOutbox } from "./attempt-outbox-storage";
import type { CompletionKey } from "./attempt-run-key";
import type { BasicScoreSaveResult } from "./save-service";

/** Everything the host assembles for one completion. */
export type AttemptReportInput = {
  /** `completionKeyFor(contentId, runKeyFor(family, runKeys))` — D19. */
  completionKey: CompletionKey | string;
  exerciseId: string;
  measurement: AttemptSnapshot["measurement"];
  timeMs: number;
  levelId: number;
  score: number;
};

/** The single injected side effect. Keeps this module free of fetch and wagmi. */
export type AttemptSubmitFn = (
  snapshot: AttemptSnapshot,
) => Promise<BasicScoreSaveResult>;

export type AttemptOutboxStatus =
  /** Nothing queued, or queued and waiting for a trigger that cannot fire. */
  | "idle"
  /** A POST is in flight. */
  | "sending"
  /** The last delivery failed retryably; the queue is parked. */
  | "failed";

export type AttemptOutboxHandle = {
  report: (input: AttemptReportInput) => void;
  retry: () => void;
  status: AttemptOutboxStatus;
  pendingCount: number;
};

/**
 * How the server's answer maps onto the queue.
 *
 * `duplicate` is SETTLED, not a failure: it describes the score row
 * (`player:levelId:score` already exists), while the attempt row was written
 * either way. Treating it as retryable would re-send it forever.
 *
 * `invalid` is TERMINAL in all its reasons. Four of them are grading rejections
 * that re-sending cannot change, and `session_exhausted` cannot be fixed by the
 * same token either. At the head of a FIFO a re-queued terminal failure blocks
 * every attempt behind it for the life of the install, which is a worse outcome
 * than losing the one attempt that was never acceptable.
 *
 * `insufficient_peones` cannot occur on this path — the off-chain save is always
 * free — and is classified terminal for the same reason: it is a refusal, not an
 * outage.
 */
export type AttemptDelivery = "settled" | "retryable" | "terminal";

export function classifyAttemptDelivery(
  result: BasicScoreSaveResult,
): AttemptDelivery {
  switch (result.status) {
    case "saved":
    case "duplicate":
      return "settled";
    case "invalid":
    case "insufficient_peones":
      return "terminal";
    case "rate_limited":
      return "retryable";
    case "error":
      // Network, `unavailable`, `bad_response`, a rejected signature: all of
      // them are "not now", none of them says the attempt was unacceptable.
      return "retryable";
  }
}

/**
 * The lifecycle reducer, scoped to a wallet.
 *
 * `AttemptEvent` deliberately has no reset — that absence IS the D20 mechanism,
 * so a board event can never clear an unsent attempt. But an account switch is
 * not a board event: it changes WHO the queue belongs to, and carrying wallet
 * A's snapshots into wallet B's session would file A's play under B. So the
 * scope change is handled here, in a wrapper, leaving `AttemptEvent` untouched.
 */
type ScopedState = AttemptLifecycleState & {
  /** Whose queue this is; `null` until a wallet is known. */
  wallet: string | null;
  /** Storage has been read for THIS wallet. Nothing drains or mirrors before. */
  hydrated: boolean;
  /** Set by a retryable failure; cleared by `retry()` or a new completion. */
  parked: boolean;
};

type ScopedEvent =
  | { type: "wallet_changed"; wallet: string | null }
  | { type: "hydrated_from_storage"; snapshots: readonly AttemptSnapshot[] }
  | { type: "unparked" }
  | { type: "parked" }
  | { type: "lifecycle"; event: AttemptEvent };

const initialScopedState: ScopedState = {
  ...initialAttemptLifecycleState,
  wallet: null,
  hydrated: false,
  parked: false,
};

export function attemptOutboxReducer(
  state: ScopedState,
  event: ScopedEvent,
): ScopedState {
  switch (event.type) {
    case "wallet_changed":
      if (event.wallet === state.wallet) return state;
      // A hard scope reset. Anything in flight for the old wallet is abandoned
      // here; its resolution is ignored by the wallet guard in the drain.
      return { ...initialScopedState, wallet: event.wallet };
    case "hydrated_from_storage": {
      if (state.hydrated) return state;
      // `hydrated` mints nothing and dedupes by id, so a completion that landed
      // between mount and this event survives — it is already in `outbox` and
      // the recovered ones go in front of it.
      const next = attemptLifecycleReducer(state, {
        type: "hydrated",
        snapshots: event.snapshots,
      });
      return { ...state, ...next, hydrated: true };
    }
    case "unparked":
      return state.parked ? { ...state, parked: false } : state;
    case "parked":
      return { ...state, parked: true };
    case "lifecycle": {
      const next = attemptLifecycleReducer(state, event.event);
      return next === state ? state : { ...state, ...next };
    }
  }
}

export function useAttemptOutbox(args: {
  wallet: string | null;
  submitAttempt: AttemptSubmitFn;
}): AttemptOutboxHandle {
  const { wallet, submitAttempt } = args;
  const [state, dispatch] = useReducer(attemptOutboxReducer, initialScopedState);

  /**
   * The kill switch, read at render rather than at module load so a test — and
   * a server/client boundary — sees the same answer the build does.
   *
   * ONE gate, not four. Off makes this hook inert: nothing hydrates, nothing
   * queues, nothing drains, nothing is written. The consumer needs no flag of
   * its own, because an empty queue already renders nothing — a second gate in
   * the screen would be a second thing to forget.
   *
   * Note what is NOT gated: the persisted queue is never read and never
   * WRITTEN while off, so a queue from a previous session survives untouched
   * and drains when the lane returns. Off is a pause, not a delete.
   */
  const laneEnabled = isAttemptLaneEnabled();
  const laneEnabledRef = useRef(laneEnabled);
  laneEnabledRef.current = laneEnabled;

  /** Completion keys already accepted, per wallet scope. The latch (D19). */
  const seenRef = useRef<Set<string>>(new Set());
  /** The submit seam, read at call time so a re-render cannot stale it. */
  const submitRef = useRef(submitAttempt);
  submitRef.current = submitAttempt;
  /** The wallet a resolution must still match to be applied. */
  const walletRef = useRef<string | null>(wallet);
  walletRef.current = wallet;
  /** The attempt currently being POSTed. Survives the effect re-running. */
  const inFlightRef = useRef<string | null>(null);

  // 1. SCOPE. Runs before anything else touches the queue, and clears the latch
  //    with it: the same completion key under a different wallet is a different
  //    attempt to credit.
  useEffect(() => {
    seenRef.current = new Set();
    inFlightRef.current = null;
    dispatch({ type: "wallet_changed", wallet });
  }, [wallet]);

  // 2. HYDRATE. Before draining and before minting — a rehydrated attempt that
  //    gets minted again stops being one attempt and becomes two.
  useEffect(() => {
    if (!laneEnabled || !wallet || state.wallet !== wallet || state.hydrated) return;
    dispatch({
      type: "hydrated_from_storage",
      snapshots: readPersistedOutbox(wallet),
    });
  }, [laneEnabled, wallet, state.wallet, state.hydrated]);

  // 3. MIRROR. Only after hydration: writing the pre-hydration state would
  //    erase the queue this mount was supposed to recover.
  useEffect(() => {
    if (!laneEnabled || !wallet || state.wallet !== wallet || !state.hydrated) return;
    persistOutbox(wallet, state.outbox);
  }, [laneEnabled, wallet, state.wallet, state.hydrated, state.outbox]);

  // 4. DRAIN. One in flight, FIFO, and never for a wallet that has since
  //    changed.
  useEffect(() => {
    if (!laneEnabled || !wallet || state.wallet !== wallet || !state.hydrated || state.parked)
      return;
    const next = selectNextSubmission(state);
    if (!next) return;

    const scope = wallet;
    // The guard is a ref and NOT the effect's cleanup. Dispatching
    // `submission_started` changes the state this effect depends on, so a
    // cleanup-based cancel would abort the very request it had just started —
    // and every settlement after it would be dropped on the floor.
    if (inFlightRef.current === next.attemptId) return;
    inFlightRef.current = next.attemptId;
    dispatch({
      type: "lifecycle",
      event: { type: "submission_started", attemptId: next.attemptId },
    });

    void (async () => {
      let result: BasicScoreSaveResult;
      try {
        result = await submitRef.current(next);
      } catch {
        // A throwing seam is an outage, not a rejection: the attempt keeps its
        // place and its id.
        result = { status: "error", reason: "network" };
      }
      inFlightRef.current = null;
      // A resolution that arrives after an account switch belongs to the old
      // scope: applying it would mutate the new wallet's queue.
      if (walletRef.current !== scope) return;

      const delivery = classifyAttemptDelivery(result);
      if (delivery === "retryable") {
        dispatch({
          type: "lifecycle",
          event: { type: "submission_failed", attemptId: next.attemptId },
        });
        dispatch({ type: "parked" });
        return;
      }
      // Settled and terminal both REMOVE the attempt, and only that attempt.
      // A terminal one is dropped rather than re-queued precisely so it cannot
      // block the attempts behind it.
      dispatch({
        type: "lifecycle",
        event: { type: "submission_settled", attemptId: next.attemptId },
      });
    })();
    // `state` is read whole on purpose: the drain is a function of the queue,
    // the in-flight slot and the park flag together.
  }, [laneEnabled, wallet, state]);

  const report = useCallback((input: AttemptReportInput) => {
    // The switch is checked through a ref so `report` keeps a stable identity:
    // the host mirrors it into a ref of its own, and a changing callback there
    // would be a second thing to keep fresh.
    if (!laneEnabledRef.current) return;
    // Without a wallet nothing can be written: the save path requires one, so
    // such an attempt could never be sent and would only consume the cap.
    if (!walletRef.current) return;
    // The latch. A board that reports the same completion twice gets one row.
    if (seenRef.current.has(input.completionKey)) return;
    seenRef.current.add(input.completionKey);
    dispatch({ type: "unparked" });
    dispatch({
      type: "lifecycle",
      event: {
        type: "completed",
        snapshot: {
          exerciseId: input.exerciseId,
          measurement: input.measurement,
          timeMs: input.timeMs,
          levelId: input.levelId,
          score: input.score,
        },
      },
    });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: "unparked" });
  }, []);

  const status: AttemptOutboxStatus = state.inFlight
    ? "sending"
    : state.parked
      ? "failed"
      : "idle";

  return useMemo(
    () => ({ report, retry, status, pendingCount: state.outbox.length }),
    [report, retry, status, state.outbox.length],
  );
}
