export const CHESSCITO_LITE_MODE =
  process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE === "true";

/**
 * Runtime Lite check for server code (route handlers). Reads the env at
 * CALL time, not import time, so a server gate is testable per-request and
 * cannot be frozen by import order. Mirrors CHESSCITO_LITE_MODE.
 */
export function isLiteModeServer(): boolean {
  return process.env.NEXT_PUBLIC_CHESSCITO_LITE_MODE === "true";
}
