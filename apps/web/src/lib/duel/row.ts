/**
 * The seam between the flat `duels` row and the `Duel` of the spec.
 *
 * It exists because the table is deliberately flat — two seats in eight columns
 * instead of a child table — so that the CAS is a single
 * `update … where version = $n` and the hot read is one row with no join. That
 * shape is right for the database and wrong for every other file, so the
 * translation happens here once instead of in five routes.
 *
 * ⛔ The asymmetry this file exists to protect: a FREE seat is `null` in the
 * column and `""` in the model. `resolveSeat` skips a falsy hash on purpose, and
 * the column has `check (… ~ '^[0-9a-f]{64}$')`, so `""` cannot be written back.
 * Both directions are pinned by tests.
 */

import type {
  Duel,
  DuelColor,
  DuelOutcome,
  DuelSeat,
  DuelStatus,
} from "./types";

/** The row as PostgREST hands it over. */
export type DuelRow = {
  id: string;
  status: DuelStatus;
  white_token_hash: string | null;
  black_token_hash: string | null;
  white_display_name: string | null;
  black_display_name: string | null;
  white_claimed_at: string | null;
  black_claimed_at: string | null;
  white_remaining_ms: number;
  black_remaining_ms: number;
  /** `text[]`. Defensively nullable: a `null` here is an empty game, not a crash. */
  moves: string[] | null;
  fen: string;
  outcome: DuelOutcome | null;
  version: number;
  created_at: string;
  expires_at: string;
  last_move_at: string | null;
  /**
   * `numeric(3,1)`, and the one column whose runtime type was worth measuring
   * instead of assuming.
   *
   * ✅ MEASURED against the real table on 2026-08-15: through PostgREST it
   * arrives as a **number**. (This comment first claimed the opposite, on the
   * general reputation of numerics — the probe corrected it.)
   *
   * The union and the `Number()` in `toDuel` stay anyway, and cheaply: read
   * over a raw postgres driver — `pg`, psql, any direct-connection tooling — a
   * `numeric` DOES come back as a string to preserve precision, and
   * `"10.0" === 10` is false in every comparison the ladder makes.
   */
  initial_minutes: number | string;
  invited_by: string | null;
};

/**
 * The per-seat column names, as data.
 *
 * ⚠️ Every write has to name a column per seat, and building those by
 * concatenating `` `${color}_remaining_ms` `` puts a string the compiler cannot
 * check on the hot write path. Going through this map makes a typo a build
 * error instead of a silent no-op update.
 */
export const SEAT_COLUMNS = {
  w: {
    tokenHash: "white_token_hash",
    displayName: "white_display_name",
    claimedAt: "white_claimed_at",
    remainingMs: "white_remaining_ms",
  },
  b: {
    tokenHash: "black_token_hash",
    displayName: "black_display_name",
    claimedAt: "black_claimed_at",
    remainingMs: "black_remaining_ms",
  },
} as const satisfies Record<DuelColor, Record<string, keyof DuelRow>>;

export function toDuel(row: DuelRow): Duel {
  return {
    id: row.id,
    status: row.status,
    seats: {
      w: seatOf("w", row),
      b: seatOf("b", row),
    },
    moves: row.moves ?? [],
    fen: row.fen,
    outcome: row.outcome,
    version: row.version,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastMoveAt: row.last_move_at,
    initialMinutes: Number(row.initial_minutes),
    invitedBy: row.invited_by,
  };
}

export function toRow(duel: Duel): DuelRow {
  return {
    id: duel.id,
    status: duel.status,
    white_token_hash: hashColumn(duel.seats.w),
    black_token_hash: hashColumn(duel.seats.b),
    white_display_name: duel.seats.w.displayName,
    black_display_name: duel.seats.b.displayName,
    white_claimed_at: duel.seats.w.claimedAt,
    black_claimed_at: duel.seats.b.claimedAt,
    white_remaining_ms: duel.seats.w.remainingMs,
    black_remaining_ms: duel.seats.b.remainingMs,
    moves: duel.moves,
    fen: duel.fen,
    outcome: duel.outcome,
    version: duel.version,
    created_at: duel.createdAt,
    expires_at: duel.expiresAt,
    last_move_at: duel.lastMoveAt,
    initial_minutes: duel.initialMinutes,
    invited_by: duel.invitedBy,
  };
}

function seatOf(color: DuelColor, row: DuelRow): DuelSeat {
  const columns = SEAT_COLUMNS[color];
  return {
    color,
    // ⛔ Free seat → `""`, never `null` and never the hash of anything.
    tokenHash: (row[columns.tokenHash] as string | null) ?? "",
    displayName: row[columns.displayName] as string | null,
    claimedAt: row[columns.claimedAt] as string | null,
    remainingMs: row[columns.remainingMs] as number,
  };
}

/** ⛔ `""` back to `null`: the column's CHECK rejects an empty string. */
function hashColumn(seat: DuelSeat): string | null {
  return seat.tokenHash === "" ? null : seat.tokenHash;
}
