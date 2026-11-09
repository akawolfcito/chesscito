/**
 * The eight states of the duel Arena, as a pure function of what the server
 * said plus whether we are still loading.
 *
 * Spec: `docs/specs/2026-08-15-duel-arena-ui-states-spec.md`.
 *
 * ⛔ Every one of these is derived from `DuelPublic` — `status`, `you` and
 * `yourTurn` — and NOTHING here is a flag the UI keeps on the side. That is the
 * point: a screen state the server cannot reconstruct is a screen state that
 * survives a reload as a lie. The only thing the component owns beyond this is
 * the clock interpolation, which is a rendering of `lastMoveAt`, not a state.
 */

import type { DuelPublic } from "./types";

export type DuelArenaState =
  /** First read in flight. */
  | { kind: "loading" }
  /** 404, or a broken read. There is nothing to show. */
  | { kind: "missing" }
  /** I opened a duel; nobody has answered yet. I hold a seat. */
  | { kind: "inviting"; duel: DuelPublic }
  /** Somebody's link, with the other seat free. */
  | { kind: "invited"; duel: DuelPublic }
  /** Under way, my move. THE ONLY STATE WHERE THE BOARD IS INTERACTIVE. */
  | { kind: "your-turn"; duel: DuelPublic }
  /** Under way, their move. */
  | { kind: "their-turn"; duel: DuelPublic }
  /** Under way, and I hold no seat: the link forwarded mid-game. Read only. */
  | { kind: "watching"; duel: DuelPublic }
  | { kind: "finished"; duel: DuelPublic }
  /** The invitation nobody answered. No winner. */
  | { kind: "expired"; duel: DuelPublic };

export type DuelArenaInput =
  | { status: "loading" }
  | { status: "missing" }
  | { status: "loaded"; duel: DuelPublic };

export function duelArenaState(input: DuelArenaInput): DuelArenaState {
  if (input.status === "loading") return { kind: "loading" };
  if (input.status === "missing") return { kind: "missing" };

  const duel = input.duel;

  switch (duel.status) {
    case "finished":
      return { kind: "finished", duel };
    case "expired":
      return { kind: "expired", duel };
    case "awaiting-opponent":
      // ⚠️ Whoever holds a seat here is the creator: joining flips the duel to
      // `active` in the same write, so there is no third possibility.
      return duel.you ? { kind: "inviting", duel } : { kind: "invited", duel };
    case "active":
      if (!duel.you) return { kind: "watching", duel };
      return duel.yourTurn
        ? { kind: "your-turn", duel }
        : { kind: "their-turn", duel };
  }
}

/**
 * ⛔ The board is interactive in EXACTLY ONE state.
 *
 * Written as its own function, and tested against every state, because "locked"
 * is the kind of prop that gets computed inline as `!duel.yourTurn` and then
 * silently unlocks the board for a spectator the day `yourTurn` is undefined.
 */
export function isBoardInteractive(state: DuelArenaState): boolean {
  return state.kind === "your-turn";
}

/**
 * Whether to keep asking the server what happened.
 *
 * ⚠️ Polling a `finished` or `expired` duel is not just waste: those two are
 * terminal in the model, so a poll that keeps running is a promise to the
 * reader that something might still change.
 */
export function shouldPoll(state: DuelArenaState): boolean {
  return (
    state.kind === "inviting" ||
    state.kind === "invited" ||
    state.kind === "your-turn" ||
    state.kind === "their-turn" ||
    state.kind === "watching"
  );
}

/**
 * The seat whose bank is counting down right now, or `null` when no clock runs.
 *
 * ⚠️ `null` while `awaiting-opponent` is not an oversight: `lastMoveAt` is null
 * until somebody sits down, so there is nothing to count against. What runs in
 * that state is the INVITATION hour, which is a different clock and belongs to
 * `expiresAt`.
 */
export function runningSeat(state: DuelArenaState): "w" | "b" | null {
  if (
    state.kind !== "your-turn" &&
    state.kind !== "their-turn" &&
    state.kind !== "watching"
  ) {
    return null;
  }
  return state.duel.turnOf;
}

/**
 * What a seat's clock reads right now, interpolated locally.
 *
 * ⛔ THIS IS A RENDERING, NOT A RULE. The server charges with its own clock at
 * the moment a move is applied; this only keeps the number moving between polls
 * so the display does not stutter. A zero here means "ask the server", never
 * "you lost" — a defeat painted by the client that the server has not confirmed
 * is a number the player cannot reconcile.
 */
export function displayedRemainingMs(
  duel: DuelPublic,
  seat: "w" | "b",
  now: number,
): number {
  const stored = duel.seats[seat].remainingMs;
  if (duel.status !== "active" || duel.turnOf !== seat || !duel.lastMoveAt) {
    return stored;
  }
  const since = Date.parse(duel.lastMoveAt);
  if (Number.isNaN(since)) return stored;
  return Math.max(0, stored - Math.max(0, now - since));
}
