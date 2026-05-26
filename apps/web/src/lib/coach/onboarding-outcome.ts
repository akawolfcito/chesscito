import type { ArenaStatus } from "@/lib/game/types";

/** Subset of game results that map to a first-call onboarding intro
 *  template in COACH_ONBOARDING_COPY.intros. Resignations collapse
 *  into 'lose' (a resignation is a defeat from Luz's framing per spec
 *  §3 — the player conceded, not drew). Stalemate collapses into
 *  'draw'. */
export type OnboardingOutcome = "win" | "lose" | "draw";

/**
 * Maps the terminal arena state to the onboarding intro key Luz
 * should open with. Pure function, no side effects.
 *
 * Non-terminal inputs ("selecting", "playing") aren't reachable from
 * the post-game surface that consumes this, but the fn returns 'lose'
 * as a defensive default — it's the empathetic frame the spec calls
 * out as the most common reality for novice players (§3 "Derrota is
 * the most common case"), so a routing bug surfaces gently rather
 * than as a misplaced victory greeting.
 */
export function gameStatusToOnboardingOutcome(
  status: ArenaStatus,
  isPlayerWin: boolean,
): OnboardingOutcome {
  if (status === "checkmate") return isPlayerWin ? "win" : "lose";
  if (status === "stalemate" || status === "draw") return "draw";
  return "lose";
}
