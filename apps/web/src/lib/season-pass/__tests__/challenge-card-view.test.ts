import { describe, expect, it } from "vitest";

import {
  buildChallengeProgressView,
  focusWindow,
  type ChallengeCardEntitlement,
} from "../challenge-card-view";

const NOW = Date.parse("2026-07-27T12:00:00.000Z");

function activePass(expiresAt: string): ChallengeCardEntitlement {
  return {
    status: "active",
    source: "season_pass",
    seasonPassExpiresAt: expiresAt,
    proExpiresAt: null,
  };
}

const ACTIVE_PRO: ChallengeCardEntitlement = {
  status: "active",
  source: "pro",
  seasonPassExpiresAt: null,
  proExpiresAt: null,
};

describe("focusWindow", () => {
  it("gives PRO no countdown at all", () => {
    expect(
      focusWindow({ source: "pro", seasonPassExpiresAt: null, proExpiresAt: null, nowMs: NOW }),
    ).toEqual({ kind: "unbounded" });
  });

  it("counts a season pass down, rounding a partial day up", () => {
    expect(
      focusWindow({
        source: "season_pass",
        seasonPassExpiresAt: "2026-07-31T00:00:00.000Z",
      proExpiresAt: null,
        nowMs: NOW,
      }),
    ).toEqual({ kind: "expiring", daysRemaining: 4 });
  });

  it("reads a lapsed pass as 0 days, never as an absent deadline", () => {
    // The resolver only marks a season pass active with a valid expiry, so a
    // past one means it lapsed while the page was open. Falling back to
    // `unbounded` here would tell a lapsed player they have no deadline.
    expect(
      focusWindow({
        source: "season_pass",
        seasonPassExpiresAt: "2026-07-20T00:00:00.000Z",
      proExpiresAt: null,
        nowMs: NOW,
      }),
    ).toEqual({ kind: "expiring", daysRemaining: 0 });
  });

  it("does not crash on an unparseable expiry", () => {
    expect(
      focusWindow({
        source: "season_pass",
        seasonPassExpiresAt: "not-a-date",
      proExpiresAt: null,
        nowMs: NOW,
      }),
    ).toEqual({ kind: "expiring", daysRemaining: 0 });
  });
});

describe("buildChallengeProgressView", () => {
  it("is loading while the entitlement is still resolving", () => {
    expect(
      buildChallengeProgressView({
        entitlement: { status: "loading" },
        slice: { status: "ok", completed: 5, goal: 21, seasonId: "s1" },
        streak: 5,
        nowMs: NOW,
      }),
    ).toEqual({ state: "loading" });
  });

  it("offers the pass when there is no entitlement", () => {
    expect(
      buildChallengeProgressView({
        entitlement: { status: "none" },
        slice: null,
        streak: 9,
        nowMs: NOW,
      }),
    ).toEqual({ state: "offer" });
  });

  it("is loading -- not degraded, not zero -- before the ledger read answers", () => {
    // `degraded` accuses us of a failure. Not having asked yet is not one.
    expect(
      buildChallengeProgressView({
        entitlement: activePass("2026-07-31T00:00:00.000Z"),
        slice: null,
        streak: 5,
        nowMs: NOW,
      }),
    ).toEqual({ state: "loading" });
  });

  it("passes the flag being off through as disabled, keeping window and combo", () => {
    expect(
      buildChallengeProgressView({
        entitlement: activePass("2026-07-31T00:00:00.000Z"),
        slice: { status: "disabled" },
        streak: 5,
        nowMs: NOW,
      }),
    ).toEqual({
      state: "disabled",
      window: { kind: "expiring", daysRemaining: 4 },
      streak: 5,
    });
  });

  it("degrades on an unavailable ledger WITHOUT falling back to the streak", () => {
    const view = buildChallengeProgressView({
      entitlement: activePass("2026-07-31T00:00:00.000Z"),
      slice: { status: "unavailable" },
      streak: 7,
      nowMs: NOW,
    });

    expect(view.state).toBe("degraded");
    // The streak rides along as a sibling metric; it must never become the
    // progress number, which is the whole defect this replaces.
    expect(view).not.toHaveProperty("progress");
  });

  it("counts an active challenge from the server number, not from the streak", () => {
    expect(
      buildChallengeProgressView({
        entitlement: activePass("2026-07-31T00:00:00.000Z"),
        // A streak far ahead of the ledger: only the ledger may be believed.
        slice: { status: "ok", completed: 3, goal: 21, seasonId: "s1" },
        streak: 19,
        nowMs: NOW,
      }),
    ).toEqual({
      state: "active",
      progress: { completed: 3, goal: 21 },
      window: { kind: "expiring", daysRemaining: 4 },
      streak: 19,
      unreachable: true,
    });
  });

  it("marks a goal still within reach as reachable", () => {
    const view = buildChallengeProgressView({
      entitlement: activePass("2026-08-15T00:00:00.000Z"),
      slice: { status: "ok", completed: 3, goal: 21, seasonId: "s1" },
      streak: 3,
      nowMs: NOW,
    });

    expect(view).toMatchObject({ state: "active", unreachable: false });
  });

  it("never calls PRO unreachable: there is no deadline to miss", () => {
    expect(
      buildChallengeProgressView({
        entitlement: ACTIVE_PRO,
        slice: { status: "ok", completed: 1, goal: 21, seasonId: "s1" },
        streak: 1,
        nowMs: NOW,
      }),
    ).toEqual({
      state: "active",
      progress: { completed: 1, goal: 21 },
      window: { kind: "unbounded" },
      streak: 1,
      unreachable: false,
    });
  });

  it("celebrates a met goal even with access still left", () => {
    expect(
      buildChallengeProgressView({
        entitlement: activePass("2026-08-15T00:00:00.000Z"),
        slice: { status: "ok", completed: 21, goal: 21, seasonId: "s1" },
        streak: 21,
        nowMs: NOW,
      }),
    ).toMatchObject({ state: "completed", progress: { completed: 21, goal: 21 } });
  });

  it("does not let a negative stored streak leak into the view", () => {
    const view = buildChallengeProgressView({
      entitlement: activePass("2026-07-31T00:00:00.000Z"),
      slice: { status: "ok", completed: 2, goal: 21, seasonId: "s1" },
      streak: -3,
      nowMs: NOW,
    });

    expect(view).toMatchObject({ streak: 0 });
  });
});
