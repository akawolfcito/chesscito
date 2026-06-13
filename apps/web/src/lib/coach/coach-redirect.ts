import type { CoachPhase } from "./use-coach-analysis";
import type { BasicCoachResponse, CoachResponse } from "./types";

/**
 * Plan 2 (Render-A) — gate the arena → `/coach/[gameId]` redirect.
 *
 * `/api/coach/analyze` persists the analysis key BEFORE returning
 * `status:"ready"`, so on phase `result` the analysis IS readable by the
 * viewer's cold load. The client-only quick review (phase `fallback`) is
 * NEVER persisted — redirecting on it lands the user on an empty Match
 * Review (the founder-reported bug). Redirect ONLY on a persisted `full`
 * result; let `fallback` render inline in the arena popup instead.
 */
export function shouldRedirectToCoachViewer(
  phase: CoachPhase,
  response: CoachResponse | BasicCoachResponse | null,
): boolean {
  return phase === "result" && response?.kind === "full";
}
