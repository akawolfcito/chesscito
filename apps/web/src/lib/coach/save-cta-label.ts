import type { CoachGameResult } from "./types";

/**
 * F8 — single source of truth for the Save CTA label key.
 *
 * A win keeps the celebratory "saveVictory"; every other outcome
 * (lose / draw / resigned) uses the neutral "saveMatch" (founder branding
 * decision 2026-06-13). Callers apply their own `useTranslations` namespace
 * to the returned key, so no surface branches on the result inline.
 */
export function saveCtaLabelKey(
  result: CoachGameResult,
): "saveVictory" | "saveMatch" {
  return result === "win" ? "saveVictory" : "saveMatch";
}
