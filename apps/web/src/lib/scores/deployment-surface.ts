/**
 * Which surface THIS deployment is, for score-save provenance (Slice 0).
 *
 * Learn and Play share one Supabase project (founder confirmed 2026-07-27),
 * so `score_saves` mixes both products' rows with nothing to tell them apart
 * — audit R12. The signed payload carries a `surface`, but a value the client
 * picks is a value the client can lie about, so the server compares it against
 * the deployment's own mode and rejects a mismatch.
 *
 * Reads the env at CALL time, not import time, so a route gate is testable
 * per-request and cannot be frozen by import order — same convention as
 * `isLiteModeServer` in `feature-flags.ts`.
 *
 * `full` is the internal-only mode (see [[project_shipped_modes_learn_play]]):
 * it is not a shipped surface, and it maps to `learn` because that is the
 * product a full build behaves as for the exercises flow. It is called out
 * explicitly rather than defaulted silently, so nobody later reads a `learn`
 * row and assumes it came from the Learn deployment without checking this.
 */

import type { ScoreSaveSurface } from "@/lib/scores/save-authorization";

export function resolveDeploymentSurface(): ScoreSaveSurface {
  const mode = process.env.NEXT_PUBLIC_CHESSCITO_MODE?.trim();
  if (mode === "play") return "play";
  if (mode === "learn") return "learn";

  // No explicit mode: fall back to the legacy Lite flag, then to learn.
  // A `full` (internal) build lands here too — see the note above.
  return "learn";
}

/**
 * Thrown when the deployment does not declare which product it is.
 *
 * Its own class, not a bare Error, so a route can tell "this deployment is
 * misconfigured" (a 500 the operator must fix) apart from "the database is
 * unhappy" (a 500 that may pass on retry).
 */
export class UnresolvedSurfaceError extends Error {
  constructor() {
    super(
      "NEXT_PUBLIC_CHESSCITO_MODE is not set to an explicit surface " +
        "(learn | play | full). The weekly leaderboard is surface-scoped and " +
        "has no safe default — refusing to guess.",
    );
    this.name = "UnresolvedSurfaceError";
  }
}

/**
 * Which surface this deployment is, for the READ path (Slice 2B, decision D5).
 *
 * WHY THIS EXISTS ALONGSIDE `resolveDeploymentSurface`, AND DOES NOT REPLACE IT
 * ----------------------------------------------------------------------------
 * The two have deliberately opposite failure modes, because the same missing
 * env means different things on the two paths:
 *
 *   - WRITE: falling back to `learn` is self-consistent. The row is written
 *     with `surface = 'learn'` and read back the same way. Provenance stays
 *     coherent even if the label is wrong, and changing it now would
 *     reinterpret rows already in the table.
 *   - READ: falling back is not detectable. A Play deployment with the variable
 *     missing would serve LEARN's weekly board — correctly ranked, correctly
 *     labelled, and wholly wrong. Nobody would file that bug, because the
 *     screen looks exactly like a working leaderboard.
 *
 * So this one throws. The all-time board is not surface-scoped and must never
 * call it: resolving the surface before branching on the requested window would
 * make an unset mode break the legacy responses too.
 *
 * Reads the env at CALL time, matching the helper above.
 */
export function requireDeploymentSurface(): ScoreSaveSurface {
  const mode = process.env.NEXT_PUBLIC_CHESSCITO_MODE?.trim();
  if (mode === "play") return "play";
  if (mode === "learn") return "learn";
  // `full` is internal-only and behaves as Learn for the exercises flow. It
  // resolves because it was SET — that is the entire difference from the throw
  // below, and the reason this is spelled out instead of defaulted.
  if (mode === "full") return "learn";
  throw new UnresolvedSurfaceError();
}
