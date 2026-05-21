import { track } from "@/lib/telemetry";

/**
 * Canonical source tag for every coach-analyze telemetry event. Lifted from
 * the inline `AnalyzeSource` union previously declared in `arena/page.tsx`
 * so both the end-state flow (`startCoachAnalysis`) and the history flow
 * (`handleAnalyzeFromHistory`) share one type — closes the drift gap
 * flagged by Cluster E Acceptance auditor #12.
 *
 * - `immediate`        — user taps "Ask Coach" from the arena end overlay.
 * - `victory-mint`     — user opens the coach review after a Victory NFT mint.
 * - `history`          — user re-opens an analyzed game from coach-history.
 */
export type AnalyzeSource = "immediate" | "victory-mint" | "history";

/**
 * Failure reasons mirrored from `requestCoachAnalyze`'s `error` outcome.
 * Kept as a string union (not an enum) so the schema lands cleanly in
 * downstream analytics tooling without extra mapping.
 */
export type AnalyzeFailureReason =
  | "network_error"
  | "server_error"
  | "parse_error"
  | "no_payload";

export type AnalyzeRequestContext = {
  source: AnalyzeSource;
  /** Persisted game id at telemetry time. Always present in both flows. */
  gameId: string;
  /** End-state-only context. History flow lacks these. */
  difficulty?: string;
  moves?: number;
  result?: string;
};

/**
 * Emit `coach_analyze_request` with the unified payload shape. Optional
 * context fields are dropped when undefined to avoid key bloat on the
 * history flow's lean payload.
 */
export function trackAnalyzeRequest(ctx: AnalyzeRequestContext): void {
  const props: Record<string, unknown> = {
    source: ctx.source,
    game_id: ctx.gameId,
  };
  if (ctx.difficulty !== undefined) props.difficulty = ctx.difficulty;
  if (ctx.moves !== undefined) props.moves = ctx.moves;
  if (ctx.result !== undefined) props.result = ctx.result;
  track("coach_analyze_request", props);
}

/**
 * Emit `coach_analyze_idempotent_hit` when the analyze endpoint returns
 * `idempotent: true` (a previously-completed analysis was re-served without
 * consuming a credit). Source-only payload keeps the signal honest.
 */
export function trackAnalyzeIdempotentHit(source: AnalyzeSource): void {
  track("coach_analyze_idempotent_hit", { source });
}

/**
 * Emit `coach_analyze_failed` for any non-success outcome of the analyze
 * request. Status is normalized to `null` when absent so the downstream
 * schema stays uniform.
 */
export function trackAnalyzeFailed(opts: {
  source: AnalyzeSource;
  reason: AnalyzeFailureReason;
  status?: number;
}): void {
  track("coach_analyze_failed", {
    source: opts.source,
    reason: opts.reason,
    status: opts.status ?? null,
  });
}
