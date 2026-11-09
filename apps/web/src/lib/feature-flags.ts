export type ChesscitoMode = "full" | "learn" | "play";

const VALID_MODES = new Set<ChesscitoMode>(["full", "learn", "play"]);

function resolveChesscitoMode(): ChesscitoMode {
  const configuredMode = process.env.NEXT_PUBLIC_CHESSCITO_MODE?.trim();
  const legacyValue = process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE?.trim();

  if (configuredMode) {
    if (!VALID_MODES.has(configuredMode as ChesscitoMode)) {
      throw new Error(
        `Invalid NEXT_PUBLIC_CHESSCITO_MODE: "${configuredMode}". Expected full, learn, or play.`,
      );
    }

    if (configuredMode === "learn" && legacyValue === "false") {
      throw new Error(
        "Contradictory Chesscito mode flags: learn mode cannot use NEXT_PUBLIC_CHESSCITO_LITE_MODE=false.",
      );
    }

    if (configuredMode !== "learn" && legacyValue === "true") {
      throw new Error(
        `Contradictory Chesscito mode flags: ${configuredMode} mode cannot use NEXT_PUBLIC_CHESSCITO_LITE_MODE=true.`,
      );
    }

    return configuredMode as ChesscitoMode;
  }

  return legacyValue === "true" ? "learn" : "full";
}

export const CHESSCITO_MODE: ChesscitoMode = resolveChesscitoMode();

export function isLearnMode(): boolean {
  return CHESSCITO_MODE === "learn";
}

export function isPlayMode(): boolean {
  return CHESSCITO_MODE === "play";
}

export function isFullMode(): boolean {
  return CHESSCITO_MODE === "full";
}

/** @deprecated Use CHESSCITO_MODE or isLearnMode(). */
export const CHESSCITO_LITE_MODE = CHESSCITO_MODE === "learn";

/**
 * Runtime Lite check for server code (route handlers). Reads the env at
 * CALL time, not import time, so a server gate is testable per-request and
 * cannot be frozen by import order. Legacy alias for Learn mode.
 */
export function isLiteModeServer(): boolean {
  return resolveChesscitoMode() === "learn";
}

/**
 * The whole daily-streak nudge sits behind this one build-time flag, so a
 * teaching moment that lands badly is turned off without reverting anything
 * else. Off means: no state is written and nothing renders.
 */
export function isStreakNudgeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_STREAK_NUDGE_ENABLED === "true";
}

export function isVictoryPermitMintEnabled(): boolean {
  return process.env.NEXT_PUBLIC_VICTORY_PERMIT_MINT_ENABLED === "true";
}

/**
 * The attempt lane (Slice 3), and the ONLY way to turn it off.
 *
 * ⚠️ DEFAULT ON — the opposite of every flag above it, on purpose. Those gate
 * features that ship dark and get turned on later. This one gates a lane that
 * is already verified end to end against a production build and a real
 * database; shipping it dark would mean a second deploy just to enable what was
 * already proven. The switch exists to turn it OFF in an emergency, so only the
 * exact string "false" does that — a typo leaves the lane running rather than
 * silently killing it.
 *
 * OFF means: nothing is queued, nothing is drained, nothing renders. It does
 * NOT mean "discard": a queue already persisted stays on disk untouched and
 * drains when the lane comes back. Turning a feature off must not delete the
 * player's plays.
 *
 * It is deliberately CLIENT-side only. The endpoint keeps accepting attempts
 * either way, so flipping this cannot break a request already in flight, and a
 * bundle older than the flag is unaffected.
 */
export function isAttemptLaneEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ATTEMPT_LANE_ENABLED !== "false";
}

/**
 * The weekly Leaders tab (Slice 2C), and the only way to turn it on.
 *
 * DEFAULT OFF, unlike the attempt lane above it. This one changes the DEFAULT
 * VIEW of a live surface, sourced from a table that started writing on
 * 2026-07-29 — so it ships dark and gets flipped after a full UTC week of real
 * data exists to rank.
 *
 * OFF means the sheet renders exactly what it rendered before the slice: no tab
 * control, no weekly request, no new copy on screen.
 *
 * CLIENT-SIDE ONLY, deliberately. `/api/leaderboard?window=weekly` answers
 * regardless of this flag, so the board can be smoke-tested in production
 * before any player can see it.
 *
 * ⚠️ Do not turn this on while `NEXT_PUBLIC_ATTEMPT_LANE_ENABLED` is off. The
 * weekly board is derived entirely from `score_attempts`; with the write lane
 * off it renders an empty board that looks like nobody played. The read path
 * cannot detect that, so it is an ordering rule between two flags, not a check
 * the app can make.
 */
export function isWeeklyLeadersEnabled(): boolean {
  return process.env.NEXT_PUBLIC_WEEKLY_LEADERS_ENABLED === "true";
}

/**
 * Season Pass sales — PAUSED by default since 2026-08-25.
 *
 * ⛔ THIS PAUSES THE OFFER, NOT ACCESS. Everyone who already paid keeps their
 * entitlement, their Focus Days and their card: `buildChallengeProgressView`
 * suppresses only the `offer` state, and only where there is no entitlement to
 * protect. A paused sale must never read as a revocation.
 *
 * The evidence: 17 wallets bought the $0.99 pass, 10 of them never recorded a
 * single Focus Day, and 0 of 18 eligible wallets finished the 21 days in 36
 * days of possibility. Selling that is the sharpest reputational exposure the
 * product has today.
 *
 * ⚠️ Opt-IN, unlike the other flags here: absence means paused. Re-enabling is
 * one env var and a redeploy — no migration, no code change, nothing to undo.
 */
export function isSeasonPassSalesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SEASON_PASS_SALES_ENABLED === "true";
}
