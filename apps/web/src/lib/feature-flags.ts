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
