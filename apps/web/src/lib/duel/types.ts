/**
 * Contracts for the p2p chess duel (spec: docs/specs/2026-08-13-p2p-chess-duel-by-link-spec.md).
 *
 * Types come first on purpose — the referee and the clock are written against
 * these, and stages 2-5 (table, routes, Arena) reuse them unchanged.
 *
 * ⛔ The hard rule of the spec lives in the shape of `DuelSeat`: authority over a
 * seat comes from a server-issued, non-guessable credential, never from a
 * `walletAddress`/`playerId` the client sends. Only its SHA-256 is ever stored.
 */

/** Seat credential. Opaque, server-issued, 128 bits of CSPRNG, base64url. */
export type SeatToken = string & { readonly __brand: "SeatToken" };

export type DuelColor = "w" | "b";

export type DuelStatus =
  | "awaiting-opponent"
  | "active"
  | "finished"
  | "expired";

export type DuelDrawReason =
  | "stalemate"
  | "insufficient-material"
  | "threefold-repetition"
  | "fifty-move";

export type DuelOutcome =
  | { kind: "checkmate"; winner: DuelColor }
  | { kind: "resign"; winner: DuelColor }
  /** The LOSER ran out of time. Replaces `abandoned`: walking away needs no
   *  rule of its own — your clock runs and you lose. */
  | { kind: "timeout"; winner: DuelColor }
  | { kind: "draw"; reason: DuelDrawReason };

export type DuelSeat = {
  color: DuelColor;
  /** SHA-256 of the SeatToken. The plain token only exists in the response that issues it. */
  tokenHash: string;
  displayName: string | null;
  claimedAt: string | null;
  /** ⛔ PER SEAT, never a single field on the duel: the future time handicap is
   *  then just starting them at different values. */
  remainingMs: number;
};

export type Duel = {
  /** 128 bits base64url. Not enumerable, not autoincremental, not UUIDv1. */
  id: string;
  status: DuelStatus;
  seats: Record<DuelColor, DuelSeat>;
  /** The whole game in SAN. */
  moves: string[];
  /** FEN of the current position, stored next to the moves so a request never
   *  has to replay 60 moves to validate the next one. */
  fen: string;
  outcome: DuelOutcome | null;
  /** CAS. Every write carries the `version` it read; the server rejects a mismatch. */
  version: number;
  createdAt: string;
  /** ⚠️ ONLY the invitation clock (1 h). Once `active`, the chess clock ends the game. */
  expiresAt: string;
  /** SERVER stamp of the last move. The charge is computed against this, and the
   *  client interpolates its clocks from it without polling more often. */
  lastMoveAt: string | null;
  /** Initial minutes picked on the ladder (30s is stored as 0.5). Informative:
   *  the truth about time lives in `seats[color].remainingMs`. */
  initialMinutes: number;
  /** ⛔ Written by the SERVER from the creator's credential, never reported by a client. */
  invitedBy: string | null;
};

/** What a client sees. ⛔ NEVER includes `tokenHash`. */
export type DuelPublic = Omit<Duel, "seats"> & {
  seats: Record<DuelColor, Omit<DuelSeat, "tokenHash">>;
  /** Which seat the ASKER is, resolved server-side from their credential. */
  you: DuelColor | null;
  turnOf: DuelColor | null;
  yourTurn: boolean;
};

export type ApplyMoveResult =
  | { ok: true; duel: DuelPublic }
  | { ok: false; code: "not-your-seat" }
  | { ok: false; code: "not-your-turn" }
  | { ok: false; code: "illegal-move" }
  | { ok: false; code: "duel-not-active" }
  | { ok: false; code: "version-conflict"; duel: DuelPublic }
  | { ok: false; code: "expired"; duel: DuelPublic };

export type JoinResult =
  | { ok: true; duel: DuelPublic; seatToken: SeatToken }
  | { ok: false; code: "seat-taken" }
  | { ok: false; code: "already-seated"; duel: DuelPublic }
  | { ok: false; code: "duel-not-joinable" }
  | { ok: false; code: "not-found" };

/** The seat that is not `color`. */
export function opponentOf(color: DuelColor): DuelColor {
  return color === "w" ? "b" : "w";
}
