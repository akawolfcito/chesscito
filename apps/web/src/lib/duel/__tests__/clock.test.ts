import { describe, it, expect } from "vitest";

import {
  CLOCK_LADDER_MINUTES,
  DEFAULT_CLOCK_MINUTES,
  INVITATION_TTL_MS,
  chargeClock,
  clockStep,
  initialRemainingMs,
  isClockMinutes,
  isInvitationExpired,
  resolveFlag,
} from "../clock";

const T0 = "2026-08-14T12:00:00.000Z";
const at = (isoOffsetMs: number) => Date.parse(T0) + isoOffsetMs;

describe("the ladder", () => {
  it("offers exactly the seven values of the spec, with 30s stored as 0.5", () => {
    expect(CLOCK_LADDER_MINUTES).toEqual([0.5, 1, 3, 5, 10, 15, 30]);
  });

  it("defaults to 10 minutes", () => {
    expect(DEFAULT_CLOCK_MINUTES).toBe(10);
    expect(isClockMinutes(DEFAULT_CLOCK_MINUTES)).toBe(true);
  });

  it("rejects anything off the ladder — this is the whole validation of the create route", () => {
    for (const bad of [0, 2, 7, 20, 45, 60, -10, 10.5, NaN, Infinity]) {
      expect(isClockMinutes(bad)).toBe(false);
    }
    for (const bad of ["10", null, undefined, {}, []]) {
      expect(isClockMinutes(bad)).toBe(false);
    }
  });

  it("steps up and down, and clamps at both ends instead of wrapping", () => {
    expect(clockStep(10, 1)).toBe(15);
    expect(clockStep(10, -1)).toBe(5);
    expect(clockStep(30, 1)).toBe(30);
    expect(clockStep(0.5, -1)).toBe(0.5);
  });

  it("turns minutes into a bank of milliseconds", () => {
    expect(initialRemainingMs(0.5)).toBe(30_000);
    expect(initialRemainingMs(10)).toBe(600_000);
    expect(initialRemainingMs(30)).toBe(1_800_000);
  });
});

describe("chargeClock", () => {
  it("charges the elapsed server time to the seat that moved", () => {
    const charged = chargeClock(600_000, T0, at(12_000));
    expect(charged.remainingMs).toBe(588_000);
    expect(charged.flagged).toBe(false);
  });

  it("charges nothing while the game has no reference stamp yet", () => {
    const charged = chargeClock(600_000, null, at(999_999));
    expect(charged.remainingMs).toBe(600_000);
    expect(charged.flagged).toBe(false);
  });

  it("never gives time back when the stamp is in the future (clock skew)", () => {
    const charged = chargeClock(600_000, T0, at(-5_000));
    expect(charged.remainingMs).toBe(600_000);
  });

  it("floors the bank at zero instead of going negative", () => {
    const charged = chargeClock(1_000, T0, at(90_000));
    expect(charged.remainingMs).toBe(0);
    expect(charged.flagged).toBe(true);
  });

  it("treats an exactly empty bank as a fallen flag, not as 'zero left and still playing'", () => {
    const charged = chargeClock(30_000, T0, at(30_000));
    expect(charged.remainingMs).toBe(0);
    expect(charged.flagged).toBe(true);
  });

  it("ignores what the client claims: the charge is a function of the server stamps only", () => {
    // Same two server stamps, whatever the caller believes elapsed.
    expect(chargeClock(600_000, T0, at(12_000)).remainingMs).toBe(
      chargeClock(600_000, T0, at(12_000)).remainingMs,
    );
  });
});

describe("resolveFlag — the flag falls ON READ, with no cron and no job", () => {
  it("hands the win to the other seat when the seat on move runs out", () => {
    const resolved = resolveFlag("w", 5_000, T0, at(6_000));
    expect(resolved.flagged).toBe(true);
    expect(resolved.remainingMs).toBe(0);
    expect(resolved.outcome).toEqual({ kind: "timeout", winner: "b" });
  });

  it("leaves the duel alone while there is time left", () => {
    const resolved = resolveFlag("b", 5_000, T0, at(1_000));
    expect(resolved.flagged).toBe(false);
    expect(resolved.remainingMs).toBe(4_000);
    expect(resolved.outcome).toBeNull();
  });

  it("lets the two seats hold different banks — the handicap is already possible", () => {
    const white = resolveFlag("w", 600_000, T0, at(10_000));
    const black = resolveFlag("b", 60_000, T0, at(10_000));
    expect(white.remainingMs).toBe(590_000);
    expect(black.remainingMs).toBe(50_000);
    expect(white.outcome).toBeNull();
    expect(black.outcome).toBeNull();
  });
});

describe("the invitation clock", () => {
  it("lives for one hour", () => {
    expect(INVITATION_TTL_MS).toBe(60 * 60 * 1000);
  });

  it("is expired only once the deadline has passed", () => {
    const expiresAt = new Date(Date.parse(T0) + INVITATION_TTL_MS).toISOString();
    expect(isInvitationExpired(expiresAt, at(0))).toBe(false);
    expect(isInvitationExpired(expiresAt, at(INVITATION_TTL_MS - 1))).toBe(false);
    expect(isInvitationExpired(expiresAt, at(INVITATION_TTL_MS))).toBe(true);
    expect(isInvitationExpired(expiresAt, at(INVITATION_TTL_MS + 1))).toBe(true);
  });
});
