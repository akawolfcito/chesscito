/**
 * Attempt lifecycle — identity and delivery for one completed attempt.
 *
 * Spec: docs/specs/2026-07-28-attempt-identity-score-attempts.md (v7, D11/D19/D20).
 *
 * TWO GUARANTEES, TWO MECHANISMS
 * ------------------------------
 * EXACTLY-ONCE (D19) is NOT here. It is a latch in the three host assemblers,
 * keyed on a canonical completion key, because the boards may legitimately
 * report a completion more than once and `if (!reached) return`
 * (exercises-screen.tsx:3142) cannot dedupe: three of the four families that
 * route through `handleLabyrinthMove` call it as `onComplete` with the target
 * position passed literally, so `reached` is true by construction.
 *
 * AT-LEAST-ONCE (D20) is this module. A completed attempt is enqueued and stays
 * enqueued until the SERVER confirms that specific attempt. The reducer
 * deliberately has NO event for resetBoard / exercise change / piece change:
 * `resetBoard()` is called from ~20 sites, several on timers immediately after a
 * completion, so any event that could clear an unsent attempt would eventually
 * race one away. Not observing the board at all is the mechanism — there is no
 * path from the visual lifecycle to the queue.
 *
 * One mint per completion, N submissions per mint: a retry re-sends the SAME
 * `attemptId`, which the server answers as a replay (it inserts nothing and
 * consumes no budget), so a retry can never become a second attempt.
 */

import type { AttemptMeasurement } from "./attempt-measurement";

/** 32 lowercase hex. */
const ATTEMPT_ID_RE = /^[0-9a-f]{32}$/;

export function isAttemptIdShape(value: unknown): value is string {
  return typeof value === "string" && ATTEMPT_ID_RE.test(value);
}

/** Everything one completed attempt reports. Captured at completion, once. */
export type AttemptSnapshot = {
  attemptId: string;
  exerciseId: string;
  measurement: AttemptMeasurement;
  /**
   * Captured at completion on purpose. `timeMs` in the screen returns 1000n
   * whenever `phase !== "success"` (exercises-screen.tsx:1055-1058), so reading
   * it at submit time would persist a fake 1-second duration on any retry that
   * happens after a board reset. There are no sentinels in this table.
   */
  timeMs: number;
  /** Declared; the server re-derives the canonical one from the catalogue. */
  levelId: number;
  /** Cumulative piece total at completion. Reconciliation only — never ranked. */
  score: number;
};

export type AttemptEvent =
  /** The completion transition. The ONLY event that mints. */
  | { type: "completed"; snapshot: Omit<AttemptSnapshot, "attemptId"> }
  /**
   * Attempts recovered from storage on mount — the previous session's queue,
   * read back before anything new is minted. Mints nothing: these ids already
   * exist, and re-minting would turn one attempt into two (DEBT-2).
   */
  | { type: "hydrated"; snapshots: readonly AttemptSnapshot[] }
  | { type: "submission_started"; attemptId: string }
  | { type: "submission_settled"; attemptId: string }
  | { type: "submission_failed"; attemptId: string };

export type AttemptLifecycleState = {
  /** FIFO of minted attempts the server has not confirmed. */
  outbox: AttemptSnapshot[];
  /** The attemptId currently being POSTed, if any. */
  inFlight: string | null;
};

/**
 * A client that may be offline must not queue without bound. The cap is far
 * above a realistic session burst; reaching it means the server has been
 * unreachable for a long time. On overflow the OLDEST is dropped — the most
 * recent play is the more useful thing to keep.
 */
export const OUTBOX_MAX = 20;

export const initialAttemptLifecycleState: AttemptLifecycleState = {
  outbox: [],
  inFlight: null,
};

/** 16 bytes of CSPRNG as 32 lowercase hex. Injectable so tests can name ids. */
export function mintAttemptId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function attemptLifecycleReducer(
  state: AttemptLifecycleState,
  event: AttemptEvent,
  mint: () => string = mintAttemptId,
): AttemptLifecycleState {
  switch (event.type) {
    case "completed": {
      const snapshot: AttemptSnapshot = { ...event.snapshot, attemptId: mint() };
      const queued = [...state.outbox, snapshot];
      // Drop the OLDEST on overflow: the most recent play is the more useful
      // thing to keep, and reaching the cap means a long outage, not a burst.
      return { ...state, outbox: queued.slice(-OUTBOX_MAX) };
    }
    case "hydrated": {
      // Recovered attempts are OLDER than anything this session minted, so they
      // go in front — they are the ones that have been waiting through an
      // outage. Deduped by id because mount can run twice (StrictMode, a
      // remount, a second drain): re-queuing a live id would leave a duplicate
      // behind after the server settles the first copy.
      const known = new Set(state.outbox.map((s) => s.attemptId));
      if (state.inFlight !== null) known.add(state.inFlight);
      const recovered = event.snapshots.filter((s) => !known.has(s.attemptId));
      if (recovered.length === 0) return state;
      return {
        ...state,
        outbox: [...recovered, ...state.outbox].slice(-OUTBOX_MAX),
      };
    }
    case "submission_started":
      return { ...state, inFlight: event.attemptId };
    case "submission_settled":
      // Removes THAT attempt and only that one, wherever it sits in the queue.
      return {
        outbox: state.outbox.filter((s) => s.attemptId !== event.attemptId),
        inFlight: state.inFlight === event.attemptId ? null : state.inFlight,
      };
    case "submission_failed":
      // Keeps the snapshot on purpose. The retry re-sends the same attemptId,
      // which the server answers as a replay (no insert, no budget spent), so a
      // retry can never become a second attempt.
      return {
        ...state,
        inFlight: state.inFlight === event.attemptId ? null : state.inFlight,
      };
    default:
      // Anything the reducer does not know is inert. This is not defensive
      // coding: it is the D20 mechanism. No board event can reach the queue.
      return state;
  }
}

/** The next snapshot to POST, or null while one is in flight / the queue is empty. */
export function selectNextSubmission(
  state: AttemptLifecycleState,
): AttemptSnapshot | null {
  if (state.inFlight !== null) return null;
  return state.outbox[0] ?? null;
}
