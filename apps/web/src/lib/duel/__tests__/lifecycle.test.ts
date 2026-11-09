import { describe, it, expect } from "vitest";

import { materialize, toPublic } from "../lifecycle";
import { toDuel, type DuelRow } from "../row";
import type { Duel, DuelColor } from "../types";

const HASH_W = "a".repeat(64);
const HASH_B = "b".repeat(64);
const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/** Same position with black to move. */
const BLACK_TO_MOVE =
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

const NOON = Date.parse("2026-08-15T12:00:00.000Z");
const at = (ms: number) => new Date(NOON + ms).toISOString();

function row(overrides: Partial<DuelRow> = {}): DuelRow {
  return {
    id: "A".repeat(22),
    status: "awaiting-opponent",
    white_token_hash: HASH_W,
    black_token_hash: null,
    white_display_name: "Ana",
    black_display_name: null,
    white_claimed_at: at(0),
    black_claimed_at: null,
    white_remaining_ms: 600_000,
    black_remaining_ms: 600_000,
    moves: [],
    fen: START,
    outcome: null,
    version: 1,
    created_at: at(0),
    expires_at: at(60 * 60 * 1000),
    last_move_at: null,
    initial_minutes: 10,
    invited_by: "account:abc",
    ...overrides,
  };
}

/** A duel under way: both seats taken, clock stamped at noon. */
function activeDuel(overrides: Partial<DuelRow> = {}): Duel {
  return toDuel(
    row({
      status: "active",
      black_token_hash: HASH_B,
      black_display_name: "Beto",
      black_claimed_at: at(0),
      last_move_at: at(0),
      moves: ["e4"],
      fen: BLACK_TO_MOVE,
      ...overrides,
    }),
  );
}

describe("toPublic — what a client is allowed to see", () => {
  /**
   * ⛔ The assertion is on the SERIALIZED payload, never on the type. An
   * `Omit<>` in TypeScript deletes nothing at runtime: a mapper that spreads
   * the seat and "removes" the field by typing would ship the hash to both
   * players and every test on the type would still pass.
   */
  it("never serializes a token hash", () => {
    const json = JSON.stringify(toPublic(activeDuel(), "w"));

    expect(json).not.toContain("tokenHash");
    expect(json).not.toContain(HASH_W);
    expect(json).not.toContain(HASH_B);
  });

  it("keeps the cosmetic half of the seat", () => {
    const pub = toPublic(activeDuel(), "w");

    expect(pub.seats.w).toEqual({
      color: "w",
      displayName: "Ana",
      claimedAt: at(0),
      remainingMs: 600_000,
    });
  });

  it("reports which seat the asker holds, and whose move it is", () => {
    const duel = activeDuel();

    expect(toPublic(duel, "b").you).toBe("b");
    expect(toPublic(duel, "b").turnOf).toBe("b");
    expect(toPublic(duel, "b").yourTurn).toBe(true);

    expect(toPublic(duel, "w").you).toBe("w");
    expect(toPublic(duel, "w").yourTurn).toBe(false);
  });

  /**
   * ⚠️ Behaviour 8: a credential that matches no seat of THIS duel gets
   * `not-your-seat` "without revealing whose turn it is". A spectator still
   * sees the board — the link forwarded mid-game is read-only, not a leak —
   * but `yourTurn` must never be true for someone with no seat.
   */
  it("gives a seatless reader no seat and no turn", () => {
    const pub = toPublic(activeDuel(), null);

    expect(pub.you).toBeNull();
    expect(pub.yourTurn).toBe(false);
  });

  it("has nobody on move before the game starts or after it ends", () => {
    expect(toPublic(toDuel(row()), "w").turnOf).toBeNull();
    expect(
      toPublic(
        activeDuel({ status: "finished", outcome: { kind: "resign", winner: "w" } }),
        "w",
      ).turnOf,
    ).toBeNull();
  });
});

describe("materialize — the flag falls on READ, with no cron", () => {
  it("leaves a duel with time on the clock alone", () => {
    const { duel, changed } = materialize(activeDuel(), NOON + 60_000);

    expect(changed).toBe(false);
    expect(duel.status).toBe("active");
    expect(duel.outcome).toBeNull();
  });

  /**
   * Behaviour 15: whoever runs out of THEIR OWN time loses. Nobody has to move
   * and no job has to run — the next read of anyone materializes it.
   */
  it("ends the game when the seat on move has run out", () => {
    const { duel, changed } = materialize(activeDuel(), NOON + 600_001);

    expect(changed).toBe(true);
    expect(duel.status).toBe("finished");
    expect(duel.outcome).toEqual({ kind: "timeout", winner: "w" });
    expect(duel.seats.b.remainingMs).toBe(0);
    expect(duel.version).toBe(2);
  });

  /** ⚠️ An exactly empty bank is a fallen flag, not "zero left and still playing". */
  it("treats an exactly empty bank as a fallen flag", () => {
    const { duel } = materialize(activeDuel(), NOON + 600_000);
    expect(duel.status).toBe("finished");
  });

  /** ⛔ Only the seat ON MOVE is charged. The other one is not waiting on its own clock. */
  it("never charges the seat that is not on move", () => {
    const { duel } = materialize(activeDuel(), NOON + 600_001);
    expect(duel.seats.w.remainingMs).toBe(600_000);
  });

  it("expires an invitation nobody answered, with no winner", () => {
    const { duel, changed } = materialize(toDuel(row()), NOON + 60 * 60 * 1000);

    expect(changed).toBe(true);
    expect(duel.status).toBe("expired");
    expect(duel.outcome).toBeNull();
  });

  /**
   * ⛔ THE ONE THAT PROTECTS A WIN. `expiresAt` is the INVITATION clock and
   * stops mattering the moment somebody sits down; once `active`, the chess
   * clock is what ends the game. A duel that expires `active` would be written
   * `expired` over a live game — and the table refuses it
   * (`duels_expired_never_had_two_players`) precisely because that erases a
   * win by flag with nothing complaining.
   */
  it("does NOT expire a game that is already under way", () => {
    const { duel, changed } = materialize(
      activeDuel({ expires_at: at(-1) }),
      NOON + 60_000,
    );

    expect(changed).toBe(false);
    expect(duel.status).toBe("active");
  });

  /**
   * ⛔ THE FIXED ORDER, and the only place it lives. The flag is judged against
   * the `lastMoveAt` BEFORE the move, so a mate delivered exactly as the bank
   * empties loses on time. Both readings were defensible; this one is pinned so
   * two implementations cannot differ. A route that applies the move first and
   * then checks the clock produces the opposite result on the same input.
   */
  it("judges the flag against the stamp BEFORE any move is applied", () => {
    const before = activeDuel();
    const { duel } = materialize(before, NOON + 600_001);

    expect(duel.outcome).toEqual({ kind: "timeout", winner: "w" });
    expect(duel.moves).toEqual(["e4"]);
    expect(duel.fen).toBe(BLACK_TO_MOVE);
  });

  it("leaves a finished or expired duel untouched", () => {
    for (const settled of [
      activeDuel({ status: "finished", outcome: { kind: "resign", winner: "w" } }),
      toDuel(row({ status: "expired", expires_at: at(-1) })),
    ] as Duel[]) {
      const { duel, changed } = materialize(settled, NOON + 10 * 60 * 60 * 1000);
      expect(changed).toBe(false);
      expect(duel).toEqual(settled);
    }
  });

  /** The input is never mutated: a failed write must leave the caller's copy intact. */
  it("returns a new duel and does not mutate the one it was given", () => {
    const original = activeDuel();
    const snapshot = structuredClone(original);

    materialize(original, NOON + 600_001);

    expect(original).toEqual(snapshot);
  });
});

describe("materialize + toPublic together", () => {
  /**
   * ⚠️ Edge case of the spec: the write inside a GET can fail. When it does,
   * the GET must still answer the EXPIRED/finished state it computed —
   * expiration is a function of time, not a write permission.
   */
  it("reports the flag even if nothing was ever persisted", () => {
    const { duel } = materialize(activeDuel(), NOON + 600_001);
    const pub = toPublic(duel, "b" as DuelColor);

    expect(pub.status).toBe("finished");
    expect(pub.outcome).toEqual({ kind: "timeout", winner: "w" });
    expect(pub.turnOf).toBeNull();
    expect(pub.yourTurn).toBe(false);
  });
});
