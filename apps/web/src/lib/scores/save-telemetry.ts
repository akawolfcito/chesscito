"use client";

/**
 * SaveScore off-chain — telemetry (Slice 6).
 *
 * Maps a `BasicScoreSaveResult` (the value `postScoreSave` returns) onto
 * the 5 events the spec defines (docs/specs/savescore-offchain-peones.md
 * §Telemetry) and fires it through the shared `track` stack:
 *
 *   saved/free          -> score_save_free
 *   saved/peones        -> score_save_paid          (spent)
 *   duplicate           -> score_save_duplicate
 *   insufficient_peones -> score_save_insufficient  (required, balance)
 *   rate_limited        -> score_save_failed        (reason, retryAfterMs)
 *   invalid / error     -> score_save_failed        (reason, detail)
 *
 * Why one dispatcher (not five emitters like peones/telemetry): the
 * caller already holds the discriminated `result`. A single
 * `emitScoreSaveTelemetry(result, ctx)` makes "exactly one event per
 * response" a structural guarantee — the caller cannot accidentally fire
 * `free` and `duplicate` for the same response, and there is no pre-result
 * event to leak. `buildScoreSaveTelemetry` stays pure for unit testing.
 *
 * Privacy: no wallet / PII. Telemetry is anonymous + session-scoped via
 * the `track` stack; the economic shape (mode, spent, quota) is enough to
 * measure the sink without identifying a player.
 */

import { track } from "@/lib/telemetry";
import type { BasicScoreSaveResult } from "./save-service";

/** Where the save was triggered + the gameplay context. No wallet. */
export type ScoreSaveTelemetryContext = {
  /** Active piece, when known (the exercises surface always has one). */
  piece?: string;
  levelId: number;
  score: number;
  timeMs: number;
  saveId: string;
  /** The surface that triggered the save (e.g. "exercises"). */
  source: string;
};

export type ScoreSaveTelemetry = {
  event: string;
  props: Record<string, unknown>;
};

function baseProps(ctx: ScoreSaveTelemetryContext): Record<string, unknown> {
  return {
    piece: ctx.piece,
    levelId: ctx.levelId,
    score: ctx.score,
    timeMs: ctx.timeMs,
    saveId: ctx.saveId,
    source: ctx.source,
  };
}

/**
 * Pure mapper: result -> (event, props). One event per result, no
 * conditional event names downstream (dashboards filter by event, not by
 * a status field).
 */
export function buildScoreSaveTelemetry(
  result: BasicScoreSaveResult,
  ctx: ScoreSaveTelemetryContext,
): ScoreSaveTelemetry {
  const base = baseProps(ctx);

  switch (result.status) {
    case "saved":
      if (result.mode === "peones") {
        return {
          event: "score_save_paid",
          props: {
            ...base,
            mode: "peones",
            spent: result.spent,
            freeRemaining: result.quota.freeRemaining,
            requiresPeones: result.quota.requiresPeones,
          },
        };
      }
      return {
        event: "score_save_free",
        props: {
          ...base,
          mode: "free",
          spent: 0,
          freeRemaining: result.quota.freeRemaining,
          requiresPeones: result.quota.requiresPeones,
        },
      };

    case "duplicate":
      return {
        event: "score_save_duplicate",
        props: {
          ...base,
          freeRemaining: result.quota.freeRemaining,
          requiresPeones: result.quota.requiresPeones,
        },
      };

    case "insufficient_peones":
      return {
        event: "score_save_insufficient",
        props: {
          ...base,
          required: result.required,
          balance: result.balance,
          freeRemaining: result.quota.freeRemaining,
          requiresPeones: true,
        },
      };

    case "rate_limited":
      return {
        event: "score_save_failed",
        props: { ...base, reason: "rate_limited", retryAfterMs: result.retryAfterMs },
      };

    case "invalid":
      return {
        event: "score_save_failed",
        props: { ...base, reason: "invalid", detail: result.reason },
      };

    case "error":
    default:
      return {
        event: "score_save_failed",
        props: {
          ...base,
          reason: "error",
          detail: (result as { reason?: string }).reason,
        },
      };
  }
}

/** Fire the mapped event through `track` exactly once. */
export function emitScoreSaveTelemetry(
  result: BasicScoreSaveResult,
  ctx: ScoreSaveTelemetryContext,
): void {
  const { event, props } = buildScoreSaveTelemetry(result, ctx);
  track(event, props);
}
