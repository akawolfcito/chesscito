import { describe, it, expect } from "vitest";

import { SEAT_COLUMNS, toDuel, toRow, type DuelRow } from "../row";
import type { Duel } from "../types";

const HASH_W = "a".repeat(64);
const HASH_B = "b".repeat(64);
const FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

/** A duel with the creator seated on white and nobody on black. */
function awaitingRow(overrides: Partial<DuelRow> = {}): DuelRow {
  return {
    id: "A".repeat(22),
    status: "awaiting-opponent",
    white_token_hash: HASH_W,
    black_token_hash: null,
    white_display_name: "Ana",
    black_display_name: null,
    white_claimed_at: "2026-08-15T12:00:00.000Z",
    black_claimed_at: null,
    white_remaining_ms: 600_000,
    black_remaining_ms: 600_000,
    moves: [],
    fen: FEN,
    outcome: null,
    version: 1,
    created_at: "2026-08-15T12:00:00.000Z",
    expires_at: "2026-08-15T13:00:00.000Z",
    last_move_at: null,
    initial_minutes: 10,
    invited_by: "account:abc",
    ...overrides,
  };
}

describe("toDuel", () => {
  it("maps the flat columns onto the two seats", () => {
    const duel = toDuel(awaitingRow());

    expect(duel.seats.w).toEqual({
      color: "w",
      tokenHash: HASH_W,
      displayName: "Ana",
      claimedAt: "2026-08-15T12:00:00.000Z",
      remainingMs: 600_000,
    });
    expect(duel.seats.b.color).toBe("b");
    expect(duel.status).toBe("awaiting-opponent");
    expect(duel.invitedBy).toBe("account:abc");
  });

  /**
   * ⛔ A free seat is `null` in the column and `""` in the model, and the two
   * must never be confused. `resolveSeat` skips a falsy hash on purpose — the
   * day this maps a free seat to the hash of something, whoever hands over that
   * something sits down in the guest's chair.
   */
  it("gives a free seat an empty hash and no stamp", () => {
    const duel = toDuel(awaitingRow());

    expect(duel.seats.b.tokenHash).toBe("");
    expect(duel.seats.b.claimedAt).toBeNull();
  });

  /**
   * ⚠️ `initial_minutes` is `numeric(3,1)`. Postgres drivers hand numerics back
   * as STRINGS to keep the precision they were stored with, and `"10.0" === 10`
   * is false in every comparison the ladder does. Coercing here is the whole
   * reason this seam exists.
   */
  it("coerces a numeric that arrives as a string", () => {
    expect(toDuel(awaitingRow({ initial_minutes: "10.0" })).initialMinutes).toBe(10);
    expect(toDuel(awaitingRow({ initial_minutes: "0.5" })).initialMinutes).toBe(0.5);
    expect(toDuel(awaitingRow({ initial_minutes: 30 })).initialMinutes).toBe(30);
  });

  it("treats a missing move list as an empty game", () => {
    expect(toDuel(awaitingRow({ moves: null })).moves).toEqual([]);
  });

  it("carries the outcome through untouched", () => {
    const duel = toDuel(
      awaitingRow({
        status: "finished",
        outcome: { kind: "timeout", winner: "b" },
      }),
    );
    expect(duel.outcome).toEqual({ kind: "timeout", winner: "b" });
  });
});

describe("toRow", () => {
  it("round-trips a duel without changing a single field", () => {
    const row = awaitingRow();
    expect(toRow(toDuel(row))).toEqual(row);
  });

  it("round-trips a duel that is under way", () => {
    const row = awaitingRow({
      status: "active",
      black_token_hash: HASH_B,
      black_display_name: "Beto",
      black_claimed_at: "2026-08-15T12:05:00.000Z",
      black_remaining_ms: 590_000,
      moves: ["e4", "e5"],
      last_move_at: "2026-08-15T12:06:00.000Z",
      version: 3,
    });
    expect(toRow(toDuel(row))).toEqual(row);
  });

  /**
   * ⛔ The column has `check (white_token_hash ~ '^[0-9a-f]{64}$')`. Writing
   * `""` back for a free seat is rejected by the database, so a JOIN that went
   * through this mapper would fail with a constraint violation instead of
   * seating anyone.
   */
  it("writes NULL, never an empty string, for a free seat", () => {
    const row = toRow(toDuel(awaitingRow()));
    expect(row.black_token_hash).toBeNull();
    expect(row.black_claimed_at).toBeNull();
  });

  it("normalizes the minutes back to a number", () => {
    const row = toRow(toDuel(awaitingRow({ initial_minutes: "0.5" })));
    expect(row.initial_minutes).toBe(0.5);
  });
});

describe("SEAT_COLUMNS", () => {
  /**
   * ⚠️ The CAS update has to name a column per seat. Building those names by
   * concatenating `${color}_remaining_ms` puts a string the compiler cannot
   * check on the hot write path; this map is what makes a typo a build error.
   */
  it("names every per-seat column for both colours", () => {
    expect(SEAT_COLUMNS.w).toEqual({
      tokenHash: "white_token_hash",
      displayName: "white_display_name",
      claimedAt: "white_claimed_at",
      remainingMs: "white_remaining_ms",
    });
    expect(SEAT_COLUMNS.b).toEqual({
      tokenHash: "black_token_hash",
      displayName: "black_display_name",
      claimedAt: "black_claimed_at",
      remainingMs: "black_remaining_ms",
    });
  });

  it("covers every key of a seat except its colour", () => {
    const row = awaitingRow();
    for (const color of ["w", "b"] as const) {
      for (const column of Object.values(SEAT_COLUMNS[color])) {
        expect(row).toHaveProperty(column);
      }
    }
  });
});

describe("the mapper is total", () => {
  /**
   * A field added to `Duel` and forgotten here would round-trip as `undefined`
   * and be silently dropped on the next write. Enumerating the keys is what
   * turns that into a red test.
   */
  it("maps every key of Duel", () => {
    const duel: Duel = toDuel(awaitingRow());
    const expected: Array<keyof Duel> = [
      "id",
      "status",
      "seats",
      "moves",
      "fen",
      "outcome",
      "version",
      "createdAt",
      "expiresAt",
      "lastMoveAt",
      "initialMinutes",
      "invitedBy",
    ];
    expect(Object.keys(duel).sort()).toEqual([...expected].sort());
  });
});
