/**
 * When the duel earns its "get ready" screen.
 *
 * ⛔ THE RULE, and the only one that matters here: the intro belongs to the
 * moment the game STARTS, not to the state of being started.
 *
 * Fire it on the transition `inviting|invited → your-turn|their-turn`. If it
 * fired whenever the duel is simply active, every reload mid-game — and every
 * poll that re-rendered — would replay "Get ready!" over a game already forty
 * moves deep. Somebody opening a forwarded link to watch would get it too, for
 * a game they are not in.
 *
 * ⚠️ Which is why this takes the PREVIOUS kind and not just the current one:
 * the question is not "is the duel active" but "did it just become active in
 * front of this player".
 */

import type { DuelArenaState } from "./arena-state";

type Kind = DuelArenaState["kind"];

/** The states from which a duel can start in front of you. */
const WAITING: ReadonlySet<Kind> = new Set<Kind>(["inviting", "invited"]);

/** The states a started duel lands in for somebody holding a seat. */
const PLAYING: ReadonlySet<Kind> = new Set<Kind>(["your-turn", "their-turn"]);

export function shouldPlayIntro(previous: Kind | null, current: Kind): boolean {
  if (previous === null) return false;
  return WAITING.has(previous) && PLAYING.has(current);
}

/** How long the matchup screen holds. Same beat as the AI match, on purpose:
 *  it is the experience PLAY already established. */
export const DUEL_INTRO_MS = 1800;
