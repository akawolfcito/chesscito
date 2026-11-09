/**
 * Seat identity. Pure, server-only.
 *
 * ⛔ The hard rule of the spec lives here and nowhere else:
 *
 *   No `walletAddress`, `playerId` or `seatId` sent by a client grants authority
 *   over a seat. Authority comes from a NON-GUESSABLE credential issued by the
 *   SERVER.
 *
 * It is what killed v2 of this feature, and the defect is still alive in
 * production (`api/games/route.ts:21` checks `isAddress()` — the shape, not the
 * ownership). Having a session lets you ASK for a seat; it never tells you
 * WHICH seat is yours.
 *
 * ⚠️ Only the SHA-256 is stored. A dump of the table hands over hashes, and a
 * hash cannot sit down: `resolveSeat` hashes what it is given, so replaying a
 * stored hash resolves to nothing.
 */

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import type { DuelColor, DuelSeat, SeatToken } from "./types";

/** 128 bits — the size the spec pins for both the credential and the duel id. */
const ENTROPY_BYTES = 16;

export type IssuedSeatToken = {
  /** In the clear. Exists only in the response that issues it — never stored. */
  token: SeatToken;
  /** What the row keeps. */
  tokenHash: string;
};

export function issueSeatToken(): IssuedSeatToken {
  const token = randomBytes(ENTROPY_BYTES).toString("base64url") as SeatToken;
  return { token, tokenHash: hashSeatToken(token) };
}

export function hashSeatToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Which seat of THIS duel the caller holds, if any.
 *
 * ⚠️ Returns `null` for anything else — a credential from another duel, a
 * stored hash, a blank — and the caller must answer `not-your-seat` without
 * revealing whose turn it is.
 */
export function resolveSeat(
  seats: Record<DuelColor, Pick<DuelSeat, "tokenHash">>,
  token: string | null | undefined,
): DuelColor | null {
  if (typeof token !== "string") return null;
  const trimmed = token.trim();
  if (trimmed === "") return null;

  const candidate = hashSeatToken(trimmed);
  for (const color of ["w", "b"] as const) {
    // ⛔ A free seat carries an empty hash. Skipping it is what stops someone
    // from claiming the open seat by handing over the hash of nothing.
    const stored = seats[color]?.tokenHash;
    if (!stored) continue;
    if (equalsConstantTime(candidate, stored)) return color;
  }
  return null;
}

/** 128 bits base64url. Not enumerable, not autoincremental, not UUIDv1. */
export function newDuelId(): string {
  return randomBytes(ENTROPY_BYTES).toString("base64url");
}

function equalsConstantTime(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}
