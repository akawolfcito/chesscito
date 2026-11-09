/**
 * What a client is allowed to see, and what the passage of time alone decides.
 *
 * Both halves are pure functions of `(duel, now)`. Nothing here reads a clock,
 * a database or a request — the route supplies `now` from the SERVER clock and
 * owns the write.
 *
 * ⛔ THE FIXED ORDER OF THE SPEC LIVES HERE AND NOWHERE ELSE: the flag is
 * resolved BEFORE a move is applied. `resolveFlag()` and `applyMove()` are
 * separate on purpose — each is pure and neither knows about the other — so
 * whoever composes them in the wrong order produces a game where a mate on the
 * last second beats the clock, which is exactly the decision the spec pinned
 * the other way round.
 */

import { isInvitationExpired, resolveFlag } from "./clock";
import type { Duel, DuelColor, DuelPublic, DuelSeat } from "./types";

/**
 * Strip the credential and answer the two questions a client actually asks:
 * which seat am I, and is it my move.
 *
 * ⛔ The hash is removed by BUILDING a new seat, not by an `Omit<>` on the
 * type. TypeScript deletes nothing at runtime, so a mapper that spreads the
 * seat and "removes" the field by typing ships the hash to both players while
 * every test on the type still passes. The test asserts on the serialized JSON.
 */
export function toPublic(duel: Duel, you: DuelColor | null): DuelPublic {
  const turnOf = turnOfDuel(duel);
  return {
    id: duel.id,
    status: duel.status,
    seats: {
      w: publicSeat(duel.seats.w),
      b: publicSeat(duel.seats.b),
    },
    moves: duel.moves,
    fen: duel.fen,
    outcome: duel.outcome,
    version: duel.version,
    createdAt: duel.createdAt,
    expiresAt: duel.expiresAt,
    lastMoveAt: duel.lastMoveAt,
    initialMinutes: duel.initialMinutes,
    invitedBy: duel.invitedBy,
    you,
    turnOf,
    yourTurn: you !== null && turnOf === you,
  };
}

/** Whose move it is, or `null` when the game is not running. */
export function turnOfDuel(duel: Duel): DuelColor | null {
  if (duel.status !== "active") return null;
  return sideToMove(duel.fen);
}

export type Materialization = {
  duel: Duel;
  /** `true` when the passage of time changed the duel and a write is owed. */
  changed: boolean;
};

/**
 * Apply everything the clock decides, with no event and no job.
 *
 * ⛔ The two clocks are NOT interchangeable, and mixing them erases wins:
 *
 * - `expiresAt` is the INVITATION. It only ever settles an `awaiting-opponent`
 *   duel, and settles it with NO winner — never answering a link is not a
 *   defeat (behaviour 14).
 * - Once `active`, the chess clock is what ends the game (behaviour 15).
 *   Writing `expired` over a live game would delete a win by flag, which is why
 *   the table also refuses it (`duels_expired_never_had_two_players`).
 *
 * ⚠️ A read never CHARGES the clock. The stored `remainingMs` plus `lastMoveAt`
 * is everything the client needs to interpolate its own display; persisting a
 * partial charge on every GET would need `lastMoveAt` to move too, and the
 * mover's clock only stops when they actually move. The only thing a read ever
 * writes is the flag, once, when it has already fallen.
 */
export function materialize(duel: Duel, now: number): Materialization {
  if (duel.status === "active") {
    const onMove = sideToMove(duel.fen);
    const { outcome, remainingMs } = resolveFlag(
      onMove,
      duel.seats[onMove].remainingMs,
      duel.lastMoveAt,
      now,
    );
    if (!outcome) return { duel, changed: false };


    return {
      changed: true,
      duel: {
        ...duel,
        status: "finished",
        outcome,
        version: duel.version + 1,
        seats: {
          ...duel.seats,
          [onMove]: { ...duel.seats[onMove], remainingMs },
        } as Record<DuelColor, DuelSeat>,
      },
    };
  }

  if (duel.status === "awaiting-opponent") {
    if (!isInvitationExpired(duel.expiresAt, now)) return { duel, changed: false };
    // ⚠️ There is NO second in-memory guard on "both seats taken" here, and the
    // omission is deliberate. It would be unreachable (a seated duel is
    // `active`, by constraint) and — worse — it would cover for this `status`
    // check, so mutating the status rule away left every test green. A guard
    // that hides the failure of the rule it doubles is not depth, it is a
    // blindfold. The second lock is in the table, where it can actually be
    // enforced: `duels_expired_never_had_two_players`, verified by running it.
    return {
      changed: true,
      duel: { ...duel, status: "expired", version: duel.version + 1 },
    };
  }

  // `finished` and `expired` are terminal. Time has nothing left to decide.
  return { duel, changed: false };
}

/** Field 2 of the FEN. Cheaper than building a `Chess` to ask one question. */
function sideToMove(fen: string): DuelColor {
  return fen.split(" ")[1] === "b" ? "b" : "w";
}

function publicSeat(seat: DuelSeat): Omit<DuelSeat, "tokenHash"> {
  return {
    color: seat.color,
    displayName: seat.displayName,
    claimedAt: seat.claimedAt,
    remainingMs: seat.remainingMs,
  };
}
