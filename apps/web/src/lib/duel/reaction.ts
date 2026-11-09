/**
 * What the Arena does with each answer from the server — as a pure function,
 * so the two dangerous rules can be tested without React, timers or a network.
 *
 * ⛔ RULE 1 — A `version-conflict` is ADOPTED, never retried. The route already
 * returns fresh state; replaying a chess move against a position that changed
 * underneath is how a game gets silently corrupted, and it looks like a bug in
 * the referee rather than in the client.
 *
 * ⛔ RULE 2 — A request that got no answer is NOT a refusal. It may have
 * applied. The only safe reaction is to re-READ: a re-POST after a silent
 * success plays the move twice, and the second one lands in a position where it
 * may be legal and disastrous.
 */

import type { DuelApiResult } from "./api";
import type { DuelArenaInput } from "./arena-state";

export type DuelNotice =
  | null
  /** The server disagreed about the board. The position on screen is now theirs. */
  | "illegal-move"
  | "not-your-turn"
  /** Somebody moved first; we already adopted their state. */
  | "version-conflict"
  /** Somebody took the free seat before we did. Not an error — a race lost. */
  | "seat-taken"
  /** The duel ran out while we were looking at it. */
  | "expired"
  /** No answer at all. ⚠️ The move may or may not have applied. */
  | "network"
  /** Anything the Arena has no specific copy for. */
  | "unavailable";

export type DuelReaction = {
  /** The load status to adopt. `previous` is kept when the answer taught us nothing. */
  next: DuelArenaInput;
  notice: DuelNotice;
  /** ⛔ True when the only safe next step is a fresh READ. */
  refetch: boolean;
  /** A credential the server just issued, to persist on this device. */
  seatToken?: string;
};

export function reactToApiResult(
  previous: DuelArenaInput,
  result: DuelApiResult,
): DuelReaction {
  if (result.ok) {
    return {
      next: { status: "loaded", duel: result.duel },
      notice: null,
      refetch: false,
      seatToken: result.seatToken,
    };
  }

  // ⛔ RULE 2. Nothing about the duel is known — not even that the request
  // failed to apply — so the state on screen is left exactly as it was and a
  // read is scheduled. Adopting anything here would be inventing.
  if (result.error === "network") {
    return { next: previous, notice: "network", refetch: true, seatToken: undefined };
  }

  if (result.error === "not_found" || result.error === "404") {
    return { next: { status: "missing" }, notice: null, refetch: false };
  }

  // ⛔ RULE 1. The refusal carries the real position; adopt it and stop. The
  // player sees what actually happened and decides again themselves.
  if (result.duel) {
    return {
      next: { status: "loaded", duel: result.duel },
      notice: noticeFor(result.error),
      refetch: false,
    };
  }

  // A refusal with no state attached: `illegal-move`, `not-your-turn`,
  // `seat-taken`. ⚠️ The last two mean the server knows something we do not, so
  // they are worth a read; an illegal move changed nothing and is not.
  const notice = noticeFor(result.error);
  return {
    next: previous,
    notice,
    refetch: notice === "not-your-turn" || notice === "seat-taken",
  };
}

function noticeFor(error: string): DuelNotice {
  switch (error) {
    case "illegal-move":
    case "not-your-turn":
    case "version-conflict":
    case "seat-taken":
    case "expired":
      return error;
    case "duel-not-active":
      // The duel ended between our read and our write — most often the flag.
      return "expired";
    default:
      return "unavailable";
  }
}
