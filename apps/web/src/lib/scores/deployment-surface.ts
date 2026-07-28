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
