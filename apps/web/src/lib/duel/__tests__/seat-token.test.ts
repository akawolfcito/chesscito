import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";

import {
  hashSeatToken,
  issueSeatToken,
  newDuelId,
  resolveSeat,
} from "../seat-token";
import type { DuelColor, DuelSeat } from "../types";

function seat(color: DuelColor, tokenHash: string): DuelSeat {
  return {
    color,
    tokenHash,
    displayName: null,
    claimedAt: tokenHash === "" ? null : "2026-08-14T12:00:00.000Z",
    remainingMs: 600_000,
  };
}

function seatsWith(white: string, black: string): Record<DuelColor, DuelSeat> {
  return { w: seat("w", white), b: seat("b", black) };
}

describe("issueSeatToken", () => {
  it("emits 128 bits of entropy, base64url, with no padding", () => {
    const { token } = issueSeatToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(token, "base64url")).toHaveLength(16);
  });

  it("never repeats itself", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(issueSeatToken().token);
    expect(seen.size).toBe(500);
  });

  it("hands back the hash to store, and it is the hash OF that token", () => {
    const { token, tokenHash } = issueSeatToken();
    expect(tokenHash).toBe(hashSeatToken(token));
    expect(tokenHash).not.toBe(token);
  });
});

describe("hashSeatToken", () => {
  it("is SHA-256 in hex — a dump of the table hands over hashes, not seats", () => {
    const token = "abcdefghijklmnopqrstuv";
    expect(hashSeatToken(token)).toBe(
      createHash("sha256").update(token).digest("hex"),
    );
    expect(hashSeatToken(token)).toHaveLength(64);
  });

  it("is stable and distinguishes tokens", () => {
    expect(hashSeatToken("a")).toBe(hashSeatToken("a"));
    expect(hashSeatToken("a")).not.toBe(hashSeatToken("b"));
  });
});

describe("resolveSeat — the only thing that grants authority over a seat", () => {
  const white = issueSeatToken();
  const black = issueSeatToken();
  const seats = seatsWith(white.tokenHash, black.tokenHash);

  it("resolves each credential to its own seat", () => {
    expect(resolveSeat(seats, white.token)).toBe("w");
    expect(resolveSeat(seats, black.token)).toBe("b");
  });

  it("gives nothing to a credential from ANOTHER duel", () => {
    const stranger = issueSeatToken();
    expect(resolveSeat(seats, stranger.token)).toBeNull();
  });

  it("gives nothing for a missing or empty credential", () => {
    expect(resolveSeat(seats, null)).toBeNull();
    expect(resolveSeat(seats, undefined)).toBeNull();
    expect(resolveSeat(seats, "")).toBeNull();
    expect(resolveSeat(seats, "   ")).toBeNull();
  });

  it("does not hand over a FREE seat to whoever guesses its empty hash", () => {
    const open = seatsWith(white.tokenHash, "");
    expect(resolveSeat(open, "")).toBeNull();
    expect(resolveSeat(open, hashSeatToken(""))).toBeNull();
    expect(resolveSeat(open, white.token)).toBe("w");
  });

  it("does not accept the STORED HASH as a credential", () => {
    // A table dump must not be enough to sit down.
    expect(resolveSeat(seats, white.tokenHash)).toBeNull();
  });
});

describe("newDuelId", () => {
  it("is 128 bits of base64url — not enumerable, not autoincremental", () => {
    const id = newDuelId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(Buffer.from(id, "base64url")).toHaveLength(16);
  });

  it("never repeats itself", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 500; i += 1) seen.add(newDuelId());
    expect(seen.size).toBe(500);
  });
});
